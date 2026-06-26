/**
 * TQI Report API client — dedicated endpoints for the report module.
 * The standard CRUD (list, create, update) uses /api/tqiReports via the generic
 * resource router. This file handles photo upload / delete / reorder operations
 * that require the dedicated /api/tqi-reports router.
 */
import { request } from "./api/client";
import type { TqiReport, ReportPhoto } from "./store";

const BASE = "/api/tqi-reports";

/** Fetch all reports (scoped by role on the backend). */
export async function fetchTqiReports(): Promise<TqiReport[]> {
  return request<TqiReport[]>(BASE);
}

/** Fetch a single report. */
export async function fetchTqiReport(id: string): Promise<TqiReport> {
  return request<TqiReport>(`${BASE}/${id}`);
}

/** Create a new report. */
export async function createTqiReport(report: Partial<TqiReport>): Promise<TqiReport> {
  return request<TqiReport>(BASE, {
    method: "POST",
    body: JSON.stringify(report),
  });
}

/** Update an existing report. */
export async function updateTqiReport(id: string, report: Partial<TqiReport>): Promise<TqiReport> {
  return request<TqiReport>(`${BASE}/${id}`, {
    method: "PUT",
    body: JSON.stringify(report),
  });
}

export interface PhotoUploadItem {
  name: string;
  data: string; // base64 data URL
  mimeType: string;
}

/** Upload photos to a report. */
export async function uploadReportPhotos(
  reportId: string,
  photos: PhotoUploadItem[]
): Promise<{ photos: ReportPhoto[]; added: number }> {
  return request(`${BASE}/${reportId}/photos`, {
    method: "POST",
    body: JSON.stringify({ photos }),
  });
}

/** Delete a photo from a report. */
export async function deleteReportPhoto(
  reportId: string,
  photoId: string
): Promise<{ photos: ReportPhoto[] }> {
  return request(`${BASE}/${reportId}/photos/${photoId}`, {
    method: "DELETE",
  });
}

/** Reorder photos by providing ordered array of photo IDs. */
export async function reorderReportPhotos(
  reportId: string,
  order: string[]
): Promise<{ photos: ReportPhoto[] }> {
  return request(`${BASE}/${reportId}/reorder-photos`, {
    method: "PATCH",
    body: JSON.stringify({ order }),
  });
}
