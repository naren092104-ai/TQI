import { Router } from "express";
import { body, param } from "express-validator";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { query, execute } from "../db.js";
import { getResourceConfig } from "../resources.js";
import { handleValidationErrors } from "../middleware/validators.js";
import { authenticateToken, canCreateStudent, canEditStudent, canDeleteStudent } from "../middleware/auth.js";

export const resourceRouter = Router();
resourceRouter.use(authenticateToken);

function quoteIdentifier(identifier: string) {
  return `\`` + identifier.replace(/`/g, "``") + `\``;
}

function quoteColumns(columns: string[]) {
  return columns.map(quoteIdentifier).join(", ");
}

function bindValue(value: unknown, isJson = false) {
  if (value === undefined) return null;
  if (isJson && value !== null) return JSON.stringify(value);
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 19).replace("T", " ");
  }
  return value;
}

function normalizeRow(row: Record<string, any>, resource: string, config: ReturnType<typeof getResourceConfig>) {
  if (!row) return row;
  const normalizedRow = { ...row };

  if (resource === "clusters") {
    normalizedRow.name = normalizedRow.name ?? normalizedRow.clusterName ?? "";
    normalizedRow.district = normalizedRow.district ?? normalizedRow.districtName ?? "";
    normalizedRow.code = normalizedRow.code ?? `CL-${String(normalizedRow.id ?? "").slice(0, 8)}`;
    normalizedRow.state = normalizedRow.state ?? "Gujarat";
    normalizedRow.lead = normalizedRow.lead ?? "";
    if (normalizedRow.status === "ACTIVE") normalizedRow.status = "Active";
    if (normalizedRow.status === "INACTIVE") normalizedRow.status = "Inactive";
  }

  if (resource === "schools") {
    normalizedRow.name = normalizedRow.name ?? normalizedRow.schoolName ?? "";
    normalizedRow.type = normalizedRow.type ?? "Primary";
    normalizedRow.principal = normalizedRow.principal ?? normalizedRow.schoolCode ?? "";
    normalizedRow.villageId = normalizedRow.villageId ?? "";
  }

  if (resource === "students") {
    normalizedRow.rollNo = normalizedRow.rollNo ?? `R${String(normalizedRow.id ?? "").slice(-6)}`;
    normalizedRow.grade = normalizedRow.grade ?? normalizedRow.standard ?? "";
    normalizedRow.phone = normalizedRow.phone ?? normalizedRow.mobileNumber ?? "";
    normalizedRow.gender = normalizedRow.gender ?? "M";
    normalizedRow.guardian = normalizedRow.guardian ?? "Guardian";
  }

  if (resource === "volunteers") {
    normalizedRow.phone = normalizedRow.phone ?? normalizedRow.mobile ?? "";
    normalizedRow.skill = normalizedRow.skill ?? normalizedRow.department ?? "General";
    normalizedRow.sessions = normalizedRow.sessions ?? 0;
  }

  if (resource === "colleges") {
    normalizedRow.name = normalizedRow.name ?? normalizedRow.collegeName ?? "";
    normalizedRow.city = normalizedRow.city ?? "";
    normalizedRow.affiliated = normalizedRow.affiliated ?? "";
  }

  for (const key of Object.keys(normalizedRow)) {
    if (normalizedRow[key] === 0 || normalizedRow[key] === 1) {
      if (["active", "archived", "read"].includes(key)) {
        normalizedRow[key] = Boolean(normalizedRow[key]);
      }
    }
  }

  if (config?.jsonColumns) {
    config.jsonColumns.forEach((col) => {
      if (typeof normalizedRow[col] === "string") {
        try {
          normalizedRow[col] = JSON.parse(normalizedRow[col]);
        } catch {
          normalizedRow[col] = normalizedRow[col];
        }
      }
    });
  }

  if (resource === "admins") {
    delete normalizedRow.password;
  }

  return normalizedRow;
}

