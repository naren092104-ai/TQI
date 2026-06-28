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
  "CREATE TABLE IF NOT EXISTS `attendance_submissions` (`id` VARCHAR(64) PRIMARY KEY, `cluster_id` VARCHAR(64), `cluster_name` VARCHAR(255), `session_id` VARCHAR(64), `session_name` VARCHAR(255), `day` INT, `date` DATE, `attendance_type` VARCHAR(32), `submitted_by` VARCHAR(255), `submitted_at` DATETIME, `status` VARCHAR(32), `present_count` INT, `absent_count` INT, `homework_completed` INT, `total_count` INT)",
  "CREATE TABLE IF NOT EXISTS `advances` (`id` VARCHAR(64) PRIMARY KEY, `amount` DECIMAL(12,2), `date` DATE, `receivedFrom` VARCHAR(255), `utr` VARCHAR(255), `status` VARCHAR(64), `remarks` TEXT, `clusterId` VARCHAR(64), `clusterName` VARCHAR(255), `releasedBy` VARCHAR(255))",
  "CREATE TABLE IF NOT EXISTS `expenses` (`id` VARCHAR(64) PRIMARY KEY, `date` DATE, `sessionDay` INT, `clusterId` VARCHAR(64), `clusterName` VARCHAR(255), `collegeName` VARCHAR(255), `financerName` VARCHAR(255), `submittedBy` VARCHAR(255), `spocName` VARCHAR(255), `category` VARCHAR(64), `amount` DECIMAL(12,2), `description` TEXT, `status` VARCHAR(64), `advanceId` VARCHAR(64), `volunteerCount` INT, `remarks` TEXT, `bills` JSON, `travelEntries` JSON, `foodEntries` JSON, `stationeryAmount` DECIMAL(12,2), `stationeryBills` JSON, `stationeryEntries` JSON, `otherEntries` JSON, `sessionName` VARCHAR(255), `grandTotal` DECIMAL(12,2), `balance` DECIMAL(12,2))",
  "CREATE TABLE IF NOT EXISTS `financeSettings` (`id` VARCHAR(64) PRIMARY KEY, `financerName` VARCHAR(255), `financeEmail` VARCHAR(255), `approverName` VARCHAR(255), `approverDesignation` VARCHAR(255), `organizationName` VARCHAR(255), `pdfFooter` TEXT, `signatureName` VARCHAR(255), `signatureDesignation` VARCHAR(255), `updatedAt` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `refunds` (`id` VARCHAR(64) PRIMARY KEY, `amount` DECIMAL(12,2), `date` DATE, `utr` VARCHAR(255), `txn` VARCHAR(255), `remarks` TEXT, `status` VARCHAR(64))",
  "CREATE TABLE IF NOT EXISTS `approvals` (`id` VARCHAR(64) PRIMARY KEY, `type` VARCHAR(64), `reference` VARCHAR(255), `requestedBy` VARCHAR(255), `amount` DECIMAL(12,2), `date` DATE, `status` VARCHAR(64), `remarks` TEXT, `sessionId` VARCHAR(64), `clusterId` VARCHAR(64))",
  "CREATE TABLE IF NOT EXISTS `timeline` (`id` VARCHAR(64) PRIMARY KEY, `title` VARCHAR(255), `due` DATE, `owner` VARCHAR(255), `status` VARCHAR(64))",
  "CREATE TABLE IF NOT EXISTS `notifications` (`id` VARCHAR(64) PRIMARY KEY, `title` VARCHAR(255), `body` TEXT, `type` VARCHAR(64), `read` BOOLEAN, `at` DATETIME)",
  "CREATE TABLE IF NOT EXISTS `auditLogs` (`id` VARCHAR(64) PRIMARY KEY, `user` VARCHAR(255), `action` TEXT, `at` DATETIME, `ip` VARCHAR(64))",
  // TQI Session Reports
  "CREATE TABLE IF NOT EXISTS `tqiReports` (`id` VARCHAR(64) PRIMARY KEY, `clusterId` VARCHAR(64), `clusterName` VARCHAR(255), `collegeName` VARCHAR(255), `spocName` VARCHAR(255), `sessionId` VARCHAR(64), `sessionName` VARCHAR(255), `day` INT, `date` DATE, `academicYear` VARCHAR(255), `sessionObjective` TEXT, `activitiesConducted` TEXT, `keyLearningOutcomes` TEXT, `studentsPresent` INT DEFAULT 0, `studentsAbsent` INT DEFAULT 0, `totalVolunteers` INT DEFAULT 0, `beneficiaries` INT DEFAULT 0, `studentParticipation` TEXT, `volunteerParticipation` TEXT, `challengesFaced` TEXT, `solutionsProvided` TEXT, `futureActionPlan` TEXT, `remarks` TEXT, `photos` JSON, `status` VARCHAR(32) DEFAULT 'Draft', `submittedBy` VARCHAR(255), `submittedAt` DATETIME, `pdfGeneratedAt` DATETIME, `createdAt` DATETIME, `updatedAt` DATETIME)",
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
  // tqiReports — add all columns that may be missing from older tables
  { table: "tqiReports", column: "studentParticipation",  ddl: "`studentParticipation` TEXT" },
  { table: "tqiReports", column: "volunteerParticipation", ddl: "`volunteerParticipation` TEXT" },
  { table: "tqiReports", column: "challengesFaced",       ddl: "`challengesFaced` TEXT" },
  { table: "tqiReports", column: "solutionsProvided",     ddl: "`solutionsProvided` TEXT" },
  { table: "tqiReports", column: "futureActionPlan",      ddl: "`futureActionPlan` TEXT" },
  { table: "tqiReports", column: "keyLearningOutcomes",   ddl: "`keyLearningOutcomes` TEXT" },
  { table: "tqiReports", column: "spocName",              ddl: "`spocName` VARCHAR(255)" },
  { table: "tqiReports", column: "academicYear",          ddl: "`academicYear` VARCHAR(255)" },
  { table: "tqiReports", column: "beneficiaries",         ddl: "`beneficiaries` INT DEFAULT 0" },
  { table: "tqiReports", column: "totalVolunteers",       ddl: "`totalVolunteers` INT DEFAULT 0" },
  { table: "tqiReports", column: "submittedBy",           ddl: "`submittedBy` VARCHAR(255)" },
  { table: "tqiReports", column: "submittedAt",           ddl: "`submittedAt` DATETIME" },
  { table: "tqiReports", column: "pdfGeneratedAt",        ddl: "`pdfGeneratedAt` DATETIME" },
  { table: "tqiReports", column: "updatedAt",             ddl: "`updatedAt` DATETIME" },
  { table: "tqiReports", column: "remarks",               ddl: "`remarks` TEXT" },
  { table: "tqiReports", column: "photos",                ddl: "`photos` JSON" },
  // advances — cluster tracking
  { table: "advances", column: "clusterId",    ddl: "`clusterId` VARCHAR(64)" },
  { table: "advances", column: "clusterName",  ddl: "`clusterName` VARCHAR(255)" },
  { table: "advances", column: "releasedBy",   ddl: "`releasedBy` VARCHAR(255)" },
  // expenses — full finance entry columns
  { table: "expenses", column: "sessionDay",        ddl: "`sessionDay` INT" },
  { table: "expenses", column: "clusterId",         ddl: "`clusterId` VARCHAR(64)" },
  { table: "expenses", column: "clusterName",       ddl: "`clusterName` VARCHAR(255)" },
  { table: "expenses", column: "collegeName",       ddl: "`collegeName` VARCHAR(255)" },
  { table: "expenses", column: "financerName",      ddl: "`financerName` VARCHAR(255)" },
  { table: "expenses", column: "spocName",          ddl: "`spocName` VARCHAR(255)" },
  { table: "expenses", column: "volunteerCount",    ddl: "`volunteerCount` INT" },
  { table: "expenses", column: "travelEntries",     ddl: "`travelEntries` JSON" },
  { table: "expenses", column: "foodEntries",       ddl: "`foodEntries` JSON" },
  { table: "expenses", column: "stationeryAmount",  ddl: "`stationeryAmount` DECIMAL(12,2)" },
  { table: "expenses", column: "stationeryBills",   ddl: "`stationeryBills` JSON" },
  { table: "expenses", column: "stationeryEntries", ddl: "`stationeryEntries` JSON" },
  { table: "expenses", column: "otherEntries",      ddl: "`otherEntries` JSON" },
  { table: "expenses", column: "sessionName",       ddl: "`sessionName` VARCHAR(255)" },
  { table: "expenses", column: "grandTotal",        ddl: "`grandTotal` DECIMAL(12,2)" },
  { table: "expenses", column: "balance",           ddl: "`balance` DECIMAL(12,2)" },
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
