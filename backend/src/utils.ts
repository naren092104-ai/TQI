import fs from "node:fs";
import path from "node:path";

export function createUploadsDir(dir: string) {
  const fullPath = path.resolve(dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
}
