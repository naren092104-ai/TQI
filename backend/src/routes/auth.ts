import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { query } from "../db.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password: string };
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  // Login by email only
  const rows = await query<any>(
    "SELECT * FROM admins WHERE email = ? AND active = 1 LIMIT 1",
    [email]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const passwordMatches = await bcrypt.compare(password, user.password || "");
  if (!passwordMatches) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { id: user.id, role: user.role, email: user.email, clusterId: user.clusterId },
    config.jwtSecret,
    { expiresIn: "8h" },
  );

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, clusterId: user.clusterId } });
});
