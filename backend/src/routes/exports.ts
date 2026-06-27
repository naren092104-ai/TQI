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
    const { clusterId, sessionId, day } = req.body;

    const doc = new PDFDocument();
    const filename = `attendance_${new Date().toISOString().split("T")[0]}.pdf`;
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(20).text("Attendance Report", { align: "center" });
    doc.fontSize(10).text(`Cluster: ${clusterId || "All"} | Session: ${sessionId || "All"} | Day: ${day || "—"}`, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text("Student Attendance Summary", { underline: true });
    doc.fontSize(10).text("Present: — | Absent: — | Homework Completed: — | Homework Pending: —");
    doc.moveDown();

    doc.fontSize(12).text("Volunteer Attendance Summary", { underline: true });
    doc.fontSize(10).text("Present: — | Absent: —");
    doc.moveDown();

    doc.end();
  } catch (err) {
    console.error("Attendance PDF error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

exportsRouter.post("/attendance/excel", async (req, res) => {
  try {
    const { clusterId, sessionId, day } = req.body;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Attendance");

    worksheet.columns = [
      { header: "Date", key: "date", width: 15 },
      { header: "Session", key: "session", width: 20 },
      { header: "Cluster", key: "cluster", width: 15 },
      { header: "Type", key: "type", width: 12 },
      { header: "Name", key: "name", width: 20 },
      { header: "Status", key: "status", width: 12 },
    ];

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

    let expenses = await query(`SELECT * FROM expenses WHERE ${whereClauses.join(" AND ")}`, queryParams);

    const doc = new PDFDocument();
    const filename = `finance_${new Date().toISOString().split("T")[0]}.pdf`;
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(20).text("Finance Settlement Report", { align: "center" });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, { align: "center" });
    doc.moveDown();

    // Expense summary
    const categories = ["Travel", "Food", "Stationery", "Other"];
    const totals: Record<string, number> = {};
    
    categories.forEach(cat => {
      totals[cat] = expenses.reduce((sum: number, e: any) => e.category === cat ? sum + (e.amount || 0) : sum, 0);
    });

    doc.fontSize(12).text("Expense Summary", { underline: true });
    categories.forEach(cat => {
      doc.fontSize(10).text(`${cat}: ₹${(totals[cat] || 0).toLocaleString("en-IN")}`);
    });
    
    const grandTotal = Object.values(totals).reduce((a: number, b: number) => a + b, 0);
    doc.fontSize(11).text(`Grand Total: ₹${grandTotal.toLocaleString("en-IN")}`, { underline: true });

    // Attach expense details and embedded bills (if any)
    for (const e of expenses) {
      try {
        doc.addPage();
        doc.fontSize(12).text(`${e.category || 'Expense'} — ${e.description || ''}`, { underline: true });
        doc.fontSize(10).text(`Amount: ₹${(e.amount || 0).toLocaleString('en-IN')}    Submitted By: ${e.submittedBy || '—'}`);
        doc.moveDown(0.3);

        let bills: any[] = [];
        try { bills = typeof e.bills === 'string' ? JSON.parse(e.bills) : (e.bills || []); } catch { bills = []; }
        if (Array.isArray(bills) && bills.length) {
          doc.fontSize(11).text('Attached Bills:', { underline: true });
          for (const b of bills.slice(0, 8)) {
            const url = b?.url || b?.originalUrl || b;
            const buf = await loadImageBuffer(url);
            if (buf) {
              try {
                doc.image(buf, { fit: [400, 300], align: 'center' });
                doc.moveDown(0.2);
                if (b?.name) doc.fontSize(9).text(b.name, { align: 'center' });
                doc.moveDown(0.5);
              } catch (err) {
                doc.fontSize(9).text(`(Image embed failed) ${b?.name || url}`);
              }
            } else {
              doc.fontSize(9).text(`(Image not found) ${b?.name || url}`);
            }
          }
        }
      } catch (inner) {
        console.warn('Failed to render expense details for PDF', inner?.message || inner);
      }
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
