import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: "./config.env" });
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3000;

app.use(express.static(__dirname));



app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
