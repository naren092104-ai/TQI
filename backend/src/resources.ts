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
  attendanceSubmissions: {
    table: "attendance_submissions",
    columns: ["id", "cluster_id", "cluster_name", "session_id", "session_name", "day", "date", "attendance_type", "submitted_by", "submitted_at", "status", "present_count", "absent_count", "homework_completed", "total_count"],
  },
  advances: {
    table: "advances",
    columns: ["id", "amount", "date", "receivedFrom", "utr", "status", "remarks", "clusterId", "clusterName", "releasedBy"],
  },
  expenses: {
    table: "expenses",
    columns: ["id", "date", "sessionDay", "clusterId", "clusterName", "collegeName", "financerName", "submittedBy", "spocName", "category", "amount", "description", "status", "advanceId", "volunteerCount", "remarks", "bills", "travelEntries", "foodEntries", "stationeryAmount", "stationeryBills", "stationeryEntries", "otherEntries", "sessionName", "grandTotal", "balance"],
    jsonColumns: ["bills", "travelEntries", "foodEntries", "stationeryBills", "stationeryEntries", "otherEntries"],
  },
  financeSettingsDb: {
    table: "financeSettings",
    columns: ["id", "financerName", "financeEmail", "approverName", "approverDesignation", "organizationName", "pdfFooter", "signatureName", "signatureDesignation", "updatedAt"],
  },
  refunds: {
    table: "refunds",
    columns: ["id", "amount", "date", "utr", "txn", "remarks", "status"],
  },
  approvals: {
    table: "approvals",
    columns: ["id", "type", "reference", "requestedBy", "amount", "date", "status", "remarks", "sessionId", "clusterId"],
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
  tqiReports: {
    table: "tqiReports",
    columns: [
      "id", "clusterId", "clusterName", "collegeName", "spocName",
      "sessionId", "sessionName", "day", "date", "academicYear",
      "sessionObjective", "activitiesConducted", "keyLearningOutcomes",
      "studentsPresent", "studentsAbsent", "totalVolunteers", "beneficiaries",
      "studentParticipation", "volunteerParticipation",
      "challengesFaced", "solutionsProvided", "futureActionPlan", "remarks",
      "photos", "status", "submittedBy", "submittedAt", "pdfGeneratedAt",
      "createdAt", "updatedAt",
    ],
    jsonColumns: ["photos"],
  },
} as const;

export type ResourceName = keyof typeof RESOURCE_MAP;
export const RESOURCE_NAMES = Object.keys(RESOURCE_MAP) as ResourceName[];

export function getResourceConfig(resource: string) {
  return RESOURCE_MAP[resource as ResourceName] ?? null;
}
