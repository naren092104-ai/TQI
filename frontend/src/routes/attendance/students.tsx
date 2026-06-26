import React, { useState, useMemo, useRef, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SmartShell as AppShell } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useStore, newId, type AttendanceSubmission } from "@/lib/store";
import { useAuth, isClusterAdmin, isSuperAdmin } from "@/lib/auth";
import { toast } from "sonner";
import { exportAttendancePdf, exportAttendanceExcel } from "@/lib/api-exports";
import {
  Users, CheckCircle, XCircle, Clock, Download,
  RotateCcw, Save, Send, Search, Eye, TrendingUp,
  ChevronLeft, ChevronRight, Lock, BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/attendance/students")({
  head: () => ({ meta: [{ title: "Students Attendance — TQI Admin" }] }),
  component: StudentsAttendancePage,
});

const ATTENDANCE_STANDARDS = ["9", "10", "11", "12"] as const;

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return iso; }
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

// ─── Breadcrumb component ────────────────────────────────────────────────────
function Breadcrumb({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm mb-4 flex-wrap">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-slate-400">/</span>}
          {item.onClick ? (
            <button onClick={item.onClick} className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors">
              {item.label}
            </button>
          ) : (
            <span className="text-slate-600 font-semibold">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

// ─── Super Admin View ────────────────────────────────────────────────────────
type SAView = "clusters" | "cluster" | "day";

function SuperAdminStudentsView() {
  const s = useStore();

  // Navigation state — 3 levels
  const [view, setView] = useState<SAView>("clusters");
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null); // attendanceSubmission id

  // Filters (cluster list level)
  const [clusterFilter, setClusterFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [submittedByFilter, setSubmittedByFilter] = useState("");
  const [searchText, setSearchText] = useState("");

  // Cluster page filters
  const [innerDay, setInnerDay] = useState("");
  const [innerStatus, setInnerStatus] = useState("");
  const [innerVillage, setInnerVillage] = useState("");
  const [innerStd, setInnerStd] = useState("");

  const allSubs = useMemo(() =>
    (s.attendanceSubmissions ?? []).filter(sub => sub.attendance_type === "student"),
    [s.attendanceSubmissions]
  );

  // ── Navigation helpers ────────────────────────────────────────────────────
  const goToCluster = (clusterId: string) => {
    setSelectedClusterId(clusterId);
    setInnerDay(""); setInnerStatus(""); setInnerVillage(""); setInnerStd("");
    setView("cluster");
  };
  const goToDay = (subId: string) => { setSelectedSubId(subId); setView("day"); };
  const backToClusters = () => { setView("clusters"); setSelectedClusterId(null); setSelectedSubId(null); };
  const backToCluster = () => { setView("cluster"); setSelectedSubId(null); };

  const selectedCluster = s.clusters.find(c => c.id === selectedClusterId);
  const selectedSub = allSubs.find(s => s.id === selectedSubId);

  // ── Cluster-level data ────────────────────────────────────────────────────
  const filtered = useMemo(() => allSubs.filter(sub => {
    if (clusterFilter && sub.cluster_id !== clusterFilter) return false;
    if (sessionFilter && String(sub.day) !== sessionFilter) return false;
    if (statusFilter && sub.status !== statusFilter) return false;
    if (submittedByFilter && !sub.submitted_by?.toLowerCase().includes(submittedByFilter.toLowerCase())) return false;
    if (searchText && !sub.cluster_name?.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  }), [allSubs, clusterFilter, sessionFilter, statusFilter, submittedByFilter, searchText]);

  const totals = useMemo(() => ({
    totalStudents: filtered.reduce((a, b) => a + (b.total_count || 0), 0),
    present: filtered.reduce((a, b) => a + (b.present_count || 0), 0),
    absent: filtered.reduce((a, b) => a + (b.absent_count || 0), 0),
    hwCompleted: filtered.reduce((a, b) => a + (b.homework_completed || 0), 0),
  }), [filtered]);

  const attPct = totals.totalStudents > 0 ? ((totals.present / totals.totalStudents) * 100).toFixed(1) : "0";

  const byCluster = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    allSubs.forEach(sub => { map[sub.cluster_id] = map[sub.cluster_id] ?? []; map[sub.cluster_id].push(sub); });
    return map;
  }, [allSubs]);

  // ── VIEW: Day Detail ─────────────────────────────────────────────────────
  if (view === "day" && selectedSub && selectedCluster) {
    const sub = selectedSub;
    const pct = sub.total_count > 0 ? ((sub.present_count / sub.total_count) * 100).toFixed(0) : "0";
    const cPanchayats = s.panchayats.filter(p => p.clusterId === selectedCluster.id);
    const cVillages = s.villages.filter(v => cPanchayats.some(p => p.id === v.panchayatId));
    const attRows = s.attendance.filter(a => (a as any).clusterId === selectedCluster.id && a.type === "student" && (a as any).sessionId === sub.session_id);
    const hwRows = s.homework.filter(h => (h as any).clusterId === selectedCluster.id && (h as any).sessionId === sub.session_id);
    const mergedDetails: Record<string, "present"|"absent"> = {};
    attRows.forEach(r => { const d = (r as any).details; if (d) Object.assign(mergedDetails, d); });
    const mergedHw: Record<string, "completed"|"incomplete"> = {};
    hwRows.forEach(r => { const d = (r as any).details; if (d) Object.assign(mergedHw, d); });

    return (
      <AppShell>
        <div className="px-4 sm:px-6 py-6">
          <Breadcrumb items={[
            { label: "Attendance", onClick: backToClusters },
            { label: "Students", onClick: backToClusters },
            { label: selectedCluster.name, onClick: backToCluster },
            { label: `Day ${sub.day}` },
          ]} />
          <button onClick={backToCluster} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mb-4 font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Back to {selectedCluster.name}
          </button>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-bold">{sub.session_name || `Day ${sub.day}`}</h2>
              <p className="text-sm text-muted-foreground">{selectedCluster.name} · {fmtDate(sub.date)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                toast.promise(
                  exportAttendancePdf(selectedCluster.id, sub.session_id, `Day ${sub.day}`),
                  {
                    loading: "Generating PDF...",
                    success: "PDF exported",
                    error: (err) => `Failed: ${err.message}`,
                  }
                );
              }}><Download className="h-4 w-4 mr-1" />Export PDF</Button>
              <Button variant="outline" size="sm" onClick={() => {
                toast.promise(
                  exportAttendanceExcel(selectedCluster.id, sub.session_id, `Day ${sub.day}`),
                  {
                    loading: "Generating Excel...",
                    success: "Excel exported",
                    error: (err) => `Failed: ${err.message}`,
                  }
                );
              }}><Download className="h-4 w-4 mr-1" />Export Excel</Button>
            </div>
          </div>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: "Total", value: sub.total_count, color: "text-slate-800" },
              { label: "Present", value: sub.present_count, color: "text-green-600" },
              { label: "Absent", value: sub.absent_count, color: "text-red-600" },
              { label: "HW Done", value: sub.homework_completed, color: "text-indigo-600" },
              { label: "Att %", value: `${pct}%`, color: "text-blue-700" },
            ].map(c => (
              <div key={c.label} className="rounded-xl bg-white border shadow-sm p-3">
                <p className="text-[11px] text-slate-500">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-400 mb-4">
            Submitted by <strong className="text-slate-600">{sub.submitted_by || "—"}</strong> · {fmtDateTime(sub.submitted_at)} ·&nbsp;
            <span className={`inline-block px-2 py-0.5 rounded-full font-semibold capitalize ${sub.status === "submitted" ? "bg-green-100 text-green-700" : sub.status === "approved" ? "bg-emerald-100 text-emerald-700" : sub.status === "rejected" ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"}`}>
              {sub.status}
            </span>
          </div>
          {/* Village → Standard → Students */}
          <div className="space-y-4">
            {cVillages.map(village => {
              const vSchools = s.schools.filter(sc => sc.villageId === village.id);
              const vStudents = s.students.filter(st => vSchools.some(sc => sc.id === st.schoolId));
              if (vStudents.length === 0) return null;
              const standards = ["9","10","11","12"].filter(std => vStudents.some(st => String(st.grade) === std));
              return (
                <div key={village.id} className="rounded-xl border bg-white overflow-hidden shadow-sm">
                  <div className="bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 flex items-center gap-2">📍 {village.name}</div>
                  {standards.map(std => {
                    const stdStudents = vStudents.filter(st => String(st.grade) === std);
                    return (
                      <div key={std} className="border-t">
                        <div className="px-4 py-1.5 text-xs font-medium text-slate-600 bg-slate-50">Standard {std}</div>
                        <table className="w-full text-xs">
                          <thead><tr className="bg-slate-50/50 border-b text-slate-400">
                            <th className="px-3 py-2 text-left">S.No</th>
                            <th className="px-3 py-2 text-left">Student Name</th>
                            <th className="px-3 py-2 text-left">Village</th>
                            <th className="px-3 py-2 text-center">Standard</th>
                            <th className="px-3 py-2 text-center">Attendance</th>
                            <th className="px-3 py-2 text-center">Homework</th>
                          </tr></thead>
                          <tbody>
                            {stdStudents.map((st, idx) => {
                              const att = mergedDetails[st.id] ?? null;
                              const hw = mergedHw[st.id] ?? null;
                              return (
                                <tr key={st.id} className="border-b hover:bg-slate-50/60">
                                  <td className="px-3 py-2 text-slate-400">{idx+1}</td>
                                  <td className="px-3 py-2 font-medium text-slate-800">{st.name}</td>
                                  <td className="px-3 py-2 text-slate-500">{village.name}</td>
                                  <td className="px-3 py-2 text-center text-slate-500">{std}</td>
                                  <td className="px-3 py-2 text-center">{att ? <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${att==="present"?"bg-green-100 text-green-700":"bg-red-100 text-red-600"}`}>{att==="present"?"Present":"Absent"}</span> : <span className="text-slate-300">—</span>}</td>
                                  <td className="px-3 py-2 text-center">{hw ? <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${hw==="completed"?"bg-green-100 text-green-700":"bg-orange-100 text-orange-600"}`}>{hw==="completed"?"Completed":"Not Completed"}</span> : <span className="text-slate-300">—</span>}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </AppShell>
    );
  }

  // ── VIEW: Cluster Page ────────────────────────────────────────────────────
  if (view === "cluster" && selectedCluster) {
    const clusterSubs = (byCluster[selectedCluster.id] ?? [])
      .filter(sub => (!innerDay || String(sub.day) === innerDay) && (!innerStatus || sub.status === innerStatus))
      .sort((a, b) => a.day - b.day);
    const cTotal = clusterSubs.reduce((a, b) => a + (b.total_count||0), 0);
    const cPresent = clusterSubs.reduce((a, b) => a + (b.present_count||0), 0);
    const cAbsent = clusterSubs.reduce((a, b) => a + (b.absent_count||0), 0);
    const cHw = clusterSubs.reduce((a, b) => a + (b.homework_completed||0), 0);
    const cPct = cTotal > 0 ? ((cPresent/cTotal)*100).toFixed(0) : "0";
    const cPanchayats = s.panchayats.filter(p => p.clusterId === selectedCluster.id);
    const cVillages = s.villages.filter(v => cPanchayats.some(p => p.id === v.panchayatId));

    return (
      <AppShell>
        <div className="px-4 sm:px-6 py-6">
          <Breadcrumb items={[
            { label: "Attendance", onClick: backToClusters },
            { label: "Students", onClick: backToClusters },
            { label: selectedCluster.name },
          ]} />
          <button onClick={backToClusters} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mb-4 font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Back to All Clusters
          </button>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-bold">{selectedCluster.name} — Student Attendance</h2>
              <p className="text-sm text-muted-foreground">{clusterSubs.length} day(s) submitted</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                toast.promise(
                  exportAttendanceExcel(selectedCluster.id),
                  {
                    loading: "Generating Excel...",
                    success: "Excel exported",
                    error: (err) => `Failed: ${err.message}`,
                  }
                );
              }}><Download className="h-4 w-4 mr-1" />Export Excel</Button>
              <Button variant="outline" size="sm" onClick={() => {
                toast.promise(
                  exportAttendancePdf(selectedCluster.id),
                  {
                    loading: "Generating PDF...",
                    success: "PDF exported",
                    error: (err) => `Failed: ${err.message}`,
                  }
                );
              }}><Download className="h-4 w-4 mr-1" />Export PDF</Button>
            </div>
          </div>
          {/* Cluster KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Total Students", value: cTotal, color: "text-slate-800" },
              { label: "Present", value: cPresent, color: "text-green-600" },
              { label: "Absent", value: cAbsent, color: "text-red-600" },
              { label: "Attendance %", value: `${cPct}%`, color: "text-blue-700" },
            ].map(c => (
              <div key={c.label} className="rounded-xl bg-white border shadow-sm p-3">
                <p className="text-[11px] text-slate-500">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>
          {/* Filters */}
          <div className="rounded-xl bg-white border shadow-sm p-3 mb-5 flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-[11px] font-semibold text-slate-500">Day</Label>
              <Select value={innerDay} onValueChange={setInnerDay}>
                <SelectTrigger className="mt-1 h-7 text-xs w-24"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Days</SelectItem>
                  {[1,2,3,4,5,6,7,8].map(d => <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] font-semibold text-slate-500">Status</Label>
              <Select value={innerStatus} onValueChange={setInnerStatus}>
                <SelectTrigger className="mt-1 h-7 text-xs w-28"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Day rows */}
          {clusterSubs.length === 0 && (
            <div className="text-center py-10 text-slate-400">No submissions match the current filters.</div>
          )}
          <div className="space-y-2">
            {clusterSubs.map(sub => {
              const pct = sub.total_count > 0 ? ((sub.present_count/sub.total_count)*100).toFixed(0) : "0";
              return (
                <button key={sub.id} onClick={() => goToDay(sub.id)}
                  className="w-full rounded-xl border bg-white shadow-sm px-4 py-3 flex items-center justify-between hover:bg-blue-50 hover:border-blue-200 transition-colors group text-left">
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                      {sub.day}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-800">{sub.session_name || `Day ${sub.day}`}</div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-2 mt-0.5">
                        <span>{fmtDate(sub.date)}</span>
                        <span>·</span>
                        <span>Total: <strong>{sub.total_count}</strong></span>
                        <span>Present: <strong className="text-green-700">{sub.present_count}</strong></span>
                        <span>Absent: <strong className="text-red-600">{sub.absent_count}</strong></span>
                        <span>HW: <strong className="text-indigo-600">{sub.homework_completed}</strong></span>
                        <span>Att: <strong className="text-blue-700">{pct}%</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right text-[11px] text-slate-400 hidden sm:block">
                      <div>By: <span className="font-medium text-slate-600">{sub.submitted_by||"—"}</span></div>
                      <div>{fmtDateTime(sub.submitted_at)}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${sub.status==="submitted"?"bg-green-100 text-green-700":sub.status==="approved"?"bg-emerald-100 text-emerald-700":sub.status==="rejected"?"bg-red-100 text-red-600":"bg-yellow-100 text-yellow-700"}`}>
                      {sub.status}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </AppShell>
    );
  }

  // ── VIEW: Cluster List ────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="px-4 sm:px-6 py-6">
        <Breadcrumb items={[{ label: "Attendance" }, { label: "Students" }]} />
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold">Students Attendance — Cluster Summary</h2>
            <p className="text-sm text-muted-foreground">Click a cluster to drill down</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export Excel</Button>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export PDF</Button>
          </div>
        </div>

        {/* Dashboard KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: "Total Students", value: totals.totalStudents, color: "text-slate-800", icon: <Users className="h-7 w-7 text-blue-400/30" /> },
            { label: "Present", value: totals.present, color: "text-green-600", icon: <CheckCircle className="h-7 w-7 text-green-400/30" /> },
            { label: "Absent", value: totals.absent, color: "text-red-600", icon: <XCircle className="h-7 w-7 text-red-400/30" /> },
            { label: "Homework Done", value: totals.hwCompleted, color: "text-indigo-600", icon: <BookOpen className="h-7 w-7 text-indigo-400/30" /> },
            { label: "Attendance %", value: `${attPct}%`, color: "text-blue-700", icon: <TrendingUp className="h-7 w-7 text-blue-400/30" /> },
            { label: "Submissions", value: filtered.length, color: "text-slate-700", icon: <Clock className="h-7 w-7 text-slate-400/30" /> },
          ].map(c => (
            <div key={c.label} className="rounded-xl bg-white/70 border border-white/60 shadow-sm p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-500">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
              {c.icon}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-xl bg-white/70 border border-white/60 shadow-sm p-4 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs font-semibold">Cluster</Label>
              <Select value={clusterFilter} onValueChange={setClusterFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Clusters</SelectItem>
                  {s.clusters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Session / Day</Label>
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Days</SelectItem>
                  {[1,2,3,4,5,6,7,8].map(d => <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Submitted By</Label>
              <Input className="mt-1 h-8 text-xs" placeholder="Name..." value={submittedByFilter} onChange={e => setSubmittedByFilter(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold">Search Cluster</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                <Input className="pl-7 h-8 text-xs" placeholder="Cluster name..." value={searchText} onChange={e => setSearchText(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Cluster Cards — click to navigate */}
        <div className="space-y-3">
          {s.clusters
            .filter(c => !clusterFilter || c.id === clusterFilter)
            .map(cluster => {
              const clusterSubs = byCluster[cluster.id] ?? [];
              const hasAny = clusterSubs.length > 0;
              const cTotal   = clusterSubs.reduce((a, b) => a + (b.total_count||0), 0);
              const cPresent = clusterSubs.reduce((a, b) => a + (b.present_count||0), 0);
              const cAbsent  = clusterSubs.reduce((a, b) => a + (b.absent_count||0), 0);
              const cHw      = clusterSubs.reduce((a, b) => a + (b.homework_completed||0), 0);
              const cPct     = cTotal > 0 ? ((cPresent/cTotal)*100).toFixed(0) : "0";

              return (
                <button
                  key={cluster.id}
                  onClick={() => hasAny && goToCluster(cluster.id)}
                  disabled={!hasAny}
                  className={`w-full rounded-xl border shadow-sm px-4 py-4 flex items-center justify-between transition-colors text-left group ${hasAny ? "bg-white hover:bg-blue-50 hover:border-blue-200 cursor-pointer" : "bg-slate-50 opacity-60 cursor-default"}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${hasAny ? "bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white" : "bg-slate-200 text-slate-400"} transition-colors`}>
                      {cluster.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-base text-slate-800">{cluster.name}</div>
                      {hasAny ? (
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-0.5">
                          <span>Total: <strong className="text-slate-700">{cTotal}</strong></span>
                          <span>Present: <strong className="text-green-700">{cPresent}</strong></span>
                          <span>Absent: <strong className="text-red-600">{cAbsent}</strong></span>
                          <span>HW Done: <strong className="text-indigo-600">{cHw}</strong></span>
                          <span>Att%: <strong className="text-blue-700">{cPct}%</strong></span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 mt-0.5">No submissions yet</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${hasAny ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}`}>
                      {hasAny ? `${clusterSubs.length} day(s)` : "Pending"}
                    </span>
                    {hasAny && <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </AppShell>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────
function StudentsAttendancePage() {
  const s = useStore();
  const { user } = useAuth();
  const myClusterId = user?.clusterId ?? "";
  const isSuper = isSuperAdmin(user?.role);
  const isCluster = isClusterAdmin(user?.role);
  const sessionStripRef = useRef<HTMLDivElement | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const selectedSession = useMemo(() =>
    s.sessions.find(sess => sess.day === selectedDay &&
      (isClusterAdmin(user?.role) ? sess.clusterId === myClusterId : true)),
    [s.sessions, selectedDay, user?.role, myClusterId]);

  const hasSubmitted = !!s.attendance.find(a =>
    (a as any).sessionId === selectedSession?.id &&
    a.type === "student" &&
    (a as any).status === "Submitted"
  );
  const canEdit = !isSuper && selectedSession?.status === "Completed" && !hasSubmitted;

  const [homework, setHomework] = useState<Record<string, "completed" | "incomplete" | "pending">>(
    Object.fromEntries(s.students.map((st) => [st.id, "pending"]))
  );

  const sessionDays = useMemo(() => {
    const filtered = isClusterAdmin(user?.role)
      ? s.sessions.filter(sess => sess.clusterId === myClusterId)
      : s.sessions;
    return Array.from({ length: 8 }, (_, i) => {
      const day = i + 1;
      const existing = filtered.find(sess => sess.day === day);
      let displayDate = "—";
      if (existing?.date) {
        try {
          const d = new Date(existing.date);
          if (!isNaN(d.getTime())) displayDate = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
          else displayDate = existing.date.slice(0, 10);
        } catch { displayDate = existing.date.slice(0, 10); }
      }
      return { day, date: displayDate, status: existing ? existing.status.toLowerCase() : "upcoming", title: existing?.title ?? `Day ${day}` };
    });
  }, [s.sessions, myClusterId, user?.role]);

  const [panchayatFilter, setPanchayatFilter] = useState("");
  const [villageFilter, setVillageFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [standardFilter, setStandardFilter] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const [attendance, setAttendance] = useState<Record<string, "present" | "absent" | "pending">>(
    Object.fromEntries(s.students.map((st) => [st.id, "pending"]))
  );

  const filteredStudents = useMemo(() => {
    return s.students.filter((st) => {
      if (isCluster && st.clusterId !== myClusterId) return false;
      const school = s.schools.find((sc) => sc.id === st.schoolId);
      const village = school ? s.villages.find((v) => v.id === school.villageId) : null;
      const panchayat = village ? s.panchayats.find((p) => p.id === village.panchayatId) : null;
      return (
        (!studentSearch || st.name.toLowerCase().includes(studentSearch.toLowerCase())) &&
        (!panchayatFilter || panchayat?.id === panchayatFilter) &&
        (!villageFilter || village?.id === villageFilter) &&
        (!schoolFilter || school?.id === schoolFilter) &&
        (!standardFilter || st.grade === standardFilter)
      );
    });
  }, [s.students, s.schools, s.villages, s.panchayats, studentSearch, panchayatFilter, villageFilter, schoolFilter, standardFilter, isCluster, myClusterId]);

  const presentCount = filteredStudents.filter((st) => attendance[st.id] === "present").length;
  const absentCount = filteredStudents.filter((st) => attendance[st.id] === "absent").length;
  const pendingCount = filteredStudents.filter((st) => attendance[st.id] === "pending").length;
  const hwCompleted = filteredStudents.filter((st) => homework[st.id] === "completed").length;
  const hwPercent = filteredStudents.length > 0 ? Math.round((hwCompleted / filteredStudents.length) * 100) : 0;
  const attendancePercent = filteredStudents.length > 0 ? (presentCount / filteredStudents.length) * 100 : 0;

  if (isSuper) return <SuperAdminStudentsView />;

  const handleMarkAll = (status: "present" | "absent") => {
    const next: Record<string, "present" | "absent" | "pending"> = {};
    filteredStudents.forEach((st) => { next[st.id] = status; });
    setAttendance((prev) => ({ ...prev, ...next }));
    toast.success(`Marked all as ${status}`);
  };

  const draftKey = (sessId?: string) => `tqi:attendance:draft:${sessId}:${myClusterId}`;

  useEffect(() => {
    if (!selectedSession) return;
    const raw = localStorage.getItem(draftKey(selectedSession.id));
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.attendance) setAttendance(parsed.attendance);
        if (parsed.homework) setHomework(parsed.homework);
        toast.success("Loaded saved draft");
      } catch { /* ignore */ }
    } else {
      setAttendance(Object.fromEntries(filteredStudents.map((st) => [st.id, "pending"])));
      setHomework(Object.fromEntries(filteredStudents.map((st) => [st.id, "pending"])));
    }
  }, [selectedSession?.id]);

  const handleSave = () => {
    if (!selectedSession) return toast.error("No session selected");
    localStorage.setItem(draftKey(selectedSession.id), JSON.stringify({ attendance, homework, savedAt: new Date().toISOString() }));
    toast.success("Draft saved (local)");
  };

  const handleSubmit = async () => {
    if (!selectedSession) return toast.error("No session selected");
    if (pendingCount > 0) return toast.error(`${pendingCount} students still pending — mark Present or Absent first`);

    // Step 1: Save detailed attendance records
    const details: Record<string, "present" | "absent"> = {};
    filteredStudents.forEach(st => { details[st.id] = attendance[st.id] === "present" ? "present" : "absent"; });

    await s.upsert("attendance", {
      id: newId(),
      date: selectedSession.date ?? new Date().toISOString().slice(0, 10),
      schoolId: schoolFilter || "",
      present: presentCount,
      total: filteredStudents.length,
      type: "student",
      status: "Submitted",
      sessionId: selectedSession.id,
      clusterId: myClusterId,
      submittedBy: user?.name ?? user?.email ?? "Cluster Admin",
      details,
    } as any);

    // Step 2: Save homework details
    const hwDetails: Record<string, "completed" | "incomplete"> = {};
    filteredStudents.forEach(st => { hwDetails[st.id] = homework[st.id] === "completed" ? "completed" : "incomplete"; });
    await s.upsert("homework", {
      id: newId(),
      date: selectedSession.date ?? new Date().toISOString().slice(0, 10),
      schoolId: schoolFilter || "",
      completed: hwCompleted,
      partial: 0,
      notDone: filteredStudents.length - hwCompleted,
      status: "Submitted",
      sessionId: selectedSession.id,
      clusterId: myClusterId,
      submittedBy: user?.name ?? user?.email ?? "Cluster Admin",
      details: hwDetails,
    } as any);

    // Step 3: Create attendance_submissions record for Super Admin dashboard
    const cluster = s.clusters.find(c => c.id === myClusterId);
    await s.upsert("attendanceSubmissions", {
      id: newId(),
      cluster_id: myClusterId,
      cluster_name: cluster?.name ?? "Unknown",
      session_id: selectedSession.id,
      session_name: selectedSession.title ?? `Day ${selectedSession.day}`,
      day: selectedSession.day,
      date: selectedSession.date ?? new Date().toISOString().slice(0, 10),
      attendance_type: "student",
      submitted_by: user?.name ?? user?.email ?? "Cluster Admin",
      submitted_at: new Date().toISOString(),
      status: "submitted",
      present_count: presentCount,
      absent_count: absentCount,
      homework_completed: hwCompleted,
      total_count: filteredStudents.length,
    } as any);

    // Step 4: Clear local draft
    localStorage.removeItem(draftKey(selectedSession.id));
    toast.success("Submitted — Super Admin dashboard updated");
  };

  return (
    <AppShell>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="border-b border-white/50 bg-white/80 backdrop-blur-xl">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Students Attendance</h1>
              <p className="text-sm text-slate-600">Track and manage student attendance records</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => handleMarkAll("absent")}><RotateCcw className="h-4 w-4 mr-2" />Mark All Absent</Button>
              <Button variant="outline" size="sm" onClick={() => handleMarkAll("present")}><Users className="h-4 w-4 mr-2" />Mark All Present</Button>
              <Button size="sm" variant="outline" onClick={handleSave} disabled={!canEdit}><Save className="h-4 w-4 mr-2" />Save Draft</Button>
              <Button size="sm" onClick={handleSubmit} disabled={!canEdit}><Send className="h-4 w-4 mr-2" />Submit Attendance</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6">
        {/* Session Strip */}
        <div className="mb-6 flex items-center gap-2">
          <button type="button" onClick={() => sessionStripRef.current?.scrollBy({ left: -240, behavior: "smooth" })} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 shadow-sm hover:bg-slate-100" aria-label="Scroll left"><ChevronLeft className="h-4 w-4" /></button>
          <div ref={sessionStripRef} className="flex-1 overflow-x-auto scroll-smooth pb-2">
            <div className="flex min-w-max gap-3 snap-x snap-mandatory">
              {sessionDays.map((day) => (
                <button key={day.day} onClick={() => setSelectedDay(day.day)} className={`snap-center min-w-[130px] flex-shrink-0 rounded-lg px-3 py-2 text-center text-xs font-medium transition-all ${selectedDay === day.day ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200 text-white" : `${day.status === "completed" ? "bg-white text-slate-900 border border-green-200" : day.status === "ongoing" ? "bg-white text-slate-900 border border-yellow-200" : day.date !== "—" ? "bg-white text-slate-900 border border-blue-200" : "bg-white text-slate-400 border border-slate-200"} hover:shadow-md`}`}>
                  <div className="font-semibold">Day {day.day}</div>
                  <div className="text-[10px] opacity-75">{day.date}</div>
                  {day.status === "completed" && <div className="text-green-500">✓</div>}
                  {day.status === "ongoing" && <div className="text-yellow-500">◐</div>}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => sessionStripRef.current?.scrollBy({ left: 240, behavior: "smooth" })} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 shadow-sm hover:bg-slate-100" aria-label="Scroll right"><ChevronRight className="h-4 w-4" /></button>
        </div>

        {/* KPI Cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total Students", value: filteredStudents.length, color: "text-slate-900", icon: <Users className="h-8 w-8 text-blue-500/20" /> },
            { label: "Present", value: presentCount, color: "text-green-600", icon: <CheckCircle className="h-8 w-8 text-green-500/20" /> },
            { label: "Absent", value: absentCount, color: "text-red-600", icon: <XCircle className="h-8 w-8 text-red-500/20" /> },
            { label: "Att. Pending", value: pendingCount, color: pendingCount > 0 ? "text-yellow-600" : "text-slate-400", icon: <Clock className="h-8 w-8 text-yellow-500/20" /> },
            { label: "HW Done", value: hwCompleted, color: "text-indigo-600", icon: <BookOpen className="h-8 w-8 text-indigo-500/20" /> },
            { label: "HW %", value: `${hwPercent}%`, color: "text-teal-600", icon: <TrendingUp className="h-8 w-8 text-teal-400/20" /> },
          ].map(c => (
            <div key={c.label} className={`rounded-xl backdrop-blur border p-4 shadow-sm hover:shadow-md transition-shadow ${c.label === "Att. Pending" && pendingCount > 0 ? "bg-yellow-50/80 border-yellow-200" : "bg-white/60 border-white/50"}`}>
              <div className="flex items-center justify-between">
                <div><p className="text-xs font-medium text-slate-600">{c.label}</p><p className={`text-2xl font-bold ${c.color}`}>{c.value}</p></div>
                {c.icon}
              </div>
            </div>
          ))}
        </div>

        {!canEdit && !hasSubmitted && selectedSession && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {selectedSession.status === "Completed" ? "Attendance already submitted for this session." : "Session must be in Completed status to submit attendance."}
          </div>
        )}
        {hasSubmitted && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Attendance submitted — visible to Super Admin.
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 rounded-xl bg-white/60 backdrop-blur border border-white/50 p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs font-semibold">Panchayat</Label>
              <Select value={panchayatFilter} onValueChange={setPanchayatFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Panchayats</SelectItem>
                  {s.panchayats.filter(p => p.clusterId === myClusterId || !myClusterId).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Village</Label>
              <Select value={villageFilter} onValueChange={setVillageFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Villages</SelectItem>
                  {s.villages.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">School</Label>
              <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Schools</SelectItem>
                  {s.schools.map((sc) => <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Standard</Label>
              <Select value={standardFilter} onValueChange={setStandardFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Standards</SelectItem>
                  {ATTENDANCE_STANDARDS.map((std) => <SelectItem key={std} value={std}>Standard {std}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Label className="text-xs font-semibold">Search Student</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="By name or roll number..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="pl-8" />
              </div>
            </div>
          </div>
        </div>

        {/* Student Table grouped by Village → Standard */}
        <div className="rounded-xl bg-white/60 backdrop-blur border border-white/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 w-12">S.No</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Village</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Std</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Attendance</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Homework</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">View</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const byVillage: Record<string, typeof filteredStudents> = {};
                  filteredStudents.forEach(st => {
                    const school = s.schools.find(sc => sc.id === st.schoolId);
                    const village = school ? s.villages.find(v => v.id === school.villageId) : undefined;
                    const vname = village?.name ?? "—";
                    byVillage[vname] = byVillage[vname] || [];
                    byVillage[vname].push(st);
                  });
                  let globalIdx = 0;
                  return Object.keys(byVillage).sort().map(vname => (
                    <React.Fragment key={vname}>
                      <tr className="bg-slate-100/80"><td colSpan={7} className="px-4 py-2 font-semibold text-slate-700 text-xs">{vname}</td></tr>
                      {["9","10","11","12"].map(std => {
                        const students = byVillage[vname].filter(st => String(st.grade) === std);
                        if (!students.length) return null;
                        return (
                          <React.Fragment key={vname + std}>
                            <tr className="bg-blue-50/30"><td colSpan={7} className="px-6 py-1 text-xs text-slate-500 font-medium">Standard {std}</td></tr>
                            {students.map(student => {
                              globalIdx++;
                              const hwState = homework[student.id] ?? "pending";
                              const attState = attendance[student.id] ?? "pending";
                              const attPending = attState === "pending";
                              return (
                                <tr key={student.id} className={`border-b border-slate-100 transition-colors ${selectedStudent?.id === student.id ? "bg-blue-100/30" : attPending && canEdit ? "bg-yellow-50/40 hover:bg-yellow-50/70" : "hover:bg-blue-50/50"}`}>
                                  <td className="px-4 py-3 text-slate-500">{globalIdx}</td>
                                  <td className="px-4 py-3 font-medium text-slate-900">{student.name}</td>
                                  <td className="px-4 py-3 text-slate-500 text-xs">{vname}</td>
                                  <td className="px-4 py-3 text-slate-600">{student.grade}</td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      {(["present","absent"] as const).map(val => (
                                        <label key={val} className={`flex items-center gap-1 text-xs cursor-pointer ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}>
                                          <input type="radio" name={`att-${student.id}`} value={val} disabled={!canEdit} checked={attState === val} onChange={() => setAttendance(p => ({ ...p, [student.id]: val }))} className="hidden" />
                                          <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold border-2 transition-all ${attState === val ? (val === "present" ? "bg-green-500 border-green-500 text-white" : "bg-red-500 border-red-500 text-white") : "border-slate-300 text-slate-400 hover:border-slate-400"}`}>
                                            {val === "present" ? "P" : "A"}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {canEdit ? (
                                      <button
                                        type="button"
                                        onClick={() => setHomework(p => ({ ...p, [student.id]: hwState === "completed" ? "pending" : "completed" }))}
                                        title={hwState === "completed" ? "Click to unmark" : "Click to mark as Completed"}
                                        className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-bold border-2 transition-all ${hwState === "completed" ? "bg-green-500 border-green-500 text-white shadow-sm" : "border-slate-300 text-slate-400 hover:border-green-400 hover:text-green-600 hover:bg-green-50"}`}
                                      >✓</button>
                                    ) : (
                                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${hwState === "completed" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                                        {hwState === "completed" ? "Done" : "—"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button onClick={() => setSelectedStudent(student)} className="text-slate-400 hover:text-blue-600"><Eye className="h-4 w-4" /></button>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => {
            toast.promise(
              exportAttendanceExcel(selectedCluster.id, selectedSession?.id),
              {
                loading: "Generating Excel...",
                success: "Excel exported",
                error: (err) => `Failed: ${err.message}`,
              }
            );
          }}><Download className="h-4 w-4 mr-2" />Export Excel</Button>
          <Button variant="outline" size="sm" onClick={() => {
            toast.promise(
              exportAttendancePdf(selectedCluster.id, selectedSession?.id),
              {
                loading: "Generating PDF...",
                success: "PDF exported",
                error: (err) => `Failed: ${err.message}`,
              }
            );
          }}><Download className="h-4 w-4 mr-2" />Export PDF</Button>
        </div>
      </div>
    </div>
    </AppShell>
  );
}
