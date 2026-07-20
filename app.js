import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import handleError from "./controllers/errorController.js";
import apiRouter from "./routes/index.js";
import AppError from "./utils/appError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, "public");

const createApp = () => {
  const app = express();

  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: true, limit: "10kb" }));
  app.use(express.static(publicPath));

  app.use("/api/v1", apiRouter);

  app.use((req, res, next) => {
    next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
  });

  app.use(handleError);

  return app;
};

export default createApp;
