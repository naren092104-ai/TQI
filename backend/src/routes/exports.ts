import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { query } from "../db.js";
import { getResourceConfig } from "../resources.js";

export const exportsRouter = Router();
exportsRouter.use(authenticateToken);

// Helper: Fetch school hierarchy
async function fetchSchoolHierarchy(schoolId: string) {
  const schoolRows = await query("SELECT * FROM schools WHERE id = ? LIMIT 1", [schoolId]);
  if (!schoolRows[0]) return null;
  const school = schoolRows[0] as Record<string, any>;

  const villageRows = school.villageId ? await query("SELECT * FROM villages WHERE id = ? LIMIT 1", [school.villageId]) : [];
  const village = villageRows[0] || null;

  const panchayatRows = village?.panchayatId ? await query("SELECT * FROM panchayats WHERE id = ? LIMIT 1", [village.panchayatId]) : [];
  const panchayat = panchayatRows[0] || null;

  const clusterRows = panchayat?.clusterId ? await query("SELECT * FROM clusters WHERE id = ? LIMIT 1", [panchayat.clusterId]) : [];
  const cluster = clusterRows[0] || null;

  return { school, village, panchayat, cluster };
}
function parseJson(value: any) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function ensureDateLabel(session: any, day: string | undefined) {
  if (session?.date) return session.date;
  if (day) return day;
  return "—";
}

function buildAttendanceReportRows(students: any[], attendanceDetails: Record<string, string>, homeworkDetails: Record<string, string>, type: "student" | "volunteer") {
  return students.map((st: any, index: number) => {
    const attendance = attendanceDetails?.[st.id] === "present" ? "Present" : attendanceDetails?.[st.id] === "absent" ? "Absent" : "Pending";
    const homework = type === "student"
      ? homeworkDetails?.[st.id] === "completed" ? "Completed" : homeworkDetails?.[st.id] === "incomplete" ? "Not Completed" : "Pending"
      : "—";

    return {
      sno: index + 1,
      name: st.name || "—",
      rollNo: st.rollNo || "—",
      grade: st.grade || "—",
      school: st.schoolName || st.college || "—",
      village: st.villageName || "—",
      panchayat: st.panchayatName || "—",
      attendance,
      homework,
    };
  });
}

function addTableHeader(doc: PDFDocument, headers: string[], widths: number[], margin: number) {
  doc.font("Helvetica-Bold").fontSize(8);
  let x = margin;
  headers.forEach((header, index) => {
    doc.text(header, x, doc.y, { width: widths[index], align: index === 0 ? "center" : "left" });
    x += widths[index];
  });
  doc.moveDown(0.4);
  doc.font("Helvetica");
}
// ════════════════════════════════════════════════════════════════
// STUDENTS EXPORTS
// ════════════════════════════════════════════════════════════════