resourceRouter.get("/:resource", async (req, res) => {
  const resource = req.params.resource;
  const config = getResourceConfig(resource);
  if (!config) return res.status(404).json({ error: "Resource not found" });

  const rows = await query(`SELECT * FROM ${quoteIdentifier(config.table)}`);
  const normalized = rows.map((row) => normalizeRow(row as Record<string, any>, resource, config));
  res.json(normalized);
});

resourceRouter.post(
  "/:resource",
  body("id").optional().isString(),
  body("createdAt").optional().isISO8601(),
  handleValidationErrors,
  async (req, res) => {
    try {
    const resource = req.params.resource;
    
    // Permission check for student creation
    if (resource === "students" && !canCreateStudent(req.user)) {
      return res.status(403).json({ error: "Only admins can create students" });
    }

    const config = getResourceConfig(resource);
    if (!config) return res.status(404).json({ error: "Resource not found" });

    const payload = req.body as Record<string, unknown>;
    const recordId = (typeof payload.id === "string" && payload.id) || randomUUID();
    const now = new Date().toISOString();
    const insertPayload = { ...payload, id: recordId };

    if (config.columns.includes("createdAt") && !insertPayload.createdAt) {
      insertPayload.createdAt = now;
    }
    if (resource === "admins" && typeof insertPayload.password === "string") {
      insertPayload.password = await bcrypt.hash(insertPayload.password, 10);
    }

    const columns = config.columns;
    const values = columns.map((column) =>
      bindValue(insertPayload[column], config.jsonColumns?.includes(column) ?? false),
    );
    const placeholders = columns.map(() => "?").join(", ");

    const sql = `INSERT INTO ${quoteIdentifier(config.table)} (${quoteColumns(columns)}) VALUES (${placeholders})`;
    await execute(sql, values);
    const rows = await query(`SELECT * FROM ${quoteIdentifier(config.table)} WHERE ` + quoteIdentifier("id") + " = ?", [recordId]);
    res.status(201).json(normalizeRow(rows[0] as Record<string, any>, resource, config));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create record" });
    }
  },
);

resourceRouter.put(
  "/:resource/:id",
  param("id").isString(),
  body("createdAt").optional().isISO8601(),
  handleValidationErrors,
  async (req, res) => {
    try {
    const resource = req.params.resource;
    
    // Permission check for student updates
    if (resource === "students" && !canEditStudent(req.user)) {
      return res.status(403).json({ error: "Only admins can edit students" });
    }

    const config = getResourceConfig(resource);
    if (!config) return res.status(404).json({ error: "Resource not found" });

    const payload = req.body as Record<string, unknown>;
    if (resource === "admins" && typeof payload.password === "string") {
      payload.password = await bcrypt.hash(payload.password, 10);
    }
    const updatableColumns = config.columns.filter((column) => {
      if (column === "id") return false;
      if (payload[column] === undefined) return false;
      if (resource === "admins" && column === "password" && payload.password === undefined) return false;
      return true;
    });
    const assignments = updatableColumns.map((column) => `${quoteIdentifier(column)} = ?`).join(", ");
    const values = updatableColumns.map((column) =>
      bindValue(payload[column], config.jsonColumns?.includes(column) ?? false),
    );

    if (updatableColumns.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const sql = `UPDATE ${quoteIdentifier(config.table)} SET ${assignments} WHERE ` + quoteIdentifier("id") + " = ?";
    const result = await execute(sql, [...values, req.params.id]);

    if ((result as { affectedRows?: number }).affectedRows === 0) {
      const insertPayload = { ...payload, id: req.params.id };
      if (config.columns.includes("createdAt") && !insertPayload.createdAt) {
        insertPayload.createdAt = new Date().toISOString();
      }
      const insertColumns = config.columns;
      const insertValues = insertColumns.map((column) =>
        bindValue(insertPayload[column], config.jsonColumns?.includes(column) ?? false),
      );
      const insertSql = `INSERT INTO ${quoteIdentifier(config.table)} (${quoteColumns(insertColumns)}) VALUES (${insertColumns.map(() => "?").join(", ")})`;
      await execute(insertSql, insertValues);
    }

    const rows = await query(`SELECT * FROM ${quoteIdentifier(config.table)} WHERE ` + quoteIdentifier("id") + " = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Record not found" });
    res.json(normalizeRow(rows[0] as Record<string, any>, resource, config));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update record" });
    }
  },
);

