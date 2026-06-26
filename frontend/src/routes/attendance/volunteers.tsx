import React, { useState, useMemo, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SmartShell as AppShell } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore, newId } from "@/lib/store";
import { useAuth, isClusterAdmin, isSuperAdmin } from "@/lib/auth";
import { toast } from "sonner";
import {
  Users, CheckCircle, XCircle, Clock, Download,
  RotateCcw, Save, Send, Search, Eye, TrendingUp,
  ChevronLeft, ChevronRight, Lock,
} from "lucide-react";

export const Route = createFileRoute("/attendance/volunteers")({
  head: () => ({ meta: [{ title: "Volunteers Attendance — TQI Admin" }] }),
  component: VolunteersPage,
});

const VOLUNTEER_YEARS = [
  { value: "1", label: "1st Year" }, { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" }, { value: "4", label: "4th Year" },
] as const;

function yearLabel(val?: string) {
  return VOLUNTEER_YEARS.find(y => y.value === val)?.label ?? val ?? "—";
}

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

// ─── Super Admin View ────────────────────────────────────────────────────────
type SAViewVol = "clusters" | "cluster" | "day";

function SuperAdminVolunteersView() {
  const s = useStore();

  const [view, setView] = useState<SAViewVol>("clusters");
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const [clusterFilter, setClusterFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [submittedByFilter, setSubmittedByFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [innerDay, setInnerDay] = useState("");
  const [innerStatus, setInnerStatus] = useState("");

  // Per-cluster inner filters
  const [clusterDayFilter, setClusterDayFilter] = useState<Record<string, string>>({});
  const [clusterStatusFilter, setClusterStatusFilter] = useState<Record<string, string>>({});

  const allSubs = useMemo(() =>
    (s.attendanceSubmissions ?? []).filter(sub => sub.attendance_type === "volunteer"),
    [s.attendanceSubmissions]
  );

  const goToCluster = (cid: string) => { setSelectedClusterId(cid); setInnerDay(""); setInnerStatus(""); setView("cluster"); };
  const goToDay = (sid: string) => { setSelectedSubId(sid); setView("day"); };
  const backToClusters = () => { setView("clusters"); setSelectedClusterId(null); setSelectedSubId(null); };
  const backToCluster = () => { setView("cluster"); setSelectedSubId(null); };

  const selectedCluster = s.clusters.find(c => c.id === selectedClusterId);
  const selectedSub = allSubs.find(s => s.id === selectedSubId);

  const filtered = useMemo(() => allSubs.filter(sub => {
    if (clusterFilter && sub.cluster_id !== clusterFilter) return false;
    if (sessionFilter && String(sub.day) !== sessionFilter) return false;
    if (statusFilter && sub.status !== statusFilter) return false;
    if (submittedByFilter && !sub.submitted_by?.toLowerCase().includes(submittedByFilter.toLowerCase())) return false;
    if (searchText && !sub.cluster_name?.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  }), [allSubs, clusterFilter, sessionFilter, statusFilter, submittedByFilter, searchText]);

  const totals = useMemo(() => ({
    total: filtered.reduce((a, b) => a + (b.total_count||0), 0),
    present: filtered.reduce((a, b) => a + (b.present_count||0), 0),
    absent: filtered.reduce((a, b) => a + (b.absent_count||0), 0),
  }), [filtered]);

  const attPct = totals.total > 0 ? ((totals.present/totals.total)*100).toFixed(1) : "0";

  const byCluster = useMemo(() => {
    const map: Record<string, typeof allSubs> = {};
    allSubs.forEach(sub => { map[sub.cluster_id] = map[sub.cluster_id] ?? []; map[sub.cluster_id].push(sub); });
    return map;
  }, [allSubs]);

  // ── VIEW: Day Detail ─────────────────────────────────────────────────────
  if (view === "day" && selectedSub && selectedCluster) {
    const sub = selectedSub;
    const pct = sub.total_count > 0 ? ((sub.present_count/sub.total_count)*100).toFixed(0) : "0";
    const attRow = s.attendance.find(a => (a as any).clusterId === selectedCluster.id && a.type === "volunteer" && (a as any).sessionId === sub.session_id) as any;
    const details: Record<string,"present"|"absent"> = attRow?.details ?? {};
    const clusterVols = s.volunteers.filter(v => v.clusterId === selectedCluster.id);

    return (
      <AppShell>
        <div className="px-4 sm:px-6 py-6">
          <nav className="flex items-center gap-1.5 text-sm mb-4 flex-wrap">
            <button onClick={backToClusters} className="text-blue-600 hover:underline font-medium">Attendance</button>
            <span className="text-slate-400">/</span>
            <button onClick={backToClusters} className="text-blue-600 hover:underline font-medium">Volunteers</button>
            <span className="text-slate-400">/</span>
            <button onClick={backToCluster} className="text-blue-600 hover:underline font-medium">{selectedCluster.name}</button>
            <span className="text-slate-400">/</span>
            <span className="text-slate-600 font-semibold">Day {sub.day}</span>
          </nav>
          <button onClick={backToCluster} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mb-4 font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Back to {selectedCluster.name}
          </button>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-bold">{sub.session_name || `Day ${sub.day}`}</h2>
              <p className="text-sm text-muted-foreground">{selectedCluster.name} · {fmtDate(sub.date)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export PDF</Button>
              <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export Excel</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Total", value: sub.total_count, color: "text-slate-800" },
              { label: "Present", value: sub.present_count, color: "text-green-600" },
              { label: "Absent", value: sub.absent_count, color: "text-red-600" },
              { label: "Att %", value: `${pct}%`, color: "text-blue-700" },
            ].map(c => <div key={c.label} className="rounded-xl bg-white border shadow-sm p-3"><p className="text-[11px] text-slate-500">{c.label}</p><p className={`text-2xl font-bold ${c.color}`}>{c.value}</p></div>)}
          </div>
          <div className="text-xs text-slate-400 mb-4">
            Submitted by <strong className="text-slate-600">{sub.submitted_by||"—"}</strong> · {fmtDateTime(sub.submitted_at)} ·&nbsp;
            <span className={`inline-block px-2 py-0.5 rounded-full font-semibold capitalize ${sub.status==="submitted"?"bg-green-100 text-green-700":sub.status==="approved"?"bg-emerald-100 text-emerald-700":sub.status==="rejected"?"bg-red-100 text-red-600":"bg-yellow-100 text-yellow-700"}`}>{sub.status}</span>
          </div>
          <div className="rounded-xl bg-white border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b text-slate-500 text-xs">
                <th className="px-4 py-2.5 text-left">S.No</th>
                <th className="px-4 py-2.5 text-left">Volunteer Name</th>
                <th className="px-4 py-2.5 text-left">College</th>
                <th className="px-4 py-2.5 text-left">Year</th>
                <th className="px-4 py-2.5 text-left">Mobile</th>
                <th className="px-4 py-2.5 text-center">Attendance</th>
              </tr></thead>
              <tbody>
                {clusterVols.map((v, idx) => {
                  const att = details[v.id] ?? null;
                  return (
                    <tr key={v.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-400">{idx+1}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{v.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{v.college||"—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{yearLabel(v.year)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{v.phone}</td>
                      <td className="px-4 py-2.5 text-center">
                        {att ? <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${att==="present"?"bg-green-100 text-green-700":"bg-red-100 text-red-600"}`}>{att==="present"?"Present":"Absent"}</span> : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
    const cPct = cTotal > 0 ? ((cPresent/cTotal)*100).toFixed(0) : "0";

    return (
      <AppShell>
        <div className="px-4 sm:px-6 py-6">
          <nav className="flex items-center gap-1.5 text-sm mb-4 flex-wrap">
            <button onClick={backToClusters} className="text-blue-600 hover:underline font-medium">Attendance</button>
            <span className="text-slate-400">/</span>
            <button onClick={backToClusters} className="text-blue-600 hover:underline font-medium">Volunteers</button>
            <span className="text-slate-400">/</span>
            <span className="text-slate-600 font-semibold">{selectedCluster.name}</span>
          </nav>
          <button onClick={backToClusters} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mb-4 font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Back to All Clusters
          </button>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-bold">{selectedCluster.name} — Volunteer Attendance</h2>
              <p className="text-sm text-muted-foreground">{clusterSubs.length} day(s) submitted</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export Excel</Button>
              <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export PDF</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Total Volunteers", value: cTotal, color: "text-slate-800" },
              { label: "Present", value: cPresent, color: "text-green-600" },
              { label: "Absent", value: cAbsent, color: "text-red-600" },
              { label: "Attendance %", value: `${cPct}%`, color: "text-blue-700" },
            ].map(c => <div key={c.label} className="rounded-xl bg-white border shadow-sm p-3"><p className="text-[11px] text-slate-500">{c.label}</p><p className={`text-2xl font-bold ${c.color}`}>{c.value}</p></div>)}
          </div>
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
          {clusterSubs.length === 0 && <div className="text-center py-10 text-slate-400">No submissions match the current filters.</div>}
          <div className="space-y-2">
            {clusterSubs.map(sub => {
              const pct = sub.total_count > 0 ? ((sub.present_count/sub.total_count)*100).toFixed(0) : "0";
              return (
                <button key={sub.id} onClick={() => goToDay(sub.id)}
                  className="w-full rounded-xl border bg-white shadow-sm px-4 py-3 flex items-center justify-between hover:bg-green-50 hover:border-green-200 transition-colors group text-left">
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-colors">{sub.day}</span>
                    <div>
                      <div className="font-semibold text-slate-800">{sub.session_name || `Day ${sub.day}`}</div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-2 mt-0.5">
                        <span>{fmtDate(sub.date)}</span><span>·</span>
                        <span>Total: <strong>{sub.total_count}</strong></span>
                        <span>Present: <strong className="text-green-700">{sub.present_count}</strong></span>
                        <span>Absent: <strong className="text-red-600">{sub.absent_count}</strong></span>
                        <span>Att: <strong className="text-blue-700">{pct}%</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right text-[11px] text-slate-400 hidden sm:block">
                      <div>By: <span className="font-medium text-slate-600">{sub.submitted_by||"—"}</span></div>
                      <div>{fmtDateTime(sub.submitted_at)}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${sub.status==="submitted"?"bg-green-100 text-green-700":sub.status==="approved"?"bg-emerald-100 text-emerald-700":sub.status==="rejected"?"bg-red-100 text-red-600":"bg-yellow-100 text-yellow-700"}`}>{sub.status}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-green-600 transition-colors" />
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
        <nav className="flex items-center gap-1.5 text-sm mb-4"><span className="text-slate-600 font-semibold">Attendance</span><span className="text-slate-400">/</span><span className="text-slate-600 font-semibold">Volunteers</span></nav>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold">Volunteer Attendance — Cluster Summary</h2>
            <p className="text-sm text-muted-foreground">Click a cluster to drill down</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export Excel</Button>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export PDF</Button>
          </div>
        </div>
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Volunteers", value: totals.total, color: "text-slate-800", icon: <Users className="h-7 w-7 text-blue-400/30" /> },
            { label: "Present", value: totals.present, color: "text-green-600", icon: <CheckCircle className="h-7 w-7 text-green-400/30" /> },
            { label: "Absent", value: totals.absent, color: "text-red-600", icon: <XCircle className="h-7 w-7 text-red-400/30" /> },
            { label: "Attendance %", value: `${attPct}%`, color: "text-blue-700", icon: <TrendingUp className="h-7 w-7 text-blue-400/30" /> },
          ].map(c => (
            <div key={c.label} className="rounded-xl bg-white/70 border border-white/60 shadow-sm p-3 flex items-center justify-between">
              <div><p className="text-[11px] font-medium text-slate-500">{c.label}</p><p className={`text-2xl font-bold ${c.color}`}>{c.value}</p></div>
              {c.icon}
            </div>
          ))}
        </div>
        {/* Filters */}
        <div className="rounded-xl bg-white/70 border border-white/60 shadow-sm p-4 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs font-semibold">Cluster</Label>
              <Select value={clusterFilter} onValueChange={setClusterFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent><SelectItem value="">All Clusters</SelectItem>{s.clusters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Day</Label>
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent><SelectItem value="">All Days</SelectItem>{[1,2,3,4,5,6,7,8].map(d => <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent><SelectItem value="">All</SelectItem><SelectItem value="submitted">Submitted</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Submitted By</Label>
              <Input className="mt-1 h-8 text-xs" placeholder="Name..." value={submittedByFilter} onChange={e => setSubmittedByFilter(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Search Cluster</Label>
              <div className="relative mt-1"><Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" /><Input className="pl-7 h-8 text-xs" placeholder="Cluster name..." value={searchText} onChange={e => setSearchText(e.target.value)} /></div>
            </div>
          </div>
        </div>
        {/* Cluster Cards */}
        <div className="space-y-3">
          {s.clusters.filter(c => !clusterFilter || c.id === clusterFilter).map(cluster => {
            const clusterSubs = byCluster[cluster.id] ?? [];
            const hasAny = clusterSubs.length > 0;
            const cTotal = clusterSubs.reduce((a, b) => a + (b.total_count||0), 0);
            const cPresent = clusterSubs.reduce((a, b) => a + (b.present_count||0), 0);
            const cAbsent = clusterSubs.reduce((a, b) => a + (b.absent_count||0), 0);
            const cPct = cTotal > 0 ? ((cPresent/cTotal)*100).toFixed(0) : "0";
            return (
              <button key={cluster.id} onClick={() => hasAny && goToCluster(cluster.id)} disabled={!hasAny}
                className={`w-full rounded-xl border shadow-sm px-4 py-4 flex items-center justify-between transition-colors text-left group ${hasAny ? "bg-white hover:bg-green-50 hover:border-green-200 cursor-pointer" : "bg-slate-50 opacity-60 cursor-default"}`}>
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${hasAny ? "bg-green-100 text-green-700 group-hover:bg-green-600 group-hover:text-white" : "bg-slate-200 text-slate-400"} transition-colors`}>
                    {cluster.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-base text-slate-800">{cluster.name}</div>
                    {hasAny ? (
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-0.5">
                        <span>Total: <strong className="text-slate-700">{cTotal}</strong></span>
                        <span>Present: <strong className="text-green-700">{cPresent}</strong></span>
                        <span>Absent: <strong className="text-red-600">{cAbsent}</strong></span>
                        <span>Att%: <strong className="text-blue-700">{cPct}%</strong></span>
                      </div>
                    ) : <div className="text-xs text-slate-400 mt-0.5">No submissions yet</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${hasAny ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                    {hasAny ? `${clusterSubs.length} day(s)` : "Pending"}
                  </span>
                  {hasAny && <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-green-600 transition-colors" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

// ─── Cluster Admin View ───────────────────────────────────────────────────────
function VolunteersPage() {
  const s = useStore();
  const { user } = useAuth();
  const myClusterId = user?.clusterId ?? "";
  const isSuper = isSuperAdmin(user?.role);
  const isCluster = isClusterAdmin(user?.role);
  const sessionStripRef = useRef<HTMLDivElement | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedVolunteer, setSelectedVolunteer] = useState<any>(null);

  const selectedSession = useMemo(() =>
    s.sessions.find(sess => sess.day === selectedDay && (isClusterAdmin(user?.role) ? sess.clusterId === myClusterId : true)),
    [s.sessions, selectedDay, user?.role, myClusterId]
  );

  const hasSubmitted = !!s.attendance.find(a =>
    (a as any).sessionId === selectedSession?.id &&
    a.type === "volunteer" &&
    (a as any).status === "Submitted"
  );
  const canEdit = !isSuper && selectedSession?.status === "Completed" && !hasSubmitted;

  const sessionDays = useMemo(() => {
    const filtered = isClusterAdmin(user?.role)
      ? s.sessions.filter(sess => sess.clusterId === myClusterId)
      : s.sessions;
    return Array.from({ length: 8 }, (_, i) => {
      const day = i + 1;
      const existing = filtered.find(sess => sess.day === day);
      return { day, date: existing?.date ?? "—", status: existing ? existing.status.toLowerCase() : "upcoming", title: existing?.title ?? `Day ${day}` };
    });
  }, [s.sessions, myClusterId, user?.role]);

  const [collegeFilter, setCollegeFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [volunteerSearch, setVolunteerSearch] = useState("");

  const [attendance, setAttendance] = useState<Record<string, "present" | "absent" | "pending">>(
    Object.fromEntries(s.volunteers.map((v) => [v.id, "pending"]))
  );

  const filteredVolunteers = useMemo(() => {
    return s.volunteers.filter((v) => {
      if (isCluster && v.clusterId !== myClusterId) return false;
      const college = s.colleges.find((c) => c.id === (v as any).collegeId);
      return (
        (!volunteerSearch || v.name.toLowerCase().includes(volunteerSearch.toLowerCase())) &&
        (!collegeFilter || (college?.id === collegeFilter || v.college === collegeFilter)) &&
        (!yearFilter || v.year === yearFilter)
      );
    });
  }, [s.volunteers, s.colleges, volunteerSearch, collegeFilter, yearFilter, isCluster, myClusterId]);

  const presentCount = filteredVolunteers.filter((v) => attendance[v.id] === "present").length;
  const absentCount = filteredVolunteers.filter((v) => attendance[v.id] === "absent").length;
  const pendingCount = filteredVolunteers.filter((v) => attendance[v.id] === "pending").length;
  const attendancePercent = filteredVolunteers.length > 0 ? (presentCount / filteredVolunteers.length) * 100 : 0;

  if (isSuper) return <SuperAdminVolunteersView />;

  const handleMarkAll = (status: "present" | "absent") => {
    const next: Record<string, "present" | "absent" | "pending"> = {};
    filteredVolunteers.forEach(v => { next[v.id] = status; });
    setAttendance(p => ({ ...p, ...next }));
    toast.success(`Marked all as ${status}`);
  };

  const handleSave = async () => {
    if (!selectedSession) return toast.error("No session selected");
    const details: Record<string, "present" | "absent"> = {};
    filteredVolunteers.forEach(v => { details[v.id] = attendance[v.id] === "present" ? "present" : "absent"; });
    await s.upsert("attendance", {
      id: newId(), date: selectedSession.date ?? new Date().toISOString().slice(0, 10),
      schoolId: selectedSession.id, present: presentCount, total: filteredVolunteers.length,
      type: "volunteer", status: "Draft", sessionId: selectedSession.id,
      clusterId: myClusterId, submittedBy: user?.name ?? user?.email ?? "Cluster Admin", details,
    } as any);
    toast.success("Draft saved");
  };

  const handleSubmit = async () => {
    if (pendingCount > 0) return toast.error(`${pendingCount} volunteers still pending`);
    if (!selectedSession) return toast.error("No session selected");

    const details: Record<string, "present" | "absent"> = {};
    filteredVolunteers.forEach(v => { details[v.id] = attendance[v.id] === "present" ? "present" : "absent"; });

    // Step 1: Save attendance record with details
    await s.upsert("attendance", {
      id: newId(), date: selectedSession.date ?? new Date().toISOString().slice(0, 10),
      schoolId: selectedSession.id, present: presentCount, total: filteredVolunteers.length,
      type: "volunteer", status: "Submitted", sessionId: selectedSession.id,
      clusterId: myClusterId, submittedBy: user?.name ?? user?.email ?? "Cluster Admin", details,
    } as any);

    // Step 2: Create attendance_submissions record for Super Admin dashboard
    const cluster = s.clusters.find(c => c.id === myClusterId);
    await s.upsert("attendanceSubmissions", {
      id: newId(),
      cluster_id: myClusterId,
      cluster_name: cluster?.name ?? "Unknown",
      session_id: selectedSession.id,
      session_name: selectedSession.title ?? `Day ${selectedSession.day}`,
      day: selectedSession.day,
      date: selectedSession.date ?? new Date().toISOString().slice(0, 10),
      attendance_type: "volunteer",
      submitted_by: user?.name ?? user?.email ?? "Cluster Admin",
      submitted_at: new Date().toISOString(),
      status: "submitted",
      present_count: presentCount,
      absent_count: absentCount,
      homework_completed: 0,
      total_count: filteredVolunteers.length,
    } as any);

    toast.success("Submitted — Super Admin dashboard updated");
  };

  return (
    <AppShell>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="border-b border-white/50 bg-white/80 backdrop-blur-xl">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Volunteers Attendance</h1>
              <p className="text-sm text-slate-600">Track and manage volunteer attendance records</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {canEdit && (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleMarkAll("absent")}><RotateCcw className="h-4 w-4 mr-2" />Mark All Absent</Button>
                  <Button variant="outline" size="sm" onClick={() => handleMarkAll("present")}><Users className="h-4 w-4 mr-2" />Mark All Present</Button>
                  <Button size="sm" variant="outline" onClick={handleSave}><Save className="h-4 w-4 mr-2" />Save Draft</Button>
                  <Button size="sm" onClick={handleSubmit}><Send className="h-4 w-4 mr-2" />Submit Attendance</Button>
                </>
              )}
              {hasSubmitted && (
                <span className="text-xs flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 border border-green-200 text-green-700">
                  <CheckCircle className="h-3 w-3" /> Submitted
                </span>
              )}
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
              {sessionDays.map(day => (
                <button key={day.day} onClick={() => setSelectedDay(day.day)} className={`snap-center min-w-[130px] flex-shrink-0 rounded-lg px-3 py-2 text-center text-xs font-medium transition-all ${selectedDay === day.day ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200 text-white" : `${day.status === "completed" ? "bg-white text-slate-900 border border-green-200" : day.status === "ongoing" ? "bg-white text-slate-900 border border-yellow-200" : "bg-white text-slate-400 border border-slate-200"} hover:shadow-md`}`}>
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
        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Volunteers", value: filteredVolunteers.length, color: "text-slate-900", icon: <Users className="h-8 w-8 text-blue-500/20" /> },
            { label: "Present", value: presentCount, color: "text-green-600", icon: <CheckCircle className="h-8 w-8 text-green-500/20" /> },
            { label: "Absent", value: absentCount, color: "text-red-600", icon: <XCircle className="h-8 w-8 text-red-500/20" /> },
            { label: "Attendance %", value: `${attendancePercent.toFixed(0)}%`, color: "text-indigo-600", icon: <TrendingUp className="h-8 w-8 text-indigo-500/20" /> },
          ].map(c => (
            <div key={c.label} className="rounded-xl bg-white/60 backdrop-blur border border-white/50 p-4 shadow-sm hover:shadow-md transition-shadow">
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
            {selectedSession.status === "Completed" ? "Attendance already submitted." : "Session must be Completed to submit attendance."}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 rounded-xl bg-white/60 backdrop-blur border border-white/50 p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs font-semibold">College</Label>
              <Select value={collegeFilter} onValueChange={setCollegeFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Colleges</SelectItem>
                  {s.colleges.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Year</Label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Years</SelectItem>
                  {VOLUNTEER_YEARS.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold">Search Volunteer</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="By name or skill..." value={volunteerSearch} onChange={e => setVolunteerSearch(e.target.value)} className="pl-8" />
              </div>
            </div>
          </div>
        </div>

        {/* Volunteer Table */}
        <div className="rounded-xl bg-white/60 backdrop-blur border border-white/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 w-12">S.No</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">College</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Year</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Mobile</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Attendance</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">View</th>
                </tr>
              </thead>
              <tbody>
                {filteredVolunteers.map((v, idx) => (
                  <tr key={v.id} className={`border-b border-slate-100 hover:bg-blue-50/50 transition-colors ${selectedVolunteer?.id === v.id ? "bg-blue-100/30" : ""}`}>
                    <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{v.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{v.college || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{yearLabel(v.year)}</td>
                    <td className="px-4 py-3 text-slate-500">{v.phone}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-3">
                        {(["present","absent"] as const).map(val => (
                          <label key={val} className={`flex items-center gap-1 text-xs cursor-pointer ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}>
                            <input type="radio" name={`att-vol-${v.id}`} value={val} disabled={!canEdit} checked={attendance[v.id] === val} onChange={() => setAttendance(p => ({ ...p, [v.id]: val }))} className="hidden" />
                            <span className={`inline-block h-3 w-3 rounded-full mr-1 ${attendance[v.id] === val ? (val === "present" ? "bg-green-600" : "bg-red-600") : "border border-slate-300"}`} />
                            <span>{val === "present" ? "P" : "A"}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setSelectedVolunteer(v)} className="text-slate-400 hover:text-blue-600"><Eye className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex gap-2 justify-end">
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Export Excel</Button>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Export PDF</Button>
        </div>
      </div>
    </div>
    </AppShell>
  );
}
