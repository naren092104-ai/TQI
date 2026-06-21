import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { query, execute } from "./db.js";
import { ensureSchema } from "./schema.js";

async function seedAdmins() {
  const existingAdmins = await query(`SELECT id FROM admins LIMIT 1`);
  if (existingAdmins.length > 0) return;

  const adminPassword = await bcrypt.hash("Admin@123", 10);
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await execute(
    `INSERT INTO admins (id, name, email, username, password, phone, role, active, lastLogin, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "demo-1",
      "Demo User",
      "demo@tqi.org",
      "demo",
      adminPassword,
      "9999999990",
      "Admin",
      true,
      now,
      now,
      "admin-1",
      "Super Admin",
      "admin@tqi.org",
      "admin",
      adminPassword,
      "9999999999",
      "Super Admin",
      true,
      now,
      now,
    ],
  );
}

async function run() {
  await ensureSchema();
  await seedAdmins();
  console.log(`Database "${config.db.name}" ready with all tables and demo admins.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
