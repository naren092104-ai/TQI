import { Router } from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { execute, query } from "../db.js";
import { authenticateToken, isSuperAdmin, isClusterAdmin } from "../middleware/auth.js";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const tqiReportsRouter = Router();
tqiReportsRouter.use(authenticateToken);

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── GET /api/tqi-reports ───────────────────────────────────────────────────
tqiReportsRouter.get("/", async (req, res) => {
  try {
    const user = req.user!;
    let rows: any[];
    if (isClusterAdmin(user)) {
      rows = await query("SELECT * FROM `tqiReports` WHERE `clusterId` = ? ORDER BY `day` ASC, `createdAt` DESC", [user.clusterId]);
    } else {
      rows = await query("SELECT * FROM `tqiReports` ORDER BY `clusterName` ASC, `day` ASC, `createdAt` DESC");
    }
    const parsed = rows.map((r: any) => {
      try { r.photos = typeof r.photos === "string" ? JSON.parse(r.photos) : (r.photos ?? []); } catch { r.photos = []; }
      return r;
    });
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// ── GET /api/tqi-reports/:id ───────────────────────────────────────────────
tqiReportsRouter.get("/:id", async (req, res) => {
  try {
    const rows = await query<any>("SELECT * FROM `tqiReports` WHERE `id` = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Report not found" });
    const r = rows[0];
    try { r.photos = typeof r.photos === "string" ? JSON.parse(r.photos) : (r.photos ?? []); } catch { r.photos = []; }
    res.json(r);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// ── POST /api/tqi-reports ──────────────────────────────────────────────────
tqiReportsRouter.post("/", async (req, res) => {
  try {
    const user = req.user!;
    // Only cluster admin can create
    if (!isClusterAdmin(user) && !isSuperAdmin(user)) {
      return res.status(403).json({ error: "Only Cluster Admins can create reports" });
    }

    const body = req.body as Record<string, any>;
    const id = body.id || randomUUID();
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    await execute(
      `INSERT INTO \`tqiReports\` (
        \`id\`, \`clusterId\`, \`clusterName\`, \`collegeName\`, \`spocName\`,
        \`sessionId\`, \`sessionName\`, \`day\`, \`date\`, \`academicYear\`,
        \`sessionObjective\`, \`activitiesConducted\`, \`keyLearningOutcomes\`,
        \`studentsPresent\`, \`studentsAbsent\`, \`totalVolunteers\`, \`beneficiaries\`,
        \`studentParticipation\`, \`volunteerParticipation\`,
        \`challengesFaced\`, \`solutionsProvided\`, \`futureActionPlan\`, \`remarks\`,
        \`photos\`, \`status\`, \`submittedBy\`, \`submittedAt\`, \`pdfGeneratedAt\`,
        \`createdAt\`, \`updatedAt\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.clusterId ?? user.clusterId ?? null,
        body.clusterName ?? null,
        body.collegeName ?? null,
        body.spocName ?? null,
        body.sessionId ?? null,
        body.sessionName ?? null,
        body.day ?? null,
        body.date ?? null,
        body.academicYear ?? null,
        body.sessionObjective ?? null,
        body.activitiesConducted ?? null,
        body.keyLearningOutcomes ?? null,
        body.studentsPresent ?? 0,
        body.studentsAbsent ?? 0,
        body.totalVolunteers ?? 0,
        body.beneficiaries ?? 0,
        body.studentParticipation ?? null,
        body.volunteerParticipation ?? null,
        body.challengesFaced ?? null,
        body.solutionsProvided ?? null,
        body.futureActionPlan ?? null,
        body.remarks ?? null,
        JSON.stringify(body.photos ?? []),
        body.status ?? "Draft",
        body.submittedBy ?? user.email ?? null,
        body.submittedAt ? new Date(body.submittedAt).toISOString().slice(0, 19).replace("T", " ") : null,
        body.pdfGeneratedAt ? new Date(body.pdfGeneratedAt).toISOString().slice(0, 19).replace("T", " ") : null,
        now,
        now,
      ]
    );

    const rows = await query<any>("SELECT * FROM `tqiReports` WHERE `id` = ?", [id]);
    const r = rows[0];
    try { r.photos = typeof r.photos === "string" ? JSON.parse(r.photos) : (r.photos ?? []); } catch { r.photos = []; }
    res.status(201).json(r);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create report" });
  }
});

// ── PUT /api/tqi-reports/:id ───────────────────────────────────────────────
tqiReportsRouter.put("/:id", async (req, res) => {
  try {
    const user = req.user!;
    const existing = await query<any>("SELECT * FROM `tqiReports` WHERE `id` = ?", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: "Report not found" });

    // Super admins cannot edit reports
    if (isSuperAdmin(user)) {
      return res.status(403).json({ error: "Super Admins cannot edit reports" });
    }

    const body = req.body as Record<string, any>;
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Get the actual columns in the table to build a safe UPDATE
    const colRows = await query<any>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tqiReports'"
    );
    const existingCols = new Set(colRows.map((r: any) => r.COLUMN_NAME as string));

    const fieldMap: Record<string, any> = {
      clusterName: body.clusterName ?? null,
      collegeName: body.collegeName ?? null,
      spocName: body.spocName ?? null,
      sessionId: body.sessionId ?? null,
      sessionName: body.sessionName ?? null,
      day: body.day ?? null,
      date: body.date ?? null,
      academicYear: body.academicYear ?? null,
      sessionObjective: body.sessionObjective ?? null,
      activitiesConducted: body.activitiesConducted ?? null,
      keyLearningOutcomes: body.keyLearningOutcomes ?? null,
      studentsPresent: body.studentsPresent ?? 0,
      studentsAbsent: body.studentsAbsent ?? 0,
      totalVolunteers: body.totalVolunteers ?? 0,
      beneficiaries: body.beneficiaries ?? 0,
      studentParticipation: body.studentParticipation ?? null,
      volunteerParticipation: body.volunteerParticipation ?? null,
      challengesFaced: body.challengesFaced ?? null,
      solutionsProvided: body.solutionsProvided ?? null,
      futureActionPlan: body.futureActionPlan ?? null,
      remarks: body.remarks ?? null,
      photos: JSON.stringify(body.photos ?? []),
      status: body.status ?? existing[0].status ?? "Draft",
      submittedBy: body.submittedBy ?? null,
      submittedAt: body.submittedAt ? new Date(body.submittedAt).toISOString().slice(0, 19).replace("T", " ") : null,
      pdfGeneratedAt: body.pdfGeneratedAt ?? null,
      updatedAt: now,
    };

    // Only update columns that actually exist in the table
    const setClauses: string[] = [];
    const values: any[] = [];
    for (const [col, val] of Object.entries(fieldMap)) {
      if (existingCols.has(col)) {
        setClauses.push(`\`${col}\`=?`);
        values.push(val);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(req.params.id);
    await execute(`UPDATE \`tqiReports\` SET ${setClauses.join(", ")} WHERE \`id\`=?`, values);

    const rows = await query<any>("SELECT * FROM `tqiReports` WHERE `id` = ?", [req.params.id]);
    const r = rows[0];
    try { r.photos = typeof r.photos === "string" ? JSON.parse(r.photos) : (r.photos ?? []); } catch { r.photos = []; }
    res.json(r);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update report" });
  }
});

// ── POST /api/tqi-reports/:id/photos ──────────────────────────────────────
// Accepts base64-encoded images, saves them, returns photo metadata
tqiReportsRouter.post("/:id/photos", async (req, res) => {
  try {
    const user = req.user!;
    if (isSuperAdmin(user)) {
      return res.status(403).json({ error: "Super Admins cannot upload photos" });
    }

    const rows = await query<any>("SELECT * FROM `tqiReports` WHERE `id` = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Report not found" });

    const report = rows[0];
    const { photos: newPhotos }: { photos: { name: string; data: string; mimeType: string }[] } = req.body;

    if (!Array.isArray(newPhotos) || newPhotos.length === 0) {
      return res.status(400).json({ error: "No photos provided" });
    }

    // Parse existing photos
    let existingPhotos: any[] = [];
    try {
      existingPhotos = typeof report.photos === "string" ? JSON.parse(report.photos) : (report.photos ?? []);
    } catch { existingPhotos = []; }

    if (existingPhotos.length + newPhotos.length > 50) {
      return res.status(400).json({ error: "Maximum 50 photos allowed per report" });
    }

    // Save photos to cluster/session/day/photos/ folder structure
    const clusterSlug = (report.clusterName ?? "cluster").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const sessionSlug = (report.sessionName ?? "session").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const daySlug = `day-${report.day ?? "1"}`;
    const photoDir = path.resolve(config.uploadsDir, clusterSlug, sessionSlug, daySlug, "photos");
    ensureDir(photoDir);

    const savedPhotos: any[] = [];
    for (const photo of newPhotos) {
      const photoId = randomUUID();
      const ext = photo.mimeType?.includes("png") ? "png" : photo.mimeType?.includes("gif") ? "gif" : "jpg";
      const filename = `${photoId}.${ext}`;
      const filepath = path.join(photoDir, filename);

      // Decode base64 and save
      const base64Data = photo.data.replace(/^data:[^;]+;base64,/, "");
      fs.writeFileSync(filepath, Buffer.from(base64Data, "base64"));

      const relativePath = `${clusterSlug}/${sessionSlug}/${daySlug}/photos/${filename}`;
      savedPhotos.push({
        id: photoId,
        name: photo.name || filename,
        url: `/uploads/${relativePath}`,
        path: relativePath,
        uploadedAt: new Date().toISOString(),
      });
    }

    const allPhotos = [...existingPhotos, ...savedPhotos];
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    await execute(
      "UPDATE `tqiReports` SET `photos`=?, `updatedAt`=? WHERE `id`=?",
      [JSON.stringify(allPhotos), now, req.params.id]
    );

    res.json({ photos: allPhotos, added: savedPhotos.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload photos" });
  }
});

// ── DELETE /api/tqi-reports/:id/photos/:photoId ──────────────────────────
tqiReportsRouter.delete("/:id/photos/:photoId", async (req, res) => {
  try {
    const user = req.user!;
    if (isSuperAdmin(user)) {
      return res.status(403).json({ error: "Super Admins cannot delete photos" });
    }

    const rows = await query<any>("SELECT * FROM `tqiReports` WHERE `id` = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Report not found" });

    const report = rows[0];
    let photos: any[] = [];
    try { photos = typeof report.photos === "string" ? JSON.parse(report.photos) : (report.photos ?? []); } catch { photos = []; }

    const photo = photos.find((p: any) => p.id === req.params.photoId);
    if (photo?.path) {
      const fullPath = path.resolve(config.uploadsDir, photo.path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    const remaining = photos.filter((p: any) => p.id !== req.params.photoId);
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    await execute(
      "UPDATE `tqiReports` SET `photos`=?, `updatedAt`=? WHERE `id`=?",
      [JSON.stringify(remaining), now, req.params.id]
    );

    res.json({ photos: remaining });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

// ── PATCH /api/tqi-reports/:id/reorder-photos ─────────────────────────────
tqiReportsRouter.patch("/:id/reorder-photos", async (req, res) => {
  try {
    const user = req.user!;
    if (isSuperAdmin(user)) {
      return res.status(403).json({ error: "Super Admins cannot reorder photos" });
    }

    const { order }: { order: string[] } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: "order must be an array of photo ids" });

    const rows = await query<any>("SELECT * FROM `tqiReports` WHERE `id` = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Report not found" });

    const report = rows[0];
    let photos: any[] = [];
    try { photos = typeof report.photos === "string" ? JSON.parse(report.photos) : (report.photos ?? []); } catch { photos = []; }

    const photoMap = new Map(photos.map((p: any) => [p.id, p]));
    const reordered = order.map((id) => photoMap.get(id)).filter(Boolean);

    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    await execute(
      "UPDATE `tqiReports` SET `photos`=?, `updatedAt`=? WHERE `id`=?",
      [JSON.stringify(reordered), now, req.params.id]
    );

    res.json({ photos: reordered });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reorder photos" });
  }
});
