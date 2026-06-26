import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import bodyParser from "body-parser";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { resourceRouter } from "./routes/resources.js";
import { tqiReportsRouter } from "./routes/tqi-reports.js";
import { createUploadsDir } from "./utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.set("etag", false);

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(bodyParser.json({ limit: "15mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

createUploadsDir(config.uploadsDir);

app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// ── Bill Scanner endpoint ──────────────────────────────────────────────────
app.post("/api/scan-bill", (req, res) => {
  const { image } = req.body as { image?: string };
  if (!image) return res.status(400).json({ success: false, error: "No image" });

  const scriptPath = path.join(__dirname, "scanner.py");
  const py = spawn("python3", [scriptPath], { timeout: 30_000 });

  let stdout = "";
  let stderr = "";
  py.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
  py.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

  py.on("close", (code) => {
    if (code !== 0 && !stdout) {
      // Try python fallback
      const py2 = spawn("python", [scriptPath], { timeout: 30_000 });
      let out2 = "";
      py2.stdout.on("data", (d: Buffer) => { out2 += d.toString(); });
      py2.on("close", (code2) => {
        if (code2 !== 0 || !out2) {
          return res.json({ success: false, error: "Python not available", original: image, processed: image });
        }
        try { res.json(JSON.parse(out2)); } catch { res.json({ success: false, error: "Parse error" }); }
      });
      py2.stdin.write(image);
      py2.stdin.end();
      return;
    }
    try { res.json(JSON.parse(stdout)); }
    catch { res.json({ success: false, error: stderr || "Parse error", original: image, processed: image }); }
  });

  py.stdin.write(image);
  py.stdin.end();
});

app.use("/api/auth", authRouter);
app.use("/api/tqi-reports", tqiReportsRouter);
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
