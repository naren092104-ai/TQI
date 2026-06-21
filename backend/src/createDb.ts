import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const host = process.env.DB_HOST?.trim() || "127.0.0.1";
const port = Number(process.env.DB_PORT?.trim() || 3306);
const user = process.env.DB_USER?.trim() || "root";
const password = process.env.DB_PASSWORD ?? "password";
const dbName = process.env.DB_NAME_RESET ?? "tqi_reset";

async function run() {
  const conn = await mysql.createConnection({ host, port, user, password });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  console.log(`Database ${dbName} ensured.`);
  await conn.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
