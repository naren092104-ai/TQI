import mysql from "mysql2/promise";
import { config } from "./config.js";
import { execute } from "./db.js";

const TABLE_SQL = [
  "CREATE TABLE IF NOT EXISTS `academicYears` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `start` DATE, `end` DATE, `active` BOOLEAN, `archived` BOOLEAN)",
  "CREATE TABLE IF NOT EXISTS `clusters` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `code` VARCHAR(64), `state` VARCHAR(255), `district` VARCHAR(255), `status` VARCHAR(64), `lead` VARCHAR(255), `createdAt` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `panchayats` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `clusterId` VARCHAR(64), `head` VARCHAR(255), `createdAt` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `villages` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `panchayatId` VARCHAR(64), `population` INT, `createdAt` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `schools` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `villageId` VARCHAR(64), `type` VARCHAR(64), `principal` VARCHAR(255), `createdAt` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `colleges` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `city` VARCHAR(255), `affiliated` VARCHAR(255), `createdAt` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `admins` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `email` VARCHAR(255), `username` VARCHAR(255), `password` VARCHAR(255), `phone` VARCHAR(64), `role` VARCHAR(64), `active` BOOLEAN, `lastLogin` DATETIME, `createdAt` DATETIME, `clusterId` VARCHAR(64))",
  "CREATE TABLE IF NOT EXISTS `students` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `rollNo` VARCHAR(64), `schoolId` VARCHAR(64), `grade` VARCHAR(64), `gender` VARCHAR(8), `guardian` VARCHAR(255), `phone` VARCHAR(64))",
  "CREATE TABLE IF NOT EXISTS `volunteers` (`id` VARCHAR(64) PRIMARY KEY, `name` VARCHAR(255), `email` VARCHAR(255), `phone` VARCHAR(64), `clusterId` VARCHAR(64), `skill` VARCHAR(255), `sessions` INT)",
  "CREATE TABLE IF NOT EXISTS `sessions` (`id` VARCHAR(64) PRIMARY KEY, `day` INT, `title` VARCHAR(255), `date` DATE, `clusterId` VARCHAR(64), `status` VARCHAR(64), `trainer` VARCHAR(255))",
  "CREATE TABLE IF NOT EXISTS `attendance` (`id` VARCHAR(64) PRIMARY KEY, `date` DATE, `schoolId` VARCHAR(64), `present` INT, `total` INT, `type` VARCHAR(32))",
  "CREATE TABLE IF NOT EXISTS `homework` (`id` VARCHAR(64) PRIMARY KEY, `date` DATE, `schoolId` VARCHAR(64), `completed` INT, `partial` INT, `notDone` INT)",
  "CREATE TABLE IF NOT EXISTS `advances` (`id` VARCHAR(64) PRIMARY KEY, `amount` DECIMAL(12,2), `date` DATE, `receivedFrom` VARCHAR(255), `utr` VARCHAR(255), `status` VARCHAR(64), `remarks` TEXT)",
  "CREATE TABLE IF NOT EXISTS `expenses` (`id` VARCHAR(64) PRIMARY KEY, `date` DATE, `category` VARCHAR(64), `amount` DECIMAL(12,2), `description` TEXT, `submittedBy` VARCHAR(255), `status` VARCHAR(64), `advanceId` VARCHAR(64), `travelFrom` VARCHAR(255), `travelTo` VARCHAR(255), `breakfast` DECIMAL(12,2), `lunch` DECIMAL(12,2), `dinner` DECIMAL(12,2), `refreshment` DECIMAL(12,2), `remarks` TEXT, `bills` JSON)",
  "CREATE TABLE IF NOT EXISTS `refunds` (`id` VARCHAR(64) PRIMARY KEY, `amount` DECIMAL(12,2), `date` DATE, `utr` VARCHAR(255), `txn` VARCHAR(255), `remarks` TEXT, `status` VARCHAR(64))",
  "CREATE TABLE IF NOT EXISTS `approvals` (`id` VARCHAR(64) PRIMARY KEY, `type` VARCHAR(64), `reference` VARCHAR(255), `requestedBy` VARCHAR(255), `amount` DECIMAL(12,2), `date` DATE, `status` VARCHAR(64), `remarks` TEXT)",
  "CREATE TABLE IF NOT EXISTS `timeline` (`id` VARCHAR(64) PRIMARY KEY, `title` VARCHAR(255), `due` DATE, `owner` VARCHAR(255), `status` VARCHAR(64))",
  "CREATE TABLE IF NOT EXISTS `notifications` (`id` VARCHAR(64) PRIMARY KEY, `title` VARCHAR(255), `body` TEXT, `type` VARCHAR(64), `read` BOOLEAN, `at` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `auditLogs` (`id` VARCHAR(64) PRIMARY KEY, `user` VARCHAR(255), `action` TEXT, `at` DATETIME, `ip` VARCHAR(64))",
];

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
  for (const sql of TABLE_SQL) {
    await execute(sql);
  }
}