exportsRouter.post("/students/pdf", async (req, res) => {
  try {
    const { clusterId, schoolId } = req.body;

    // Fetch students
    let students = await query("SELECT * FROM students WHERE 1=1" + (schoolId ? " AND schoolId = ?" : "") + (clusterId ? " AND clusterId = ?" : ""), 
      [schoolId, clusterId].filter(Boolean));

    // Fetch hierarchy info
    let clusterName = "All Clusters";
    let schoolName = "All Schools";
    if (clusterId) {
      const clusterRows = await query("SELECT name FROM clusters WHERE id = ?", [clusterId]);
      clusterName = clusterRows[0]?.name || "Unknown";
    }
    if (schoolId) {
      const schoolRows = await query("SELECT name FROM schools WHERE id = ?", [schoolId]);
      schoolName = schoolRows[0]?.name || "Unknown";
    }

    // Create PDF
    const doc = new PDFDocument();
    const filename = `students_${new Date().toISOString().split("T")[0]}.pdf`;
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).text("Student List", { align: "center" });
    doc.fontSize(10).text(`Cluster: ${clusterName} | School: ${schoolName}`, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, { align: "center" });
    doc.moveDown();

    // Table
    const pageWidth = doc.page.width;
    const margin = 40;
    const tableWidth = pageWidth - 2 * margin;
    const colWidth = tableWidth / 7;
    
    doc.fontSize(9).font("Helvetica-Bold");
    const headers = ["S.No", "Name", "Gender", "Std", "Village", "School", "Status"];
    let x = margin;
    headers.forEach((h) => {
      doc.text(h, x, doc.y, { width: colWidth, align: "center" });
      x += colWidth;
    });
    
    doc.moveTo(margin, doc.y + 2).lineTo(pageWidth - margin, doc.y + 2).stroke();
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(8);
    students.forEach((st: any, i: number) => {
      if (doc.y > pageWidth - 40) {
        doc.addPage();
      }
      
      x = margin;
      const row = [
        String(i + 1),
        st.name || "—",
        st.gender || "—",
        st.grade || "—",
        st.villageId ? "—" : "—",
        st.schoolId ? "—" : "—",
        st.status || "Active",
      ];
      
      row.forEach((cell, idx) => {
        doc.text(cell, x, doc.y, { width: colWidth, align: idx === 0 ? "center" : "left" });
        x += colWidth;
      });
      doc.moveDown(0.3);
    });

    doc.end();
  } catch (err) {
    console.error("Students PDF error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// Helper: load image buffer from uploads or remote URL
async function loadImageBuffer(url?: string) {
  if (!url) return null;
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const ab = await resp.arrayBuffer();
      return Buffer.from(ab);
    }

    // local uploads path (served at /uploads/*)
    const trimmed = url.replace(/^\//, "");
    // If url begins with uploads/, use as-is; otherwise try to locate under uploads
    const rel = trimmed.startsWith("uploads/") ? trimmed : path.join(config.uploadsDir, trimmed);
    const abs = path.resolve(process.cwd(), rel);
    return await fs.readFile(abs);
  } catch (err) {
    console.warn("Failed to load image:", url, err.message || err);
    return null;
  }
}

exportsRouter.post("/students/excel", async (req, res) => {
  try {
    const { clusterId, schoolId } = req.body;

    let students = await query("SELECT * FROM students WHERE 1=1" + (schoolId ? " AND schoolId = ?" : "") + (clusterId ? " AND clusterId = ?" : ""), 
      [schoolId, clusterId].filter(Boolean));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Students");

    worksheet.columns = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "Student Name", key: "name", width: 20 },
      { header: "Gender", key: "gender", width: 12 },
      { header: "Standard", key: "grade", width: 12 },
      { header: "Village", key: "village", width: 15 },
      { header: "School", key: "school", width: 20 },
      { header: "Status", key: "status", width: 12 },
    ];

    students.forEach((st: any, i: number) => {
      worksheet.addRow({
        sno: i + 1,
        name: st.name || "—",
        gender: st.gender || "—",
        grade: st.grade || "—",
        village: "—",
        school: "—",
        status: st.status || "Active",
      });
    });

    const filename = `students_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Students Excel error:", err);
    res.status(500).json({ error: "Failed to generate Excel" });
  }
});

// ════════════════════════════════════════════════════════════════
// VOLUNTEERS EXPORTS
// ════════════════════════════════════════════════════════════════

exportsRouter.post("/volunteers/pdf", async (req, res) => {
  try {
    const { clusterId } = req.body;

    let volunteers = await query("SELECT * FROM volunteers WHERE 1=1" + (clusterId ? " AND clusterId = ?" : ""), [clusterId].filter(Boolean));

    const doc = new PDFDocument();
    const filename = `volunteers_${new Date().toISOString().split("T")[0]}.pdf`;
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(20).text("Volunteer List", { align: "center" });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, { align: "center" });
    doc.moveDown();

    const pageWidth = doc.page.width;
    const margin = 40;
    const tableWidth = pageWidth - 2 * margin;
    const colWidth = tableWidth / 7;
    
    doc.fontSize(9).font("Helvetica-Bold");
    const headers = ["S.No", "Name", "Dept", "Year", "College", "Mobile", "Status"];
    let x = margin;
    headers.forEach((h) => {
      doc.text(h, x, doc.y, { width: colWidth, align: "center" });
      x += colWidth;
    });
    
    doc.moveTo(margin, doc.y + 2).lineTo(pageWidth - margin, doc.y + 2).stroke();
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(8);
    volunteers.forEach((v: any, i: number) => {
      if (doc.y > pageWidth - 40) {
        doc.addPage();
      }
      
      x = margin;
      const row = [
        String(i + 1),
        v.name || "—",
        v.department || "—",
        v.year || "—",
        v.college || "—",
        v.phone || "—",
        v.status || "Active",
      ];
      
      row.forEach((cell, idx) => {
        doc.text(cell, x, doc.y, { width: colWidth, align: idx === 0 ? "center" : "left" });
        x += colWidth;
      });
      doc.moveDown(0.3);
    });

    doc.end();
  } catch (err) {
    console.error("Volunteers PDF error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

exportsRouter.post("/volunteers/excel", async (req, res) => {
  try {
    const { clusterId } = req.body;

    let volunteers = await query("SELECT * FROM volunteers WHERE 1=1" + (clusterId ? " AND clusterId = ?" : ""), [clusterId].filter(Boolean));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Volunteers");

    worksheet.columns = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "Name", key: "name", width: 20 },
      { header: "Department", key: "department", width: 15 },
      { header: "Year", key: "year", width: 8 },
      { header: "College", key: "college", width: 20 },
      { header: "Mobile", key: "phone", width: 15 },
      { header: "Email", key: "email", width: 20 },
      { header: "Status", key: "status", width: 12 },
    ];

    volunteers.forEach((v: any, i: number) => {
      worksheet.addRow({
        sno: i + 1,
        name: v.name || "—",
        department: v.department || "—",
        year: v.year || "—",
        college: v.college || "—",
        phone: v.phone || "—",
        email: v.email || "—",
        status: v.status || "Active",
      });
    });

    const filename = `volunteers_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Volunteers Excel error:", err);
    res.status(500).json({ error: "Failed to generate Excel" });
  }
});

