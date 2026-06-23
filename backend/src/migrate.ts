import { query, execute } from "./db.js";

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function addColumn(table: string, ddl: string) {
  await execute(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
}

async function migrateClusters() {
  if (!(await columnExists("clusters", "clusterName"))) return;

  if (!(await columnExists("clusters", "name"))) await addColumn("clusters", "`name` VARCHAR(255)");
  if (!(await columnExists("clusters", "district"))) await addColumn("clusters", "`district` VARCHAR(255)");
  if (!(await columnExists("clusters", "code"))) await addColumn("clusters", "`code` VARCHAR(64)");
  if (!(await columnExists("clusters", "state"))) await addColumn("clusters", "`state` VARCHAR(255)");
  if (!(await columnExists("clusters", "lead"))) await addColumn("clusters", "`lead` VARCHAR(255)");

  await execute("UPDATE `clusters` SET `name` = `clusterName` WHERE (`name` IS NULL OR `name` = '') AND `clusterName` IS NOT NULL");
  await execute("UPDATE `clusters` SET `district` = `districtName` WHERE (`district` IS NULL OR `district` = '') AND `districtName` IS NOT NULL");
  await execute("UPDATE `clusters` SET `code` = CONCAT('CL-', LEFT(`id`, 8)) WHERE `code` IS NULL OR `code` = ''");
  await execute("UPDATE `clusters` SET `state` = 'Gujarat' WHERE `state` IS NULL OR `state` = ''");
  await execute("UPDATE `clusters` SET `lead` = '' WHERE `lead` IS NULL");
  await execute("ALTER TABLE `clusters` MODIFY `status` VARCHAR(64)");
  await execute("UPDATE `clusters` SET `status` = 'Active' WHERE `status` = 'ACTIVE'");
  await execute("UPDATE `clusters` SET `status` = 'Inactive' WHERE `status` = 'INACTIVE'");
}

async function migrateHierarchyFromSchools() {
  if (!(await columnExists("schools", "schoolName"))) return;

  const schools = await query<any>("SELECT * FROM `schools`");
  const panchayatIds = new Map<string, string>();
  const villageIds = new Map<string, string>();

  for (const school of schools) {
    const clusterId = school.clusterId;
    const panchayatName = school.panchayat;
    const villageName = school.village;
    if (!clusterId || !panchayatName || !villageName) continue;

    const pKey = `${clusterId}::${panchayatName}`;
    if (!panchayatIds.has(pKey)) {
      const existing = await query<any>(
        "SELECT id FROM `panchayats` WHERE `clusterId` = ? AND `name` = ? LIMIT 1",
        [clusterId, panchayatName],
      );
      if (existing[0]?.id) {
        panchayatIds.set(pKey, existing[0].id);
      } else {
        const pId = `p-${clusterId.slice(0, 8)}-${panchayatIds.size + 1}`;
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        await execute(
          "INSERT INTO `panchayats` (`id`, `name`, `clusterId`, `head`, `createdAt`) VALUES (?, ?, ?, ?, ?)",
          [pId, panchayatName, clusterId, "", now],
        );
        panchayatIds.set(pKey, pId);
      }
    }

    const panchayatId = panchayatIds.get(pKey)!;
    const vKey = `${panchayatId}::${villageName}`;
    if (!villageIds.has(vKey)) {
      const existing = await query<any>(
        "SELECT id FROM `villages` WHERE `panchayatId` = ? AND `name` = ? LIMIT 1",
        [panchayatId, villageName],
      );
      if (existing[0]?.id) {
        villageIds.set(vKey, existing[0].id);
      } else {
        const vId = `v-${panchayatId.slice(0, 8)}-${villageIds.size + 1}`;
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        await execute(
          "INSERT INTO `villages` (`id`, `name`, `panchayatId`, `population`, `createdAt`) VALUES (?, ?, ?, ?, ?)",
          [vId, villageName, panchayatId, 1000, now],
        );
        villageIds.set(vKey, vId);
      }
    }
  }
}

async function migrateSchools() {
  if (!(await columnExists("schools", "schoolName"))) return;

  if (!(await columnExists("schools", "name"))) await addColumn("schools", "`name` VARCHAR(255)");
  if (!(await columnExists("schools", "villageId"))) await addColumn("schools", "`villageId` VARCHAR(64)");
  if (!(await columnExists("schools", "type"))) await addColumn("schools", "`type` VARCHAR(64)");
  if (!(await columnExists("schools", "principal"))) await addColumn("schools", "`principal` VARCHAR(255)");

  await execute("UPDATE `schools` SET `name` = `schoolName` WHERE (`name` IS NULL OR `name` = '') AND `schoolName` IS NOT NULL");
  await execute("UPDATE `schools` SET `type` = 'Primary' WHERE `type` IS NULL OR `type` = ''");
  await execute("UPDATE `schools` SET `principal` = COALESCE(`schoolCode`, '') WHERE `principal` IS NULL");

  const schools = await query<any>("SELECT * FROM `schools`");
  for (const school of schools) {
    if (school.villageId) continue;
    const panchayat = await query<any>(
      "SELECT id FROM `panchayats` WHERE `clusterId` = ? AND `name` = ? LIMIT 1",
      [school.clusterId, school.panchayat],
    );
    if (!panchayat[0]?.id) continue;
    const village = await query<any>(
      "SELECT id FROM `villages` WHERE `panchayatId` = ? AND `name` = ? LIMIT 1",
      [panchayat[0].id, school.village],
    );
    if (village[0]?.id) {
      await execute("UPDATE `schools` SET `villageId` = ? WHERE `id` = ?", [village[0].id, school.id]);
    }
  }
}

async function migrateStudents() {
  if (!(await columnExists("students", "mobileNumber"))) return;

  if (!(await columnExists("students", "rollNo"))) await addColumn("students", "`rollNo` VARCHAR(64)");
  if (!(await columnExists("students", "grade"))) await addColumn("students", "`grade` VARCHAR(64)");
  if (!(await columnExists("students", "gender"))) await addColumn("students", "`gender` VARCHAR(8)");
  if (!(await columnExists("students", "guardian"))) await addColumn("students", "`guardian` VARCHAR(255)");
  if (!(await columnExists("students", "phone"))) await addColumn("students", "`phone` VARCHAR(64)");

  await execute("UPDATE `students` SET `rollNo` = CONCAT('R', RIGHT(`id`, 6)) WHERE `rollNo` IS NULL OR `rollNo` = ''");
  await execute("UPDATE `students` SET `grade` = `standard` WHERE (`grade` IS NULL OR `grade` = '') AND `standard` IS NOT NULL");
  await execute("UPDATE `students` SET `phone` = `mobileNumber` WHERE (`phone` IS NULL OR `phone` = '') AND `mobileNumber` IS NOT NULL");
  await execute("UPDATE `students` SET `gender` = 'M' WHERE `gender` IS NULL OR `gender` = ''");
  await execute("UPDATE `students` SET `guardian` = 'Guardian' WHERE `guardian` IS NULL OR `guardian` = ''");
}

async function migrateVolunteers() {
  if (!(await columnExists("volunteers", "mobile"))) return;

  if (!(await columnExists("volunteers", "phone"))) await addColumn("volunteers", "`phone` VARCHAR(64)");
  if (!(await columnExists("volunteers", "skill"))) await addColumn("volunteers", "`skill` VARCHAR(255)");
  if (!(await columnExists("volunteers", "sessions"))) await addColumn("volunteers", "`sessions` INT DEFAULT 0");

  await execute("UPDATE `volunteers` SET `phone` = `mobile` WHERE (`phone` IS NULL OR `phone` = '') AND `mobile` IS NOT NULL");
  await execute("UPDATE `volunteers` SET `skill` = COALESCE(`department`, 'General') WHERE `skill` IS NULL OR `skill` = ''");
  await execute("UPDATE `volunteers` SET `sessions` = 0 WHERE `sessions` IS NULL");
}

async function migrateColleges() {
  if (!(await columnExists("colleges", "collegeName"))) return;

  if (!(await columnExists("colleges", "name"))) await addColumn("colleges", "`name` VARCHAR(255)");
  if (!(await columnExists("colleges", "city"))) await addColumn("colleges", "`city` VARCHAR(255)");
  if (!(await columnExists("colleges", "affiliated"))) await addColumn("colleges", "`affiliated` VARCHAR(255)");

  await execute("UPDATE `colleges` SET `name` = `collegeName` WHERE (`name` IS NULL OR `name` = '') AND `collegeName` IS NOT NULL");
  await execute("UPDATE `colleges` SET `city` = '' WHERE `city` IS NULL");
  await execute("UPDATE `colleges` SET `affiliated` = '' WHERE `affiliated` IS NULL");
}

export async function runMigrations() {
  await migrateClusters();
  await migrateHierarchyFromSchools();
  await migrateSchools();
  await migrateStudents();
  await migrateVolunteers();
  await migrateColleges();
  console.log("Database migrations applied.");
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runMigrations().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
