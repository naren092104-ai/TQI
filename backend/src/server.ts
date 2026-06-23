import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import bodyParser from "body-parser";
import path from "node:path";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { resourceRouter } from "./routes/resources.js";
import { createUploadsDir } from "./utils.js";

const app = express();

app.set("etag", false);

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

createUploadsDir(config.uploadsDir);

app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use("/api/auth", authRouter);
app.use("/api", resourceRouter);

app.use("/uploads", express.static(path.resolve(config.uploadsDir)));

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
