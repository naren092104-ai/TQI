import { create } from "zustand";
import { fetchResource, upsertResource, patchResource, deleteResource } from "./api/client";
import { getToken, validateToken } from "@/utils/auth";

export type ID = string;
const uid = () => Math.random().toString(36).slice(2, 10);

// ---- Types ----
export interface AcademicYear { id: ID; name: string; start: string; end: string; active: boolean; archived: boolean; }
export interface Cluster { id: ID; name: string; code: string; state: string; district: string; status: string; lead: string; createdAt: string; }
export interface Panchayat { id: ID; name: string; clusterId: ID; head: string; createdAt: string; }
export interface Village { id: ID; name: string; panchayatId: ID; population: number; createdAt: string; }
export interface School { id: ID; name: string; villageId: ID; type: "Primary" | "Middle" | "High" | "Higher Secondary"; principal: string; createdAt: string; }
export interface College { id: ID; name: string; city: string; affiliated: string; createdAt: string; }
export interface Admin { id: ID; name: string; email: string; username: string; password?: string; phone?: string; college?: string; role: "Super Admin" | "Admin" | "Cluster Admin" | "Finance"; active: boolean; lastLogin: string; createdAt: string; clusterId?: ID; forcePasswordChange?: boolean; }
export interface Student { id: ID; name: string; rollNo: string; schoolId: ID; villageId?: ID; panchayatId?: ID; clusterId?: ID; grade: string; gender: "M" | "F"; dob?: string; parentName?: string; parentPhone?: string; guardian: string; phone: string; address?: string; status?: string; createdAt?: string; updatedAt?: string; }
export interface Volunteer { id: ID; name: string; email: string; phone: string; clusterId: ID; skill: string; sessions: number; college?: string; department?: string; year?: string; address?: string; }
export interface Session { id: ID; day: number; title: string; description?: string; date: string; clusterId: ID; status: "Planned" | "Ongoing" | "Completed" | "Cancelled" | "Locked"; trainer: string; conductedDate?: string; completedAt?: string; lockedAt?: string; reopenUntil?: string; completedBy?: string; dateSetAt?: string; }
export interface AttendanceRow { id: ID; date: string; schoolId: ID; present: number; total: number; type: "student" | "volunteer"; }
export interface HomeworkRow { id: ID; date: string; schoolId: ID; completed: number; partial: number; notDone: number; }
// Extended attendance/homework details for per-student tracking
export interface AttendanceRowDetailed extends AttendanceRow {
  status?: "Draft" | "Submitted";
  sessionId?: ID;
  clusterId?: ID;
  // map studentId -> "present" | "absent"
  details?: Record<ID, "present" | "absent">;
}
export interface HomeworkRowDetailed extends HomeworkRow {
  status?: "Draft" | "Submitted";
  sessionId?: ID;
  clusterId?: ID;
  // map studentId -> "completed" | "incomplete"
  details?: Record<ID, "completed" | "incomplete">;
}
export interface AttendanceSubmission {
  id: ID;
  cluster_id: ID;
  cluster_name: string;
  session_id: ID;
  session_name: string;
  day: number;
  date: string;
  attendance_type: "student" | "volunteer";
  submitted_by: string;
  submitted_at: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  present_count: number;
  absent_count: number;
  homework_completed: number;
  total_count: number;
}
export interface Bill {
  id: ID;
  name: string;
  url: string;
  originalUrl?: string;
  type: "uploaded" | "scanned";
  amount?: number;
  remarks?: string;
  vendorName?: string;
  hotelName?: string;
  vehicleNumber?: string;
  billNumber?: string;
}

export interface FoodBill {
  subCategory: "Breakfast" | "Lunch" | "Dinner" | "Refreshments";
  bills: Bill[];
  volunteerCount: number;
  remarks?: string;
}

