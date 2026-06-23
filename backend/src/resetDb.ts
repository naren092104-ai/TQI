import mysql from "mysql2/promise";
import { config } from "./config.js";

async function run() {
  const conn = await mysql.createConnection(config.dbUrl);
  const [tables]: any = await conn.query("SHOW TABLES");
  const tableNames = tables.map((row: any) => Object.values(row)[0]).filter(Boolean);
  if (tableNames.length === 0) {
    console.log("No tables to drop.");
    await conn.end();
    return;
  }
  for (const t of tableNames) {
    console.log(`Dropping table ${t}`);
    await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
  }
  await conn.end();
  console.log("All tables dropped.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
