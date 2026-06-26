import mysql from "mysql2/promise";
import { config } from "./config.js";
import { execute, query } from "./db.js";

const TABLE_SQL = [
  "CREATE TABLE IF NOT EXISTS `academicYears` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `start` DATE, `end` DATE, `active` BOOLEAN, `archived` BOOLEAN)",
  "CREATE TABLE IF NOT EXISTS `clusters` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `code` VARCHAR(64), `state` VARCHAR(255), `district` VARCHAR(255), `status` VARCHAR(64), `lead` VARCHAR(255), `createdAt` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `panchayats` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `clusterId` VARCHAR(64), `head` VARCHAR(255), `createdAt` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `villages` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `panchayatId` VARCHAR(64), `population` INT, `createdAt` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `schools` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `villageId` VARCHAR(64), `type` VARCHAR(64), `principal` VARCHAR(255), `createdAt` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `colleges` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `city` VARCHAR(255), `affiliated` VARCHAR(255), `clusterId` VARCHAR(64), `createdAt` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `admins` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `email` VARCHAR(255), `username` VARCHAR(255), `password` VARCHAR(255), `phone` VARCHAR(64), `role` VARCHAR(64), `active` BOOLEAN, `lastLogin` DATETIME, `createdAt` DATETIME, `clusterId` VARCHAR(64))",
  "CREATE TABLE IF NOT EXISTS `students` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `rollNo` VARCHAR(64), `schoolId` VARCHAR(64), `villageId` VARCHAR(64), `panchayatId` VARCHAR(64), `clusterId` VARCHAR(64), `grade` VARCHAR(64), `gender` VARCHAR(8), `dob` DATE, `parentName` VARCHAR(255), `parentPhone` VARCHAR(64), `guardian` VARCHAR(255), `phone` VARCHAR(64), `address` TEXT, `status` VARCHAR(64), `createdAt` DATETIME, `updatedAt` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `volunteers` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `email` VARCHAR(255), `phone` VARCHAR(64), `clusterId` VARCHAR(64), `skill` VARCHAR(255), `sessions` INT, `college` VARCHAR(255), `department` VARCHAR(255), `year` VARCHAR(8), `address` TEXT, `villageAssignments` JSON)",
  "CREATE TABLE IF NOT EXISTS `sessions` (`id` VARCHAR(64) PRIMARY KEY, `day` INT, `title` VARCHAR(255), `description` TEXT, `date` DATE, `clusterId` VARCHAR(64), `status` VARCHAR(64), `trainer` VARCHAR(255), `conductedDate` DATETIME, `completedAt` DATETIME, `lockedAt` DATETIME, `reopenUntil` DATETIME, `completedBy` VARCHAR(255), `dateSetAt` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `attendance` (`id` VARCHAR(64) PRIMARY KEY, `date` DATE, `schoolId` VARCHAR(64), `present` INT, `total` INT, `type` VARCHAR(32), `status` VARCHAR(32), `sessionId` VARCHAR(64), `clusterId` VARCHAR(64), `submittedBy` VARCHAR(255), `details` JSON)",
  "CREATE TABLE IF NOT EXISTS `homework` (`id` VARCHAR(64) PRIMARY KEY, `date` DATE, `schoolId` VARCHAR(64), `completed` INT, `partial` INT, `notDone` INT, `status` VARCHAR(32), `sessionId` VARCHAR(64), `clusterId` VARCHAR(64), `submittedBy` VARCHAR(255), `details` JSON)",
  "CREATE TABLE IF NOT EXISTS `advances` (`id` VARCHAR(64) PRIMARY KEY, `amount` DECIMAL(12,2), `date` DATE, `receivedFrom` VARCHAR(255), `utr` VARCHAR(255), `status` VARCHAR(64), `remarks` TEXT)",
  "CREATE TABLE IF NOT EXISTS `expenses` (`id` VARCHAR(64) PRIMARY KEY, `date` DATE, `category` VARCHAR(64), `amount` DECIMAL(12,2), `description` TEXT, `submittedBy` VARCHAR(255), `status` VARCHAR(64), `advanceId` VARCHAR(64), `travelFrom` VARCHAR(255), `travelTo` VARCHAR(255), `breakfast` DECIMAL(12,2), `lunch` DECIMAL(12,2), `dinner` DECIMAL(12,2), `refreshment` DECIMAL(12,2), `remarks` TEXT, `bills` JSON)",
  "CREATE TABLE IF NOT EXISTS `refunds` (`id` VARCHAR(64) PRIMARY KEY, `amount` DECIMAL(12,2), `date` DATE, `utr` VARCHAR(255), `txn` VARCHAR(255), `remarks` TEXT, `status` VARCHAR(64))",
  "CREATE TABLE IF NOT EXISTS `approvals` (`id` VARCHAR(64) PRIMARY KEY, `type` VARCHAR(64), `reference` VARCHAR(255), `requestedBy` VARCHAR(255), `amount` DECIMAL(12,2), `date` DATE, `status` VARCHAR(64), `remarks` TEXT, `sessionId` VARCHAR(64), `clusterId` VARCHAR(64))",
  "CREATE TABLE IF NOT EXISTS `timeline` (`id` VARCHAR(64) PRIMARY KEY, `title` VARCHAR(255), `due` DATE, `owner` VARCHAR(255), `status` VARCHAR(64))",
  "CREATE TABLE IF NOT EXISTS `notifications` (`id` VARCHAR(64) PRIMARY KEY, `title` VARCHAR(255), `body` TEXT, `type` VARCHAR(64), `read` BOOLEAN, `at` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `auditLogs` (`id` VARCHAR(64) PRIMARY KEY, `user` VARCHAR(255), `action` TEXT, `at` DATETIME, `ip` VARCHAR(64))",
];

