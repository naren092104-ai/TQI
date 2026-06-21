import { create } from "zustand";
import { fetchResource, upsertResource, patchResource, deleteResource } from "./api/client";

export type ID = string;
const uid = () => Math.random().toString(36).slice(2, 10);

// ---- Types ----
export interface AcademicYear { id: ID; name: string; start: string; end: string; active: boolean; archived: boolean; }
export interface Cluster { id: ID; name: string; code: string; state: string; district: string; status: string; lead: string; createdAt: string; }
export interface Panchayat { id: ID; name: string; clusterId: ID; head: string; createdAt: string; }
export interface Village { id: ID; name: string; panchayatId: ID; population: number; createdAt: string; }
export interface School { id: ID; name: string; villageId: ID; type: "Primary" | "Middle" | "High" | "Higher Secondary"; principal: string; createdAt: string; }
export interface College { id: ID; name: string; city: string; affiliated: string; createdAt: string; }
export interface Admin { id: ID; name: string; email: string; username: string; password?: string; phone?: string; role: "Super Admin" | "Admin" | "Cluster Admin" | "Finance"; active: boolean; lastLogin: string; createdAt: string; clusterId?: ID; }
export interface Student { id: ID; name: string; rollNo: string; schoolId: ID; villageId?: ID; panchayatId?: ID; clusterId?: ID; grade: string; gender: "M" | "F"; dob?: string; parentName?: string; parentPhone?: string; guardian: string; phone: string; address?: string; status?: string; createdAt?: string; updatedAt?: string; }
export interface Volunteer { id: ID; name: string; email: string; phone: string; clusterId: ID; skill: string; sessions: number; }
export interface Session { id: ID; day: number; title: string; date: string; clusterId: ID; status: "Planned" | "Ongoing" | "Completed" | "Cancelled"; trainer: string; }
export interface AttendanceRow { id: ID; date: string; schoolId: ID; present: number; total: number; type: "student" | "volunteer"; }
export interface HomeworkRow { id: ID; date: string; schoolId: ID; completed: number; partial: number; notDone: number; }
export interface Bill {
  id: ID;
  name: string;
  /** Processed clean scan (B&W, background removed) */
  url: string;
  /** Raw camera/upload image before processing */
  originalUrl?: string;
  type: "uploaded" | "scanned";
}
export interface Expense { id: ID; date: string; category: "Travel" | "Food" | "Stationery" | "Other"; amount: number; description?: string; submittedBy: string; status: "Pending" | "Approved" | "Rejected"; bills: Bill[]; advanceId?: ID; travelFrom?: string; travelTo?: string; breakfast?: number; lunch?: number; dinner?: number; refreshment?: number; remarks?: string; }
export interface Advance { id: ID; amount: number; date: string; receivedFrom: string; utr: string; status: "Pending" | "Approved" | "Settled"; remarks: string; }
export interface Refund { id: ID; amount: number; date: string; utr: string; txn: string; remarks: string; status: "Pending" | "Completed"; }
export interface ApprovalReq { id: ID; type: "Finance" | "Advance" | "Refund" | "Timeline" | "Extension"; reference: string; requestedBy: string; amount?: number; date: string; status: "Pending" | "Approved" | "Rejected"; remarks?: string; }
export interface TimelineTask { id: ID; title: string; due: string; owner: string; status: "Not Started" | "Pending" | "Completed" | "Locked" | "Extension Requested"; }
export interface Notif { id: ID; title: string; body: string; type: "Finance" | "Refund" | "Timeline" | "Admin" | "Alert"; read: boolean; at: string; }
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
  const attendance: AttendanceRow[] = [];
  const homework: HomeworkRow[] = [];
  const advances: Advance[] = [];
  const expenses: Expense[] = [];
  const refunds: Refund[] = [];
  const approvals: ApprovalReq[] = [];
  const timeline: TimelineTask[] = [];
  const notifications: Notif[] = [];
  const auditLogs: AuditEntry[] = [];

  return { academicYears, clusters, panchayats, villages, schools, colleges, admins, students, volunteers, sessions, attendance, homework, advances, expenses, refunds, approvals, timeline, notifications, auditLogs };
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
    const keys = Object.keys(seed()) as Array<keyof DB>;
    const loaded = { ...seed() } as DB;
    let loadedAny = false;
    await Promise.all(
      keys.map(async (resource) => {
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
    const current = get();
    const arr = (current[key] as any[]).slice();
    const idx = arr.findIndex((x) => x.id === item.id);
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
    try {
      await deleteResource(key as string, id);
    } catch (error) {
      console.error("Failed to delete resource", error);
    }
    set((s) => ({ [key]: (s[key] as any[]).filter((x) => x.id !== id) } as any));
  },
  patch: async (key, id, patch: any) => {
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
