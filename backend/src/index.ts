import app from "./server.js";
import { config } from "./config.js";
import { ensureSchema } from "./schema.js";

await ensureSchema();

app.listen(config.port, () => {
  console.log(`Backend API server listening on http://localhost:${config.port} (db: ${config.db.name})`);
});