// Columns to add to existing tables (ALTER TABLE ADD COLUMN IF NOT EXISTS)
const COLUMN_MIGRATIONS: { table: string; column: string; ddl: string }[] = [
  // students
  { table: "students", column: "villageId",    ddl: "`villageId` VARCHAR(64)" },
  { table: "students", column: "panchayatId",  ddl: "`panchayatId` VARCHAR(64)" },
  { table: "students", column: "clusterId",    ddl: "`clusterId` VARCHAR(64)" },
  { table: "students", column: "dob",          ddl: "`dob` DATE" },
  { table: "students", column: "parentName",   ddl: "`parentName` VARCHAR(255)" },
  { table: "students", column: "parentPhone",  ddl: "`parentPhone` VARCHAR(64)" },
  { table: "students", column: "address",      ddl: "`address` TEXT" },
  { table: "students", column: "status",       ddl: "`status` VARCHAR(64)" },
  { table: "students", column: "createdAt",    ddl: "`createdAt` DATETIME" },
  { table: "students", column: "updatedAt",    ddl: "`updatedAt` DATETIME" },
  // volunteers
  { table: "volunteers", column: "college",           ddl: "`college` VARCHAR(255)" },
  { table: "volunteers", column: "department",        ddl: "`department` VARCHAR(255)" },
  { table: "volunteers", column: "year",              ddl: "`year` VARCHAR(8)" },
  { table: "volunteers", column: "address",           ddl: "`address` TEXT" },
  { table: "volunteers", column: "villageAssignments",ddl: "`villageAssignments` JSON" },
  // colleges
  { table: "colleges", column: "clusterId",    ddl: "`clusterId` VARCHAR(64)" },
  // sessions
  { table: "sessions", column: "description",  ddl: "`description` TEXT" },
  { table: "sessions", column: "conductedDate",ddl: "`conductedDate` DATETIME" },
  { table: "sessions", column: "completedAt",  ddl: "`completedAt` DATETIME" },
  { table: "sessions", column: "lockedAt",     ddl: "`lockedAt` DATETIME" },
  { table: "sessions", column: "reopenUntil",  ddl: "`reopenUntil` DATETIME" },
  { table: "sessions", column: "completedBy",  ddl: "`completedBy` VARCHAR(255)" },
  { table: "sessions", column: "dateSetAt",    ddl: "`dateSetAt` DATETIME" },
  // attendance — submission tracking
  { table: "attendance", column: "status",      ddl: "`status` VARCHAR(32)" },
  { table: "attendance", column: "sessionId",   ddl: "`sessionId` VARCHAR(64)" },
  { table: "attendance", column: "clusterId",   ddl: "`clusterId` VARCHAR(64)" },
  { table: "attendance", column: "submittedBy", ddl: "`submittedBy` VARCHAR(255)" },
  { table: "attendance", column: "details",     ddl: "`details` JSON" },
  // homework — submission tracking
  { table: "homework", column: "status",        ddl: "`status` VARCHAR(32)" },
  { table: "homework", column: "sessionId",     ddl: "`sessionId` VARCHAR(64)" },
  { table: "homework", column: "clusterId",     ddl: "`clusterId` VARCHAR(64)" },
  { table: "homework", column: "submittedBy",   ddl: "`submittedBy` VARCHAR(255)" },
  { table: "homework", column: "details",       ddl: "`details` JSON" },
  // approvals
  { table: "approvals", column: "sessionId",   ddl: "`sessionId` VARCHAR(64)" },
  { table: "approvals", column: "clusterId",   ddl: "`clusterId` VARCHAR(64)" },
];

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.name}\``);
  await connection.end();
}

export async function ensureSchema() {
  await ensureDatabase();

  // Create tables (no-op if already exist)
  for (const sql of TABLE_SQL) {
    await execute(sql);
  }

  // Add missing columns to existing tables
  for (const { table, column, ddl } of COLUMN_MIGRATIONS) {
    if (!(await columnExists(table, column))) {
      await execute(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
      console.log(`Added column ${table}.${column}`);
    }
  }

  console.log("Schema ready.");
}