resourceRouter.patch(
  "/:resource/:id",
  param("id").isString(),
  handleValidationErrors,
  async (req, res) => {
    try {
    const resource = req.params.resource;
    
    // Permission check for student updates
    if (resource === "students" && !canEditStudent(req.user)) {
      return res.status(403).json({ error: "Only admins can edit students" });
    }

    const config = getResourceConfig(resource);
    if (!config) return res.status(404).json({ error: "Resource not found" });

    const payload = req.body as Record<string, unknown>;
    const patchColumns = Object.keys(payload).filter((key) => config.columns.includes(key));
    if (patchColumns.length === 0) return res.status(400).json({ error: "No valid fields to update" });

    const assignments = patchColumns.map((column) => `${quoteIdentifier(column)} = ?`).join(", ");
    const values = patchColumns.map((column) =>
      bindValue(payload[column], config.jsonColumns?.includes(column) ?? false),
    );
    await execute(`UPDATE ${quoteIdentifier(config.table)} SET ${assignments} WHERE ` + quoteIdentifier("id") + " = ?", [...values, req.params.id]);
    const rows = await query(`SELECT * FROM ${quoteIdentifier(config.table)} WHERE ` + quoteIdentifier("id") + " = ?", [req.params.id]);
    res.json(normalizeRow(rows[0] as Record<string, any>, resource, config));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to patch record" });
    }
  },
);

resourceRouter.delete("/:resource/:id", async (req, res) => {
  const resource = req.params.resource;
  
  // Permission check for student deletion
  if (resource === "students" && !canDeleteStudent(req.user)) {
    return res.status(403).json({ error: "Only admins can delete students" });
  }

  const config = getResourceConfig(resource);
  if (!config) return res.status(404).json({ error: "Resource not found" });

  await execute(`DELETE FROM ${quoteIdentifier(config.table)} WHERE ` + quoteIdentifier("id") + " = ?", [req.params.id]);
  res.status(204).send();
});

// Helper endpoints for autofill flows
resourceRouter.get('/academicYears/active', async (_req, res) => {
  const rows = await query('SELECT * FROM academicYears WHERE active = 1 LIMIT 1');
  if (!rows[0]) return res.status(404).json({ error: 'No active academic year found' });
  const cfg = getResourceConfig('academicYears');
  res.json(normalizeRow(rows[0] as Record<string, any>, 'academicYears', cfg));
});

resourceRouter.get('/clusters/:id/panchayats', async (req, res) => {
  const clusterId = req.params.id;
  const rows = await query('SELECT * FROM panchayats WHERE clusterId = ?', [clusterId]);
  const cfg = getResourceConfig('panchayats');
  res.json(rows.map((r: any) => normalizeRow(r, 'panchayats', cfg)));
});

resourceRouter.get('/panchayats/:id/villages', async (req, res) => {
  const panchayatId = req.params.id;
  const rows = await query('SELECT * FROM villages WHERE panchayatId = ?', [panchayatId]);
  const cfg = getResourceConfig('villages');
  res.json(rows.map((r: any) => normalizeRow(r, 'villages', cfg)));
});

resourceRouter.get('/villages/:id/schools', async (req, res) => {
  const villageId = req.params.id;
  const rows = await query('SELECT * FROM schools WHERE villageId = ?', [villageId]);
  const cfg = getResourceConfig('schools');
  res.json(rows.map((r: any) => normalizeRow(r, 'schools', cfg)));
});

