/**
 * Export Utilities - Frontend
 * Proper blob-based downloads from backend API endpoints
 */

import { getToken } from "@/utils/auth";

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:4000";

/**
 * Download a file from the backend API
 * @param endpoint - API endpoint (e.g., "/export/students/pdf")
 * @param filename - Filename for download
 * @param data - Request body data
 */
export async function downloadFromApi(
  endpoint: string,
  filename: string,
  data: Record<string, any> = {}
) {
  try {
    const response = await fetch(`${API_BASE}/api${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken() || ""}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const blob = await response.blob();
    
    if (blob.size === 0) {
      throw new Error("Downloaded file is empty");
    }

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error("Download error:", error);
    throw error;
  }
}

/**
 * Export students to PDF
 */
export async function exportStudentsPdf(clusterId?: string, schoolId?: string) {
  const date = new Date().toISOString().split("T")[0];
  const filename = `students_${date}.pdf`;
  return downloadFromApi("/export/students/pdf", filename, { clusterId, schoolId });
}

/**
 * Export students to Excel
 */
export async function exportStudentsExcel(clusterId?: string, schoolId?: string) {
  const date = new Date().toISOString().split("T")[0];
  const filename = `students_${date}.xlsx`;
  return downloadFromApi("/export/students/excel", filename, { clusterId, schoolId });
}

/**
 * Export volunteers to PDF
 */
export async function exportVolunteersPdf(clusterId?: string) {
  const date = new Date().toISOString().split("T")[0];
  const filename = `volunteers_${date}.pdf`;
  return downloadFromApi("/export/volunteers/pdf", filename, { clusterId });
}

/**
 * Export volunteers to Excel
 */
export async function exportVolunteersExcel(clusterId?: string) {
  const date = new Date().toISOString().split("T")[0];
  const filename = `volunteers_${date}.xlsx`;
  return downloadFromApi("/export/volunteers/excel", filename, { clusterId });
}

/**
 * Export attendance to PDF
 */
export async function exportAttendancePdf(clusterId?: string, sessionId?: string, day?: string) {
  const date = new Date().toISOString().split("T")[0];
  const filename = `attendance_${date}.pdf`;
  return downloadFromApi("/export/attendance/pdf", filename, { clusterId, sessionId, day });
}

/**
 * Export attendance to Excel
 */
export async function exportAttendanceExcel(clusterId?: string, sessionId?: string, day?: string) {
  const date = new Date().toISOString().split("T")[0];
  const filename = `attendance_${date}.xlsx`;
  return downloadFromApi("/export/attendance/excel", filename, { clusterId, sessionId, day });
}

/**
 * Export finance to PDF
 */
export async function exportFinancePdf(clusterId?: string, sessionId?: string, expenseIds: string[] = []) {
  const date = new Date().toISOString().split("T")[0];
  const filename = `finance_${date}.pdf`;
  return downloadFromApi("/export/finance/pdf", filename, { clusterId, sessionId, expenseIds });
}

/**
 * Export finance to Excel
 */
export async function exportFinanceExcel(clusterId?: string, sessionId?: string, expenseIds: string[] = []) {
  const date = new Date().toISOString().split("T")[0];
  const filename = `finance_${date}.xlsx`;
  return downloadFromApi("/export/finance/excel", filename, { clusterId, sessionId, expenseIds });
}

/**
 * Export report to PDF
 */
export async function exportReportPdf(reportId?: string) {
  const date = new Date().toISOString().split("T")[0];
  const filename = `report_${date}.pdf`;
  return downloadFromApi("/export/reports/pdf", filename, { reportId });
}

/**
 * Export report to Excel
 */
export async function exportReportExcel(reportId?: string) {
  const date = new Date().toISOString().split("T")[0];
  const filename = `report_${date}.xlsx`;
  return downloadFromApi("/export/reports/excel", filename, { reportId });
}
