import mysql from "mysql2/promise";
import { config } from "./config.js";
import { RESOURCE_MAP } from "./resources.js";

async function run() {
  const conn = await mysql.createConnection(config.dbUrl);
  for (const [resource, cfg] of Object.entries(RESOURCE_MAP)) {
    try {
      const [rows]: any = await conn.query(`SHOW COLUMNS FROM \`${cfg.table}\``);
      const existing = rows.map((r: any) => r.Field);
      const missing = cfg.columns.filter((c) => !existing.includes(c));
      if (missing.length > 0) {
        console.log(`${resource}: missing columns -> ${missing.join(", ")}`);
      } else {
        console.log(`${resource}: OK`);
      }
    } catch (err: any) {
      console.log(`${resource}: error reading table '${cfg.table}': ${err.message}`);
    }
  }
  await conn.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
