import { query } from "../src/db.js";

const tables = ["admins", "panchayats", "villages", "schools", "clusters", "academicYears", "academicyears", "students", "volunteers"];

for (const table of tables) {
  try {
    const rows = await query<any>(`DESCRIBE \`${table}\``);
    console.log(`\n=== ${table} ===`);
    for (const row of rows) console.log(`  ${row.Field}: ${row.Type}`);
  } catch (error: any) {
    console.log(`\n=== ${table} === ERROR: ${error.message}`);
  }
}

process.exit(0);
