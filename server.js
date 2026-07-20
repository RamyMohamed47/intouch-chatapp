import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import createApp from "./app.js";
import connectDatabase from "./config/database.js";
import configureSocket from "./sockets/socket.js";

dotenv.config({ path: "./config.env" });

const port = process.env.PORT || 3000;
const app = createApp();
const server = http.createServer(app);
const io = new Server(server);

app.set("io", io);
configureSocket(io);

try {
  await connectDatabase();

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
} catch (err) {
  console.error("DB connection failed:", err.message);
  process.exit(1);
}