// ════════════════════════════════════════════════════════════════
// ATTENDANCE EXPORTS
// ════════════════════════════════════════════════════════════════

exportsRouter.post("/attendance/pdf", async (req, res) => {
  try {
    const {
      clusterId,
      sessionId,
      day,
      attendanceType = "student",
    } = req.body as { clusterId?: string; sessionId?: string; day?: string; attendanceType?: string };

    const type = attendanceType === "volunteer" ? "volunteer" : "student";
    const cluster = clusterId ? (await query("SELECT * FROM clusters WHERE id = ? LIMIT 1", [clusterId]))[0] : null;
    const session = sessionId ? (await query("SELECT * FROM sessions WHERE id = ? LIMIT 1", [sessionId]))[0] : null;

    const attendanceWhere = ["type = ?"];
    const attendanceParams: any[] = [type];
    if (clusterId) {
      attendanceWhere.push("clusterId = ?");
      attendanceParams.push(clusterId);
    }
    if (sessionId) {
      attendanceWhere.push("sessionId = ?");
      attendanceParams.push(sessionId);
    }

    const attendanceRow = (await query(`SELECT * FROM attendance WHERE ${attendanceWhere.join(" AND ")} ORDER BY id DESC LIMIT 1`, attendanceParams))[0] || null;
    const homeworkRow = type === "student" && clusterId && sessionId
      ? (await query("SELECT * FROM homework WHERE clusterId = ? AND sessionId = ? ORDER BY id DESC LIMIT 1", [clusterId, sessionId]))[0] || null
      : null;

    const rowsSource = type === "volunteer"
      ? await query(
          `SELECT v.*, v.college AS schoolName, v.year AS grade
          FROM volunteers v
          WHERE 1=1 ${clusterId ? "AND v.clusterId = ?" : ""}
          ORDER BY v.college, v.year, v.name`,
          clusterId ? [clusterId] : [],
        )
      : await query(
          `SELECT s.*, sc.name AS schoolName, v.name AS villageName, p.name AS panchayatName
          FROM students s
          LEFT JOIN schools sc ON sc.id = s.schoolId
          LEFT JOIN villages v ON v.id = sc.villageId
          LEFT JOIN panchayats p ON p.id = v.panchayatId
          WHERE 1=1 ${clusterId ? "AND s.clusterId = ?" : ""}
          ORDER BY p.name, v.name, s.grade, s.name`,
          clusterId ? [clusterId] : [],
        );

    const attendanceDetails = parseJson(attendanceRow?.details) || {};
    const homeworkDetails = parseJson(homeworkRow?.details) || {};
    const rows = buildAttendanceReportRows(rowsSource, attendanceDetails, homeworkDetails, type as "student" | "volunteer");

    const presentCount = rows.filter((r) => r.attendance === "Present").length;
    const absentCount = rows.filter((r) => r.attendance === "Absent").length;
    const pendingCount = rows.filter((r) => r.attendance === "Pending").length;
    const homeworkCompleted = rows.filter((r) => r.homework === "Completed").length;
    const homeworkPending = rows.filter((r) => r.homework === "Not Completed" || r.homework === "Pending").length;

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const filename = `attendance_${new Date().toISOString().split("T")[0]}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(18).text("Attendance Sheet", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(10).text(`Cluster: ${cluster?.name || clusterId || "All"}`);
    doc.text(`Session: ${session?.title || sessionId || "All"}`);
    doc.text(`Day: ${session?.day ?? day ?? "—"}`);
    doc.text(`Date: ${ensureDateLabel(session, day)}`);
    doc.text(`Report Type: ${type === "student" ? "Student Attendance" : "Volunteer Attendance"}`);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`);
    doc.moveDown();

    doc.fontSize(11).font("Helvetica-Bold").text("Summary", { underline: true });
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Total records: ${rows.length}`);
    doc.text(`Present: ${presentCount}`);
    doc.text(`Absent: ${absentCount}`);
    doc.text(`Pending: ${pendingCount}`);
    if (type === "student") {
      doc.text(`Homework completed: ${homeworkCompleted}`);
      doc.text(`Homework pending: ${homeworkPending}`);
    }
    doc.moveDown();

    const headers = type === "student"
      ? ["S.No", "Student Name", "Village", "School", "Std", "Attendance", "Homework"]
      : ["S.No", "Volunteer Name", "College", "Year", "Attendance"];
    const widths = type === "student" ? [30, 140, 90, 90, 40, 60, 70] : [30, 170, 110, 80, 70];

    addTableHeader(doc, headers, widths, 40);

    rows.forEach((row) => {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        addTableHeader(doc, headers, widths, 40);
      }
      let x = 40;
      if (type === "student") {
        const values = [String(row.sno), row.name, row.village, row.school, row.grade, row.attendance, row.homework];
        values.forEach((text, index) => {
          doc.text(text, x, doc.y, { width: widths[index], align: index === 0 ? "center" : "left" });
          x += widths[index];
        });
      } else {
        const values = [String(row.sno), row.name, row.school, row.grade, row.attendance];
        values.forEach((text, index) => {
          doc.text(text, x, doc.y, { width: widths[index], align: index === 0 ? "center" : "left" });
          x += widths[index];
        });
      }
      doc.moveDown(0.45);
    });

    doc.addPage();
    doc.fontSize(10).text("Prepared by:", 40, doc.y);
    doc.text("Approved by:", 320, doc.y);
    doc.moveDown(3);
    doc.text("_______________________________", 40, doc.y, { width: 240 });
    doc.text("_______________________________", 320, doc.y, { width: 240 });

    doc.end();
  } catch (err) {
    console.error("Attendance PDF error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

exportsRouter.post("/attendance/excel", async (req, res) => {
  try {
    const {
      clusterId,
      sessionId,
      day,
      attendanceType = "student",
    } = req.body as { clusterId?: string; sessionId?: string; day?: string; attendanceType?: string };

    const type = attendanceType === "volunteer" ? "volunteer" : "student";
    const cluster = clusterId ? (await query("SELECT * FROM clusters WHERE id = ? LIMIT 1", [clusterId]))[0] : null;
    const session = sessionId ? (await query("SELECT * FROM sessions WHERE id = ? LIMIT 1", [sessionId]))[0] : null;

    const attendanceWhere = ["type = ?"];
    const attendanceParams: any[] = [type];
    if (clusterId) {
      attendanceWhere.push("clusterId = ?");
      attendanceParams.push(clusterId);
    }
    if (sessionId) {
      attendanceWhere.push("sessionId = ?");
      attendanceParams.push(sessionId);
    }

    const attendanceRow = (await query(`SELECT * FROM attendance WHERE ${attendanceWhere.join(" AND ")} ORDER BY id DESC LIMIT 1`, attendanceParams))[0] || null;
    const homeworkRow = type === "student" && clusterId && sessionId
      ? (await query("SELECT * FROM homework WHERE clusterId = ? AND sessionId = ? ORDER BY id DESC LIMIT 1", [clusterId, sessionId]))[0] || null
      : null;

    const rowsSource = type === "volunteer"
      ? await query(
          `SELECT v.*, v.college AS schoolName, v.year AS grade
          FROM volunteers v
          WHERE 1=1 ${clusterId ? "AND v.clusterId = ?" : ""}
          ORDER BY v.college, v.year, v.name`,
          clusterId ? [clusterId] : [],
        )
      : await query(
          `SELECT s.*, sc.name AS schoolName, v.name AS villageName, p.name AS panchayatName
          FROM students s
          LEFT JOIN schools sc ON sc.id = s.schoolId
          LEFT JOIN villages v ON v.id = sc.villageId
          LEFT JOIN panchayats p ON p.id = v.panchayatId
          WHERE 1=1 ${clusterId ? "AND s.clusterId = ?" : ""}
          ORDER BY p.name, v.name, s.grade, s.name`,
          clusterId ? [clusterId] : [],
        );

    const attendanceDetails = parseJson(attendanceRow?.details) || {};
    const homeworkDetails = parseJson(homeworkRow?.details) || {};
    const rows = buildAttendanceReportRows(rowsSource, attendanceDetails, homeworkDetails, type as "student" | "volunteer");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Attendance");

    worksheet.addRow(["Attendance Report"]).font = { bold: true };
    worksheet.mergeCells("A1:G1");
    worksheet.addRow(["Cluster", cluster?.name || clusterId || "All", "Session", session?.title || sessionId || "All", "Day", session?.day ?? day ?? "—"]);
    worksheet.addRow(["Date", ensureDateLabel(session, day), "Report Type", type === "student" ? "Student Attendance" : "Volunteer Attendance"]);
    worksheet.addRow([]);

    const headers = type === "student"
      ? ["S.No", "Student Name", "Village", "School", "Standard", "Attendance", "Homework"]
      : ["S.No", "Volunteer Name", "College", "Year", "Attendance"];
    worksheet.addRow(headers);

    rows.forEach((row) => {
      const rowValues = type === "student"
        ? [row.sno, row.name, row.village, row.school, row.grade, row.attendance, row.homework]
        : [row.sno, row.name, row.school, row.grade, row.attendance];
      worksheet.addRow(rowValues);
    });

    worksheet.columns = type === "student"
      ? [
          { key: "sno", width: 6 },
          { key: "name", width: 24 },
          { key: "village", width: 18 },
          { key: "school", width: 22 },
          { key: "grade", width: 10 },
          { key: "attendance", width: 14 },
          { key: "homework", width: 16 },
        ]
      : [
          { key: "sno", width: 6 },
          { key: "name", width: 28 },
          { key: "school", width: 26 },
          { key: "grade", width: 10 },
          { key: "attendance", width: 14 },
        ];

    const headerRow = worksheet.getRow(5);
    headerRow.font = { bold: true };

    const filename = `attendance_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Attendance Excel error:", err);
    res.status(500).json({ error: "Failed to generate Excel" });
  }
});