resourceRouter.get('/schools/:id/details', async (req, res) => {
  const id = req.params.id;
  const rows = await query('SELECT * FROM schools WHERE id = ? LIMIT 1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'School not found' });
  const school = normalizeRow(rows[0] as Record<string, any>, 'schools', getResourceConfig('schools'));

  const villageRows = school.villageId ? await query('SELECT * FROM villages WHERE id = ? LIMIT 1', [school.villageId]) : [];
  const village = villageRows[0] ? normalizeRow(villageRows[0] as Record<string, any>, 'villages', getResourceConfig('villages')) : null;

  const panchayat = village?.panchayatId ? (await query('SELECT * FROM panchayats WHERE id = ? LIMIT 1', [village.panchayatId]))[0] : null;
  const normalizedPanchayat = panchayat ? normalizeRow(panchayat as Record<string, any>, 'panchayats', getResourceConfig('panchayats')) : null;

  const cluster = normalizedPanchayat?.clusterId ? (await query('SELECT * FROM clusters WHERE id = ? LIMIT 1', [normalizedPanchayat.clusterId]))[0] : null;
  const normalizedCluster = cluster ? normalizeRow(cluster as Record<string, any>, 'clusters', getResourceConfig('clusters')) : null;

  res.json({ school, village, panchayat: normalizedPanchayat, cluster: normalizedCluster });
});

resourceRouter.get('/sessions/:id/details', async (req, res) => {
  const id = req.params.id;
  const rows = await query('SELECT * FROM sessions WHERE id = ? LIMIT 1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
  const session = normalizeRow(rows[0] as Record<string, any>, 'sessions', getResourceConfig('sessions'));
  // attach active academic year
  const ay = (await query('SELECT * FROM academicYears WHERE active = 1 LIMIT 1'))[0] || null;
  const academicYear = ay ? normalizeRow(ay as Record<string, any>, 'academicYears', getResourceConfig('academicYears')) : null;
  res.json({ session, academicYear });
});

resourceRouter.get('/sessions/:id/volunteers', async (req, res) => {
  const sessionId = req.params.id;
  const srows = await query('SELECT * FROM sessions WHERE id = ? LIMIT 1', [sessionId]);
  if (!srows[0]) return res.status(404).json({ error: 'Session not found' });
  const session = srows[0] as any;
  // Fallback: return volunteers in same cluster as session
  const rows = session.clusterId ? await query('SELECT * FROM volunteers WHERE clusterId = ?', [session.clusterId]) : await query('SELECT * FROM volunteers');
  const cfg = getResourceConfig('volunteers');
  res.json(rows.map((r: any) => normalizeRow(r, 'volunteers', cfg)));
});

resourceRouter.get('/me', async (req, res) => {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const rows = await query('SELECT id, name, email, username, phone, role, clusterId FROM admins WHERE id = ? LIMIT 1', [user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

async function fetchSchoolHierarchy(schoolId: string) {
  const schoolRows = await query('SELECT * FROM schools WHERE id = ? LIMIT 1', [schoolId]);
  if (!schoolRows[0]) return null;
  const school = normalizeRow(schoolRows[0] as Record<string, any>, 'schools', getResourceConfig('schools'));
  const villageRows = school.villageId ? await query('SELECT * FROM villages WHERE id = ? LIMIT 1', [school.villageId]) : [];
  const village = villageRows[0]
    ? normalizeRow(villageRows[0] as Record<string, any>, 'villages', getResourceConfig('villages'))
    : null;
  const panchayatRows = village?.panchayatId
    ? await query('SELECT * FROM panchayats WHERE id = ? LIMIT 1', [village.panchayatId])
    : [];
  const panchayat = panchayatRows[0]
    ? normalizeRow(panchayatRows[0] as Record<string, any>, 'panchayats', getResourceConfig('panchayats'))
    : null;
  const clusterRows = panchayat?.clusterId
    ? await query('SELECT * FROM clusters WHERE id = ? LIMIT 1', [panchayat.clusterId])
    : [];
  const cluster = clusterRows[0]
    ? normalizeRow(clusterRows[0] as Record<string, any>, 'clusters', getResourceConfig('clusters'))
    : null;
  return { school, village, panchayat, cluster };
}

resourceRouter.get('/finance/report', async (req, res) => {
  const sessionId = String(req.query.sessionId || "");
  const schoolId = req.query.schoolId ? String(req.query.schoolId) : undefined;
  if (!sessionId) return res.status(400).json({ error: 'sessionId query param is required' });

  const sessionRows = await query('SELECT * FROM sessions WHERE id = ? LIMIT 1', [sessionId]);
  if (!sessionRows[0]) return res.status(404).json({ error: 'Session not found' });
  const session = normalizeRow(sessionRows[0] as Record<string, any>, 'sessions', getResourceConfig('sessions'));
  const academicYearRows = await query('SELECT * FROM academicYears WHERE active = 1 LIMIT 1');
  const academicYear = academicYearRows[0]
    ? normalizeRow(academicYearRows[0] as Record<string, any>, 'academicYears', getResourceConfig('academicYears'))
    : null;
  const volunteerRows = session.clusterId
    ? await query('SELECT * FROM volunteers WHERE clusterId = ?', [session.clusterId])
    : await query('SELECT * FROM volunteers');
  const volunteers = volunteerRows.map((r: any) => normalizeRow(r, 'volunteers', getResourceConfig('volunteers')));
  const user = (req as any).user;
  const userInfoRows = user?.id
    ? await query('SELECT id, name, email, username, phone, role, clusterId FROM admins WHERE id = ? LIMIT 1', [user.id])
    : [];
  const userInfo = userInfoRows[0] || null;
  const schoolHierarchy = schoolId ? await fetchSchoolHierarchy(schoolId) : null;

  const expensesRows = await query('SELECT * FROM expenses WHERE status != ? OR status IS NULL', ['Rejected']);
  const expenses = expensesRows.map((r: any) => normalizeRow(r, 'expenses', getResourceConfig('expenses')));
  const totals = {
    travelTotal: expenses.filter((e) => e.category === 'Travel').reduce((a: number, b: any) => a + Number(b.amount || 0), 0),
    foodTotal: expenses.filter((e) => e.category === 'Food').reduce((a: number, b: any) => a + Number(b.amount || 0), 0),
    otherTotal: expenses.filter((e) => e.category === 'Other').reduce((a: number, b: any) => a + Number(b.amount || 0), 0),
    grandTotal: expenses.reduce((a: number, b: any) => a + Number(b.amount || 0), 0),
    volunteerCount: volunteers.length,
  };

  res.json({ session, academicYear, volunteers, userInfo, schoolHierarchy, totals, expenses });
});

resourceRouter.post('/finance/bill-link', async (req, res) => {
  const { expenseId, bill } = req.body as { expenseId: string; bill: { name: string; url: string; originalUrl?: string; type: string } };
  if (!expenseId || !bill) return res.status(400).json({ error: 'expenseId and bill are required' });

  const rows = await query('SELECT * FROM expenses WHERE id = ? LIMIT 1', [expenseId]);
  if (!rows[0]) return res.status(404).json({ error: 'Expense not found' });
  const expense = normalizeRow(rows[0] as Record<string, any>, 'expenses', getResourceConfig('expenses'));
  const existingBills = Array.isArray(expense.bills) ? expense.bills : [];
  const updatedBills = [...existingBills, bill];
  await execute('UPDATE expenses SET bills = ? WHERE id = ?', [JSON.stringify(updatedBills), expenseId]);
  const updatedExpenseRows = await query('SELECT * FROM expenses WHERE id = ? LIMIT 1', [expenseId]);
  res.json(normalizeRow(updatedExpenseRows[0] as Record<string, any>, 'expenses', getResourceConfig('expenses')));
});

resourceRouter.post('/finance/pdf', async (req, res) => {
  const { sessionId, schoolId, expenses = [], bills = [] } = req.body as {
    sessionId: string;
    schoolId?: string;
    expenses?: any[];
    bills?: any[];
  };
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  const sessionRows = await query('SELECT * FROM sessions WHERE id = ? LIMIT 1', [sessionId]);
  if (!sessionRows[0]) return res.status(404).json({ error: 'Session not found' });
  const session = normalizeRow(sessionRows[0] as Record<string, any>, 'sessions', getResourceConfig('sessions'));
  const academicYearRows = await query('SELECT * FROM academicYears WHERE active = 1 LIMIT 1');
  const academicYear = academicYearRows[0]
    ? normalizeRow(academicYearRows[0] as Record<string, any>, 'academicYears', getResourceConfig('academicYears'))
    : null;
  const schoolHierarchy = schoolId ? await fetchSchoolHierarchy(schoolId) : null;
  const user = (req as any).user;
  const userInfoRows = user?.id
    ? await query('SELECT id, name, email, username, phone, role, clusterId FROM admins WHERE id = ? LIMIT 1', [user.id])
    : [];
  const userInfo = userInfoRows[0] || null;

  const report = {
    academicYear,
    session,
    userInfo,
    schoolHierarchy,
    expenses,
    bills,
    generatedAt: new Date().toISOString(),
  };

  res.json(report);
});

// Bulk import endpoint for students
resourceRouter.post('/students/bulk-import', body("records").isArray(), handleValidationErrors, async (req, res) => {
  try {
    // Permission check
    if (!canCreateStudent(req.user)) {
      return res.status(403).json({ error: "Only admins can create students" });
    }

    const records = req.body.records as Array<Record<string, unknown>>;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "No records to import" });
    }

    const config = getResourceConfig("students");
    if (!config) return res.status(404).json({ error: "Resource not found" });

    const now = new Date().toISOString();
    const importedStudents: Array<Record<string, any>> = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < records.length; i++) {
      try {
        const record = records[i];
        const recordId = randomUUID();
        
        // Prepare student data with auto-fill hierarchy
        let schoolId = record.schoolId as string;
        let villageId: string | null = null;
        let panchayatId: string | null = null;
        let clusterId: string | null = null;

        if (schoolId) {
          const hierarchy = await fetchSchoolHierarchy(schoolId);
          if (hierarchy) {
            villageId = hierarchy.village?.id || null;
            panchayatId = hierarchy.panchayat?.id || null;
            clusterId = hierarchy.cluster?.id || null;
          }
        }

        const insertPayload = {
          id: recordId,
          name: record.name,
          rollNo: record.rollNo || `R${String(recordId).slice(-6)}`,
          schoolId: schoolId || null,
          villageId,
          panchayatId,
          clusterId,
          grade: record.grade || "5",
          gender: record.gender || "M",
          dob: record.dob || null,
          parentName: record.parentName || null,
          parentPhone: record.parentPhone || null,
          guardian: record.guardian || "Guardian",
          phone: record.phone || "",
          address: record.address || null,
          status: record.status || "Active",
          createdAt: now,
          updatedAt: now,
        };

        const columns = config.columns;
        const values = columns.map((column) => bindValue(insertPayload[column] || null));
        const placeholders = columns.map(() => "?").join(", ");

        const sql = `INSERT INTO ${quoteIdentifier(config.table)} (${quoteColumns(columns)}) VALUES (${placeholders})`;
        await execute(sql, values);

        const createdRows = await query(`SELECT * FROM ${quoteIdentifier(config.table)} WHERE id = ?`, [recordId]);
        if (createdRows[0]) {
          importedStudents.push(normalizeRow(createdRows[0] as Record<string, any>, "students", config));
        }
      } catch (error) {
        errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    res.status(201).json({
      imported: importedStudents.length,
      total: records.length,
      students: importedStudents,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to import students" });
  }
});
