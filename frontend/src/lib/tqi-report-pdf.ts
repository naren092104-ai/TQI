/**
 * TQI Session Report PDF Generator
 * Generates a print-ready HTML document matching the uploaded TQI report template.
 * Uses the same window.print() approach as finance-pdf.ts.
 */
import type { TqiReport } from "./store";

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:4000";

function esc(s?: string | null): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmt(val?: string | number | null): string {
  if (val == null || val === "") return "—";
  return String(val);
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return String(d); }
}

export function buildTqiReportHtml(report: TqiReport): string {
  const photoCount = (report.photos ?? []).length;
  const totalStudents = (report.studentsPresent ?? 0) + (report.studentsAbsent ?? 0);

  const photosHtml = photoCount > 0
    ? `
    <div class="section-title">Section 9: Photo Gallery</div>
    <div class="photo-grid">
      ${report.photos.map((p, i) => {
        const url = p.localUrl || (p.url?.startsWith("http") ? p.url : `${API_BASE}${p.url}`);
        return `
        <div class="photo-card">
          <img src="${esc(url)}" alt="Photo ${i + 1}" onerror="this.style.display='none'" />
          <div class="photo-caption">Photo ${i + 1}${p.name && p.name !== url ? ` — ${esc(p.name)}` : ""}</div>
        </div>`;
      }).join("")}
    </div>`
    : "";

  return `
    <!-- ── HEADER ────────────────────────────────────────────────────────── -->
    <div class="report-header">
      <div class="header-logo-area">
        <div class="org-name">Talent Quest for India (TQI)</div>
        <div class="report-type-label">SESSION REPORT</div>
      </div>
      <div class="header-divider"></div>
      <table class="header-table">
        <tbody>
          <tr>
            <td class="ht-label">Cluster Name</td>
            <td class="ht-value">${esc(report.clusterName)}</td>
            <td class="ht-label">Session Name</td>
            <td class="ht-value">${esc(report.sessionName)}</td>
          </tr>
          <tr>
            <td class="ht-label">College Name</td>
            <td class="ht-value">${esc(report.collegeName)}</td>
            <td class="ht-label">Day</td>
            <td class="ht-value">Day ${fmt(report.day)}</td>
          </tr>
          <tr>
            <td class="ht-label">SPOC Name</td>
            <td class="ht-value">${esc(report.spocName)}</td>
            <td class="ht-label">Date</td>
            <td class="ht-value">${fmtDate(report.date)}</td>
          </tr>
          <tr>
            <td class="ht-label">Academic Year</td>
            <td class="ht-value" colspan="3">${esc(report.academicYear)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── SECTION 1: Session Objective ──────────────────────────────────── -->
    <div class="section">
      <div class="section-title">Section 1: Session Objective</div>
      <div class="section-content">${esc(report.sessionObjective) || "—"}</div>
    </div>

    <!-- ── SECTION 2: Activities Conducted ───────────────────────────────── -->
    <div class="section">
      <div class="section-title">Section 2: Activities Conducted</div>
      <div class="section-content">${esc(report.activitiesConducted) || "—"}</div>
    </div>

    <!-- ── SECTION 3: Key Learning Outcomes ──────────────────────────────── -->
    <div class="section">
      <div class="section-title">Section 3: Key Learning Outcomes</div>
      <div class="section-content">${esc(report.keyLearningOutcomes) || "—"}</div>
    </div>

    <!-- ── SECTION 4: Participation Statistics ───────────────────────────── -->
    <div class="section">
      <div class="section-title">Section 4: Participation Statistics</div>
      <table class="stats-table">
        <thead>
          <tr>
            <th>Students Present</th>
            <th>Students Absent</th>
            <th>Total Students</th>
            <th>Total Volunteers</th>
            <th>Beneficiaries</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="stat-val">${fmt(report.studentsPresent)}</td>
            <td class="stat-val">${fmt(report.studentsAbsent)}</td>
            <td class="stat-val">${totalStudents}</td>
            <td class="stat-val">${fmt(report.totalVolunteers)}</td>
            <td class="stat-val">${fmt(report.beneficiaries)}</td>
          </tr>
        </tbody>
      </table>
      ${report.studentParticipation ? `<div class="sub-section"><b>Student Participation Notes:</b><br>${esc(report.studentParticipation)}</div>` : ""}
      ${report.volunteerParticipation ? `<div class="sub-section"><b>Volunteer Participation Notes:</b><br>${esc(report.volunteerParticipation)}</div>` : ""}
    </div>

    <!-- ── SECTION 5: Challenges Faced ───────────────────────────────────── -->
    <div class="section">
      <div class="section-title">Section 5: Challenges Faced</div>
      <div class="section-content">${esc(report.challengesFaced) || "—"}</div>
    </div>

    <!-- ── SECTION 6: Solutions Provided ─────────────────────────────────── -->
    <div class="section">
      <div class="section-title">Section 6: Solutions Provided</div>
      <div class="section-content">${esc(report.solutionsProvided) || "—"}</div>
    </div>

    <!-- ── SECTION 7: Future Action Plan ─────────────────────────────────── -->
    <div class="section">
      <div class="section-title">Section 7: Future Action Plan</div>
      <div class="section-content">${esc(report.futureActionPlan) || "—"}</div>
    </div>

    <!-- ── SECTION 8: Remarks ─────────────────────────────────────────────── -->
    <div class="section">
      <div class="section-title">Section 8: Remarks</div>
      <div class="section-content">${esc(report.remarks) || "—"}</div>
    </div>

    <!-- ── SECTION 9: Photo Gallery ──────────────────────────────────────── -->
    ${photosHtml}

    <!-- ── FOOTER ──────────────────────────────────────────────────────────── -->
    <div class="report-footer">
      <div class="footer-row">
        <div class="sign-block">
          <div class="sign-space"></div>
          <div class="sign-line">SPOC Signature</div>
          <div class="sign-name">${esc(report.spocName)}</div>
        </div>
        <div class="sign-block">
          <div class="sign-space"></div>
          <div class="sign-line">Cluster Admin Signature</div>
          <div class="sign-name">${esc(report.submittedBy ?? "")}</div>
        </div>
        <div class="sign-block">
          <div class="sign-space"></div>
          <div class="sign-line">TQI Coordinator Signature</div>
          <div class="sign-name"></div>
        </div>
      </div>
      <div class="footer-meta">
        Report Status: ${esc(report.status)} &nbsp;|&nbsp;
        Submitted By: ${esc(report.submittedBy ?? "—")} &nbsp;|&nbsp;
        ${report.submittedAt ? `Submitted On: ${fmtDate(report.submittedAt)} &nbsp;|&nbsp;` : ""}
        Photos: ${photoCount} &nbsp;|&nbsp;
        Generated: ${new Date().toLocaleDateString("en-IN")}
      </div>
    </div>
  `;
}

const PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    font-size: 11px;
    padding: 20px 28px;
    line-height: 1.5;
  }

  /* ── HEADER ── */
  .report-header { margin-bottom: 16px; }
  .header-logo-area { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .org-name { font-size: 15px; font-weight: 700; letter-spacing: 0.04em; }
  .report-type-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
    border: 2px solid #111; padding: 3px 10px; text-transform: uppercase;
  }
  .header-divider { border-top: 2px solid #111; margin-bottom: 8px; }

  .header-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .header-table td { border: 1px solid #bbb; padding: 5px 8px; vertical-align: top; }
  .ht-label { font-weight: 700; background: #f3f4f6; width: 16%; white-space: nowrap; }
  .ht-value { width: 34%; }

  /* ── SECTIONS ── */
  .section { margin-bottom: 14px; page-break-inside: avoid; }
  .section-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; background: #1e293b; color: #fff;
    padding: 5px 10px; margin-bottom: 0;
  }
  .section-content {
    border: 1px solid #ccc; border-top: none;
    padding: 8px 10px; min-height: 36px;
    white-space: pre-wrap; word-break: break-word;
  }
  .sub-section { margin-top: 6px; padding: 6px 10px; border-left: 3px solid #ddd; font-size: 10px; }

  /* ── STATS TABLE ── */
  .stats-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  .stats-table th {
    border: 1px solid #bbb; padding: 6px 8px;
    background: #f3f4f6; font-weight: 700; text-align: center; font-size: 10px;
  }
  .stats-table td { border: 1px solid #bbb; padding: 6px 8px; text-align: center; }
  .stat-val { font-size: 14px; font-weight: 700; color: #1e293b; }

  /* ── PHOTO GALLERY ── */
  .photo-grid {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 12px; margin-top: 8px;
  }
  .photo-card { border: 1px solid #bbb; padding: 6px; page-break-inside: avoid; background: #fff; }
  .photo-card img {
    width: 100%; max-height: 240px;
    object-fit: contain; display: block; background: #f8f8f8;
  }
  .photo-caption { font-size: 9px; color: #666; text-align: center; margin-top: 4px; }

  /* ── FOOTER ── */
  .report-footer { margin-top: 24px; border-top: 2px solid #111; padding-top: 12px; }
  .footer-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .sign-block { text-align: center; }
  .sign-space { height: 36px; }
  .sign-line { border-top: 1px solid #111; padding-top: 4px; font-size: 10px; font-weight: 700; }
  .sign-name { font-size: 10px; color: #555; margin-top: 2px; }
  .footer-meta {
    margin-top: 12px; font-size: 9px; color: #777;
    border-top: 1px dashed #ccc; padding-top: 6px; text-align: center;
  }

  @media print {
    body { padding: 10px 16px; }
    .photo-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @page { margin: 10mm; }
`;

export function printTqiReport(report: TqiReport): boolean {
  const html = buildTqiReportHtml(report);
  const title = `TQI Report — ${report.clusterName ?? ""} Day ${report.day ?? ""}`;
  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return false;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PDF_CSS}</style></head><body>${html}</body></html>`);
    doc.close();

    iframe.onload = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
      finally { setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 500); }
    };

    setTimeout(() => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {} finally { if (document.body.contains(iframe)) document.body.removeChild(iframe); } }, 700);
    return true;
  } catch (err) {
    console.error("Print failed:", err);
    return false;
  }
}
