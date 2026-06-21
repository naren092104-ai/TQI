import mysql from "mysql2/promise";
import { config } from "./config.js";

const pool = mysql.createPool(config.dbUrl);

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function execute(sql: string, params: any[] = []): Promise<any> {
  const [result] = await pool.execute(sql, params);
  return result;
}
