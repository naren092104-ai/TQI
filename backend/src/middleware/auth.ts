import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface AuthPayload {
  id: string;
  role: string;
  email?: string;
  username?: string;
  clusterId?: string;
}

export type UserRole = "SUPER_ADMIN" | "CLUSTER_ADMIN" | "VOLUNTEER" | "FINANCE";

// Normalize role: "Cluster Admin" → "CLUSTER_ADMIN", "Super Admin" → "SUPER_ADMIN"
function normalizeRole(role: string): string {
  return role.trim().toUpperCase().replace(/\s+/g, "_");
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload;
    req.user = decoded as any;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: "Token expired" });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Invalid token" });
    }
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Permission checker functions
export function canCreateStudent(user?: AuthPayload): boolean {
  if (!user) return false;
  const adminRoles = ["SUPER_ADMIN", "CLUSTER_ADMIN"];
  return adminRoles.includes(normalizeRole(user.role));
}

export function canEditStudent(user?: AuthPayload): boolean {
  if (!user) return false;
  const adminRoles = ["SUPER_ADMIN", "CLUSTER_ADMIN"];
  return adminRoles.includes(normalizeRole(user.role));
}

export function canDeleteStudent(user?: AuthPayload): boolean {
  if (!user) return false;
  const adminRoles = ["SUPER_ADMIN", "CLUSTER_ADMIN"];
  return adminRoles.includes(normalizeRole(user.role));
}

export function canViewStudents(user?: AuthPayload): boolean {
  if (!user) return false;
  return true; // All authenticated users can view
}

export function isAdmin(user?: AuthPayload): boolean {
  if (!user) return false;
  const adminRoles = ["SUPER_ADMIN", "CLUSTER_ADMIN", "FINANCE"];
  return adminRoles.includes(normalizeRole(user.role));
}

export function isSuperAdmin(user?: AuthPayload): boolean {
  if (!user) return false;
  return normalizeRole(user.role) === "SUPER_ADMIN";
}

export function isClusterAdmin(user?: AuthPayload): boolean {
  if (!user) return false;
  return normalizeRole(user.role) === "CLUSTER_ADMIN";
}

export function isVolunteer(user?: AuthPayload): boolean {
  if (!user) return false;
  return normalizeRole(user.role) === "VOLUNTEER";
}

// Middleware for checking permissions
export function requirePermission(checker: (user?: AuthPayload) => boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!checker(req.user)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