export interface Expense {
  id: ID;
  sessionDay: number;
  date: string;
  clusterId?: ID;
  clusterName?: string;
  collegeName?: string;
  financerName?: string;
  spocName?: string;
  submittedBy: string;
  category: "Travel" | "Food" | "Stationery" | "Cab" | "Auto" | "Fuel" | "Other";
  amount: number;
  description?: string;
  status: "Pending" | "Submitted" | "Approved" | "Rejected" | "Locked";
  bills: Bill[];
  advanceId?: ID;
  volunteerCount?: number;
  // Travel / Cab / Auto
  travelFrom?: string;
  travelTo?: string;
  // Food
  foodBills?: FoodBill[];
  breakfast?: number;
  lunch?: number;
  dinner?: number;
  refreshment?: number;
  // Stationery
  itemName?: string;
  quantity?: number;
  // Fuel
  fuelType?: string;
  litres?: number;
  vehicleNumber?: string;
  // Other
  purpose?: string;
  remarks?: string;
  lockedAt?: string;
  reopenRequestId?: ID;
  // Full finance entry data
  travelEntries?: any[];
  foodEntries?: any[];
  stationeryAmount?: number;
  stationeryBills?: Bill[];
  stationeryEntries?: any[];
  otherEntries?: any[];
  sessionName?: string;
  grandTotal?: number;
  balance?: number;
}

export interface FinanceSettings {
  id: ID;
  defaultFinancerName: string;
  lockAfterHours: number;
}

export interface ReopenRequest {
  id: ID;
  clusterId: ID;
  sessionDay: number;
  reason: string;
  requestedBy: string;
  requestDate: string;
  status: "Pending" | "Approved" | "Rejected";
  approvedUntil?: string;
  // optional target identifies what this reopen is for (e.g., "Finance", "Attendance")
  target?: string;
  // optional reference to the expense / resource id
  expenseId?: ID;
}
export interface Advance { id: ID; amount: number; date: string; receivedFrom: string; utr: string; status: "Pending" | "Approved" | "Settled"; remarks: string; clusterId?: ID; clusterName?: string; releasedBy?: string; }
export interface Refund { id: ID; amount: number; date: string; utr: string; txn: string; remarks: string; status: "Pending" | "Completed"; }
export interface ApprovalReq { id: ID; type: "Finance" | "Advance" | "Refund" | "Timeline" | "Extension" | "Reopen"; reference: string; requestedBy: string; amount?: number; date: string; status: "Pending" | "Approved" | "Rejected"; remarks?: string; sessionId?: ID; clusterId?: ID; target?: "Student" | "Volunteer" | string; }
export interface FinanceSettingsRecord { id: ID; financerName: string; financeEmail?: string; approverName?: string; approverDesignation?: string; organizationName?: string; pdfFooter?: string; signatureName?: string; signatureDesignation?: string; updatedAt?: string; }
export interface TimelineTask { id: ID; title: string; due: string; owner: string; status: "Not Started" | "Pending" | "Completed" | "Locked" | "Extension Requested"; }
export interface Notif { id: ID; title: string; body: string; type: "Finance" | "Refund" | "Timeline" | "Admin" | "Alert" | "Reopen"; read: boolean; at: string; }
export interface AuditEntry { id: ID; user: string; action: string; at: string; ip: string; }

// ---- Seed ----
const seed = () => {
  const academicYears: AcademicYear[] = [];
  const clusters: Cluster[] = [];
  const panchayats: Panchayat[] = [];
  const villages: Village[] = [];
  const schools: School[] = [];
  const colleges: College[] = [];
  const admins: Admin[] = [];
  const students: Student[] = [];
  const volunteers: Volunteer[] = [];
  const sessions: Session[] = [];
  const attendance: AttendanceRowDetailed[] = [];
  const homework: HomeworkRowDetailed[] = [];
  const attendanceSubmissions: AttendanceSubmission[] = [];
  const advances: Advance[] = [];
  const expenses: Expense[] = [];
  const refunds: Refund[] = [];
  const approvals: ApprovalReq[] = [];
  const timeline: TimelineTask[] = [];
  const notifications: Notif[] = [];
  const auditLogs: AuditEntry[] = [];
  const financeSettings: FinanceSettings[] = [{ id: "default", defaultFinancerName: "TQI Finance Team", lockAfterHours: 48 }];
  const financeSettingsDb: FinanceSettingsRecord[] = [];
  const reopenRequests: ReopenRequest[] = [];

  return { academicYears, clusters, panchayats, villages, schools, colleges, admins, students, volunteers, sessions, attendance, homework, attendanceSubmissions, advances, expenses, refunds, approvals, timeline, notifications, auditLogs, financeSettings, financeSettingsDb, reopenRequests };
};

