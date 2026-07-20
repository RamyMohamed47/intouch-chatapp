import express from "express";
import dotenv from "dotenv";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import Message from "./models/messageModel.js";

import { fileURLToPath } from "url";
dotenv.config({ path: "./config.env" });
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3000;
const { DATABASE, DB_PASSWORD } = process.env;
const DB = DATABASE?.replace("<db_password>", DB_PASSWORD);

app.use(express.json());
app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true }));

app.get("/messages", async (req, res) => {
  try {
    const messages = await Message.find({}).lean();
    res.send(messages);
  } catch (err) {
    console.error("Failed to fetch messages:", err);
    res.sendStatus(500);
  }
});
app.post("/messages", async (req, res) => {
  try {
    const message = new Message(req.body);
    await message.save();

    io.emit("message", req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error("Failed to save message:", err);
    res.sendStatus(500);
  }
});

io.on("connection", (socket) => {
  console.log("user connected");
});

try {
  if (!DATABASE || !DB_PASSWORD) {
    throw new Error("DATABASE and DB_PASSWORD env vars are required");
  }

  await mongoose.connect(DB);
  console.log("DB connection successful");

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
} catch (err) {
  console.error("DB connection failed:", err.message);
  process.exit(1);
}
