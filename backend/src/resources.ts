export const RESOURCE_MAP = {
  academicYears: {
    table: "academicYears",
    columns: ["id", "name", "start", "end", "active", "archived"],
  },
  clusters: {
    table: "clusters",
    columns: ["id", "name", "code", "state", "district", "status", "lead", "createdAt"],
  },
  panchayats: {
    table: "panchayats",
    columns: ["id", "name", "clusterId", "head", "createdAt"],
  },
  villages: {
    table: "villages",
    columns: ["id", "name", "panchayatId", "population", "createdAt"],
  },
  schools: {
    table: "schools",
    columns: ["id", "name", "villageId", "type", "principal", "createdAt"],
  },
  colleges: {
    table: "colleges",
    columns: ["id", "name", "city", "affiliated", "createdAt"],
  },
  admins: {
    table: "admins",
    columns: ["id", "name", "email", "username", "password", "phone", "role", "active", "lastLogin", "createdAt", "clusterId"],
  },
  students: {
    table: "students",
    columns: ["id", "name", "rollNo", "schoolId", "villageId", "panchayatId", "clusterId", "grade", "gender", "dob", "parentName", "parentPhone", "guardian", "phone", "address", "status", "createdAt", "updatedAt"],
  },
  volunteers: {
    table: "volunteers",
    columns: ["id", "name", "email", "phone", "clusterId", "skill", "sessions"],
  },
  sessions: {
    table: "sessions",
    columns: ["id", "day", "title", "date", "clusterId", "status", "trainer"],
  },
  attendance: {
    table: "attendance",
    columns: ["id", "date", "schoolId", "present", "total", "type", "status", "sessionId", "clusterId", "submittedBy", "details"],
    jsonColumns: ["details"],
  },
  homework: {
    table: "homework",
    columns: ["id", "date", "schoolId", "completed", "partial", "notDone", "status", "sessionId", "clusterId", "submittedBy", "details"],
    jsonColumns: ["details"],
  },
  advances: {
    table: "advances",
    columns: ["id", "amount", "date", "receivedFrom", "utr", "status", "remarks"],
  },
  expenses: {
    table: "expenses",
    columns: ["id", "date", "category", "amount", "description", "submittedBy", "status", "advanceId", "travelFrom", "travelTo", "breakfast", "lunch", "dinner", "refreshment", "remarks", "bills"],
    jsonColumns: ["bills"],
  },
  refunds: {
    table: "refunds",
    columns: ["id", "amount", "date", "utr", "txn", "remarks", "status"],
  },
  approvals: {
    table: "approvals",
    columns: ["id", "type", "reference", "requestedBy", "amount", "date", "status", "remarks"],
  },
  timeline: {
    table: "timeline",
    columns: ["id", "title", "due", "owner", "status"],
  },
  notifications: {
    table: "notifications",
    columns: ["id", "title", "body", "type", "read", "at"],
  },
  auditLogs: {
    table: "auditLogs",
    columns: ["id", "user", "action", "at", "ip"],
  },
} as const;

export type ResourceName = keyof typeof RESOURCE_MAP;
export const RESOURCE_NAMES = Object.keys(RESOURCE_MAP) as ResourceName[];

export function getResourceConfig(resource: string) {
  return RESOURCE_MAP[resource as ResourceName] ?? null;
}