interface DB extends ReturnType<typeof seed> {}

interface Store extends DB {
  initialized: boolean;
  init: () => Promise<void>;
  reload: () => Promise<void>;
  reset: () => void;
  upsert: <K extends keyof DB>(key: K, item: DB[K] extends Array<infer T> ? T : never) => Promise<void>;
  remove: <K extends keyof DB>(key: K, id: ID) => Promise<void>;
  patch: <K extends keyof DB>(key: K, id: ID, patch: Partial<DB[K] extends Array<infer T> ? T : never>) => Promise<void>;
  markAllRead: () => void;
}

export const useStore = create<Store>()((set, get) => ({
  ...seed(),
  initialized: false,
  init: async () => {
    if (get().initialized) return;
    const token = getToken();
    if (!validateToken(token)) return;

    // These resources are local-only (no backend table) — skip them
    const localOnlyKeys = new Set(["financeSettings", "reopenRequests", "financeSettingsDb"]);
    const sessionStorageKeys = new Set<string>();

    const keys = Object.keys(seed()) as Array<keyof DB>;
    const loaded = { ...seed() } as DB;
    let loadedAny = false;
    
    // Load expenses from sessionStorage if available
    keys.forEach((resource) => {
      if (sessionStorageKeys.has(resource as string)) {
        try {
          const stored = sessionStorage.getItem(`tqi:${resource}`);
          if (stored) {
            (loaded as any)[resource] = JSON.parse(stored);
          }
        } catch (e) {
          console.warn(`Failed to load ${resource} from sessionStorage`, e);
        }
      }
    });    
    await Promise.all(
      keys.map(async (resource) => {
        if (localOnlyKeys.has(resource as string)) return; // skip local-only
        try {
          (loaded as any)[resource] = await fetchResource(resource as string);
          loadedAny = true;
        } catch (error) {
          console.error(`Failed to load ${String(resource)}`, error);
        }
      }),
    );
    if (loadedAny) {
      set({ ...loaded, initialized: true });
    }
  },
  reset: () => set({ ...seed(), initialized: false }),
  reload: async () => {
    set({ ...seed(), initialized: false });
    await get().init();
  },
  upsert: async (key, item: any) => {
    const localOnlyKeys = new Set(["financeSettings", "reopenRequests", "financeSettingsDb"]);
    const current = get();
    const arr = (current[key] as any[]).slice();
    const idx = arr.findIndex((x) => x.id === item.id);
    if (localOnlyKeys.has(key as string)) {
      // Local-only: just update in memory, no API call
      if (idx >= 0) arr[idx] = item; else arr.unshift(item);
      set({ [key]: arr } as any);
      return;
    }
    try {
      const updated = await upsertResource(key as string, item);
      if (idx >= 0) arr[idx] = updated; else arr.unshift(updated);
    } catch (error) {
      console.error("Failed to upsert resource", error);
      throw error;
    }
    set({ [key]: arr } as any);
  },
  remove: async (key, id) => {
    const localOnlyKeys = new Set(["financeSettings", "reopenRequests", "financeSettingsDb"]);
    if (!localOnlyKeys.has(key as string)) {
      try {
        await deleteResource(key as string, id);
      } catch (error) {
        console.error("Failed to delete resource", error);
      }
    }
    set((s) => ({ [key]: (s[key] as any[]).filter((x) => x.id !== id) } as any));
  },
  patch: async (key, id, patch: any) => {
    const localOnlyKeys = new Set(["financeSettings", "reopenRequests", "financeSettingsDb"]);
    if (localOnlyKeys.has(key as string)) {
      set((s) => ({ [key]: (s[key] as any[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) } as any));
      return;
    }
    try {
      const updated = await patchResource(key as string, id, patch);
      set((s) => ({ [key]: (s[key] as any[]).map((x) => (x.id === id ? updated : x)) } as any));
    } catch (error) {
      console.error("Failed to patch resource", error);
      throw error;
    }
  },
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
}));

export const newId = uid;
