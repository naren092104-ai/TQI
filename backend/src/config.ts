import dotenv from "dotenv";

dotenv.config();

const dbHost = process.env.DB_HOST?.trim() || "127.0.0.1";
const dbPort = process.env.DB_PORT?.trim() || "3306";
const dbName = process.env.DB_NAME?.trim() || "tqi";
const dbUser = process.env.DB_USER?.trim() || "root";
const dbPassword = process.env.DB_PASSWORD ?? "password";
const defaultDbUrl = `mysql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "tqi-demo-secret",
  db: {
    host: dbHost,
    port: Number(dbPort),
    name: dbName,
    user: dbUser,
    password: dbPassword,
  },
  dbUrl: process.env.DATABASE_URL?.trim() || defaultDbUrl,
  uploadsDir: process.env.UPLOADS_DIR ?? "uploads",
};