// ════════════════════════════════════════════════════════════════
// FINANCE EXPORTS
// ════════════════════════════════════════════════════════════════

exportsRouter.post("/finance/pdf", async (req, res) => {
  try {
    const { clusterId, sessionId, expenseIds = [] } = req.body;
    const whereClauses: string[] = ["1=1"];
    const queryParams: any[] = [];

    if (clusterId) {
      whereClauses.push("clusterId = ?");
      queryParams.push(clusterId);
    }
    if (sessionId) {
      whereClauses.push("sessionId = ?");
      queryParams.push(sessionId);
    }
    if (Array.isArray(expenseIds) && expenseIds.length > 0) {
      whereClauses.push(`id IN (${expenseIds.map(() => "?").join(",")})`);
      queryParams.push(...expenseIds);
    }

    const expenses = await query(`SELECT * FROM expenses WHERE ${whereClauses.join(" AND ")}`, queryParams);
    if (!expenses.length) {
      return res.status(404).json({ error: "No finance records found for the selected filter." });
    }

    function parseJsonArray(value: any) {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        try { return JSON.parse(value); } catch { return []; }
      }
      return [];
    }

    function formatAmount(value: any) {
      return Number(value || 0);
    }

    function formatAmountLabel(value: any) {
      return `₹${(Number(value) || 0).toLocaleString("en-IN")}`;
    }

    function formatDateLabel(value: any) {
      if (!value) return "—";
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
    }

    function sanitizeFilename(value: string) {
      return String(value || "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "_");
    }

    const firstExpense: any = expenses[0];
    const academicYears = await query("SELECT name FROM academicYears WHERE active = 1 LIMIT 1", []);
    const academicYear = academicYears[0]?.name || "—";
    const clusterName = firstExpense?.clusterName || "—";
    const collegeName = firstExpense?.collegeName || "—";
    const spocName = firstExpense?.spocName || firstExpense?.submittedBy || "—";
    const financerName = firstExpense?.financerName || "—";
    const exportDate = formatDateLabel(firstExpense?.date || new Date().toISOString());

    const sessionDays = Array.from(new Set(expenses.map((exp: any) => Number(exp.sessionDay)).filter((day: number) => day > 0))).sort((a: number, b: number) => a - b);
    const sessionDayLabel = sessionDays.length === 0
      ? "Day —"
      : sessionDays.length === 1
        ? `Day ${sessionDays[0]}`
        : `Day ${sessionDays[0]} - Day ${sessionDays[sessionDays.length - 1]}`;

    const filename = `TQI_Finance_${sanitizeFilename(clusterName)}_${sanitizeFilename(sessionDayLabel)}_${exportDate.replace(/\//g, "-")}.pdf`;

    const travelRows: any[] = [];
    const foodRows: any[] = [];
    const stationeryRows: any[] = [];
    const otherRows: any[] = [];
    const billGroups: Array<{ label: string; bills: any[] }> = [];

    expenses.forEach((exp: any) => {
      const travelEntries = parseJsonArray(exp.travelEntries);
      const foodEntries = parseJsonArray(exp.foodEntries);
      const stationeryEntries = parseJsonArray(exp.stationeryEntries);
      const stationeryBills = parseJsonArray(exp.stationeryBills);
      const otherEntries = parseJsonArray(exp.otherEntries);

      travelEntries.forEach((entry: any) => {
        const volunteers = Number(entry.volunteers) || 0;
        const amountPerPerson = Number(entry.amountPerPerson) || 0;
        const totalAmount = volunteers * amountPerPerson;
        travelRows.push({
          description: `${entry.from || "—"} → ${entry.to || "—"}`,
          volunteers,
          countAmount: `${volunteers} × ₹${amountPerPerson}`,
          totalAmount,
          bills: parseJsonArray(entry.bills),
          remarks: entry.remarks || "-",
        });
        if ((entry.bills ?? []).length) {
          billGroups.push({ label: `${entry.from || "—"} → ${entry.to || "—"}`, bills: parseJsonArray(entry.bills) });
        }
      });

      foodEntries.forEach((entry: any) => {
        const amount = Number(entry.amount) || 0;
        foodRows.push({ description: entry.category || entry.description || "Food", amount, bills: parseJsonArray(entry.bills) });
        if ((entry.bills ?? []).length) {
          billGroups.push({ label: entry.category || entry.description || "Food", bills: parseJsonArray(entry.bills) });
        }
      });

      stationeryEntries.forEach((entry: any) => {
        stationeryRows.push({ description: entry.description || "Stationery", amount: Number(entry.amount) || 0, bills: parseJsonArray(entry.bills) });
      });
      if (stationeryBills.length) {
        billGroups.push({ label: "Stationery", bills: stationeryBills });
      }

      otherEntries.forEach((entry: any) => {
        otherRows.push({ description: entry.description || "Other", amount: Number(entry.amount) || 0, bills: parseJsonArray(entry.bills), remarks: entry.remarks || "-" });
        if ((entry.bills ?? []).length) {
          billGroups.push({ label: entry.description || "Other", bills: parseJsonArray(entry.bills) });
        }
      });
    });

    const travelTotal = travelRows.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const foodTotal = foodRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const stationeryTotal = stationeryRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const otherTotal = otherRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const grandTotal = travelTotal + foodTotal + stationeryTotal + otherTotal;

    const volunteers = clusterId
      ? await query("SELECT name, college, `year` FROM volunteers WHERE clusterId = ? ORDER BY name", [clusterId])
      : [];

    const doc = new PDFDocument({ size: "A4", margin: 20, bufferPages: true, autoFirstPage: false });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    let bottomLimit = 0;

    function addPage() {
      doc.addPage();
      bottomLimit = doc.page.height - 50;
      drawHeader();
      doc.moveDown(0.5);
    }

    function drawHeader() {
      doc.font("Helvetica-Bold").fontSize(14).text("TALENT QUEST FOR INDIA", { align: "center" });
      doc.font("Helvetica").fontSize(10).text("STUDENTS HOLISTIC DEVELOPMENT PROGRAM", { align: "center" });
      doc.font("Helvetica").fontSize(10).text(`ACADEMIC YEAR : ${academicYear}`, { align: "center" });
      doc.moveDown(0.25);
      doc.font("Helvetica-Bold").fontSize(12).text("Expenses Details", { align: "center" });
      doc.moveDown(0.5);

      const leftX = doc.page.margins.left;
      const rightX = doc.page.width / 2 + 10;
      const currentY = doc.y;

      doc.font("Helvetica-Bold").fontSize(9).text("Cluster :", leftX, currentY);
      doc.font("Helvetica").fontSize(9).text(clusterName, leftX + 55, currentY);
      doc.font("Helvetica-Bold").fontSize(9).text("College :", rightX, currentY);
      doc.font("Helvetica").fontSize(9).text(collegeName, rightX + 55, currentY);

      const rowY = currentY + 14;
      doc.font("Helvetica-Bold").fontSize(9).text("Session Day :", leftX, rowY);
      doc.font("Helvetica").fontSize(9).text(sessionDayLabel, leftX + 75, rowY);
      doc.font("Helvetica-Bold").fontSize(9).text("Date :", rightX, rowY);
      doc.font("Helvetica").fontSize(9).text(exportDate, rightX + 40, rowY);

      const rowY2 = rowY + 14;
      doc.font("Helvetica-Bold").fontSize(9).text("SPOC Name :", leftX, rowY2);
      doc.font("Helvetica").fontSize(9).text(spocName, leftX + 75, rowY2);
      doc.font("Helvetica-Bold").fontSize(9).text("Finance Officer :", rightX, rowY2);
      doc.font("Helvetica").fontSize(9).text(financerName, rightX + 90, rowY2);
      doc.moveDown(3);
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#cccccc").lineWidth(0.5).stroke();
      doc.moveDown(0.6);
    }

    function drawFooter(pageNumber: number, pageCount: number) {
      doc.font("Helvetica").fontSize(9).text(`Page ${pageNumber} of ${pageCount}`, 0, doc.page.height - 40, { width: doc.page.width, align: "center" });
    }

    function ensureSpace(height: number) {
      if (doc.y + height > bottomLimit) {
        addPage();
      }
    }

    function drawTableHeader(headers: string[], widths: number[]) {
      doc.font("Helvetica-Bold").fontSize(9);
      let x = doc.page.margins.left;
      headers.forEach((header, index) => {
        doc.text(header, x, doc.y, { width: widths[index], align: "center" });
        x += widths[index];
      });
      doc.moveDown(0.4);
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#bbbbbb").lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(9);
    }

    function drawSectionHeading(title: string) {
      ensureSpace(26);
      doc.font("Helvetica-Bold").fontSize(11).text(title, { align: "left" });
      doc.moveDown(0.2);
    }

    async function drawTravelSection() {
      drawSectionHeading("Expenses Details");
      const widths = [30, 250, 90, 105, 95, 110, 90];
      drawTableHeader(["S.No", "Description", "No. of Volunteers", "Count × Amount", "Total Amount (₹)", "Bill / Ticket Attached", "Remarks (if any)"], widths);
      if (!travelRows.length) {
        ensureSpace(22);
        doc.text("No travel expense entries found.", doc.page.margins.left, doc.y, { width: widths.reduce((sum, w) => sum + w, 0), align: "left" });
        doc.moveDown(1);
        return;
      }
      for (let index = 0; index < travelRows.length; index += 1) {
        const row = travelRows[index];
        const rowHeight = 70;
        ensureSpace(rowHeight);
        const currentY = doc.y;
        let x = doc.page.margins.left;

        doc.text(String(index + 1), x, currentY, { width: widths[0], align: "center" });
        x += widths[0];
        doc.text(row.description || "-", x, currentY, { width: widths[1], align: "left" });
        x += widths[1];
        doc.text(String(row.volunteers || "-"), x, currentY, { width: widths[2], align: "center" });
        x += widths[2];
        doc.text(row.countAmount || "-", x, currentY, { width: widths[3], align: "center" });
        x += widths[3];
        doc.text(formatAmountLabel(row.totalAmount), x, currentY, { width: widths[4], align: "right" });
        x += widths[4];

        const billCellX = x;
        const billCellWidth = widths[5];
        const imageUrl = row.bills?.[0]?.url || row.bills?.[0]?.originalUrl || row.bills?.[0]?.path || row.bills?.[0];
        if (imageUrl) {
          const buffer = await loadImageBuffer(imageUrl);
          if (buffer) {
            try {
              doc.image(buffer, billCellX + 5, currentY, { fit: [billCellWidth - 10, rowHeight - 18], align: "center" });
            } catch {
              doc.text("Image failed", billCellX, currentY, { width: billCellWidth, align: "center" });
            }
          } else {
            doc.text("No image", billCellX, currentY, { width: billCellWidth, align: "center" });
          }
        } else {
          doc.text("-", billCellX, currentY, { width: billCellWidth, align: "center" });
        }
        x += billCellWidth;

        doc.text(row.remarks || "-", x, currentY, { width: widths[6], align: "left" });
        doc.y = currentY + rowHeight;
        doc.moveDown(0.2);
      }
      doc.moveDown(0.3);
    }

    addPage();
    await drawTravelSection();

    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i += 1) {
      doc.switchToPage(i);
      drawFooter(i + 1, pageCount);
    }

    doc.end();
  } catch (err) {
    console.error("Finance PDF error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

exportsRouter.post("/finance/excel", async (req, res) => {
  try {
    const { clusterId, sessionId, expenseIds = [] } = req.body;

    const whereClauses: string[] = ["1=1"];
    const queryParams: any[] = [];
    if (clusterId) {
      whereClauses.push("clusterId = ?");
      queryParams.push(clusterId);
    }
    if (sessionId) {
      whereClauses.push("sessionId = ?");
      queryParams.push(sessionId);
    }
    if (Array.isArray(expenseIds) && expenseIds.length > 0) {
      whereClauses.push(`id IN (${expenseIds.map(() => "?").join(",")})`);
      queryParams.push(...expenseIds);
    }

    let expenses = await query(`SELECT * FROM expenses WHERE ${whereClauses.join(" AND ")}`, queryParams);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Finance");

    worksheet.columns = [
      { header: "Date", key: "date", width: 15 },
      { header: "Category", key: "category", width: 15 },
      { header: "Description", key: "description", width: 25 },
      { header: "Amount", key: "amount", width: 12 },
      { header: "Status", key: "status", width: 12 },
    ];

    expenses.forEach((e: any) => {
      worksheet.addRow({
        date: e.createdAt ? new Date(e.createdAt).toLocaleDateString("en-IN") : "—",
        category: e.category || "—",
        description: e.description || "—",
        amount: e.amount || 0,
        status: e.status || "Pending",
      });
    });

    // Add totals row
    const totalRow = worksheet.addRow({
      date: "",
      category: "TOTAL",
      description: "",
      amount: expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
      status: "",
    });
    totalRow.font = { bold: true };

    const filename = `finance_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Finance Excel error:", err);
    res.status(500).json({ error: "Failed to generate Excel" });
  }
});

// ════════════════════════════════════════════════════════════════
// TQI REPORTS EXPORTS
// ════════════════════════════════════════════════════════════════

exportsRouter.post("/reports/pdf", async (req, res) => {
  try {
    const { reportId } = req.body;

    const doc = new PDFDocument();
    const filename = `report_${new Date().toISOString().split("T")[0]}.pdf`;
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(20).text("TQI Session Report", { align: "center" });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, { align: "center" });
    doc.moveDown();

    // If a specific reportId is provided, fetch details and photos
    if (reportId) {
      const rows = await query("SELECT * FROM `tqiReports` WHERE `id` = ?", [reportId]);
      if (rows[0]) {
        const r = rows[0];
        try { r.photos = typeof r.photos === 'string' ? JSON.parse(r.photos) : (r.photos || []); } catch { r.photos = []; }

        doc.fontSize(12).text("Session Details", { underline: true });
        doc.fontSize(10).text(`Cluster: ${r.clusterName || '—'} | Session: ${r.sessionName || '—'} | Date: ${r.date || '—'}`);
        doc.moveDown();

        doc.fontSize(12).text("Objectives", { underline: true });
        doc.fontSize(10).text(r.sessionObjective || '—');
        doc.moveDown();

        doc.fontSize(12).text("Activities Conducted", { underline: true });
        doc.fontSize(10).text(r.activitiesConducted || '—');
        doc.moveDown();

        doc.fontSize(12).text("Key Learning Outcomes", { underline: true });
        doc.fontSize(10).text(r.keyLearningOutcomes || '—');
        doc.moveDown();

        // Embed photos if available
        if (Array.isArray(r.photos) && r.photos.length) {
          doc.addPage();
          doc.fontSize(12).text('Photos', { underline: true });
          for (const p of r.photos.slice(0, 12)) {
            const url = p?.url || p?.path || p;
            const buf = await loadImageBuffer(url);
            if (buf) {
              try {
                doc.image(buf, { fit: [420, 320], align: 'center' });
                doc.moveDown(0.4);
              } catch (err) {
                doc.fontSize(9).text(`(Image embed failed) ${p?.name || url}`);
              }
            } else {
              doc.fontSize(9).text(`(Image not found) ${p?.name || url}`);
            }
          }
        }
      }
    } else {
      doc.fontSize(12).text("Session Details", { underline: true });
      doc.fontSize(10).text("Cluster: — | Session: — | Date: —");
      doc.moveDown();

      doc.fontSize(12).text("Objectives", { underline: true });
      doc.fontSize(10).text("—");
      doc.moveDown();

      doc.fontSize(12).text("Activities Conducted", { underline: true });
      doc.fontSize(10).text("—");
      doc.moveDown();

      doc.fontSize(12).text("Key Learning Outcomes", { underline: true });
      doc.fontSize(10).text("—");
      doc.moveDown();
    }

    doc.end();
  } catch (err) {
    console.error("Reports PDF error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

exportsRouter.post("/reports/excel", async (req, res) => {
  try {
    const { reportId } = req.body;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report Summary");

    worksheet.columns = [
      { header: "Field", key: "field", width: 20 },
      { header: "Value", key: "value", width: 40 },
    ];

    worksheet.addRows([
      { field: "Cluster", value: "—" },
      { field: "Session", value: "—" },
      { field: "Date", value: "—" },
      { field: "Participants", value: "—" },
      { field: "Key Outcomes", value: "—" },
    ]);

    const filename = `report_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Reports Excel error:", err);
    res.status(500).json({ error: "Failed to generate Excel" });
  }
});
