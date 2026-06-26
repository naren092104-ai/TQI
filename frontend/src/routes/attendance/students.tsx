import React, { useState, useMemo, useRef } from "react";
import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SmartShell as AppShell } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useStore, newId, type ApprovalReq } from "@/lib/store";
import { useAuth, isClusterAdmin, isSuperAdmin } from "@/lib/auth";
import { toast } from "sonner";
import {
  Users, CheckCircle, XCircle, Clock, Download,
  RotateCcw, Save, Send, Search, Eye, TrendingUp,
  ChevronLeft, ChevronRight, Lock, Unlock,
} from "lucide-react";

export const Route = createFileRoute("/attendance/students")({
  head: () => ({ meta: [{ title: "Students Attendance — TQI Admin" }] }),
  component: StudentsAttendancePage,
});

const ATTENDANCE_STANDARDS = ["9", "10", "11", "12"] as const;

function StudentsAttendancePage() {
  const s = useStore();
  const { user } = useAuth();
  const myClusterId = user?.clusterId ?? "";
  const isSuper = isSuperAdmin(user?.role);
  const isCluster = isClusterAdmin(user?.role);
  const sessionStripRef = useRef<HTMLDivElement | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [openCluster, setOpenCluster] = useState<string | null>(null);

  // Selected session window check
  const selectedSession = useMemo(() =>
    s.sessions.find(sess => sess.day === selectedDay &&
      (isClusterAdmin(user?.role) ? sess.clusterId === myClusterId : true)),
    [s.sessions, selectedDay, user?.role, myClusterId]);
  // canEdit: session must be Completed, and not yet submitted
  const hasSubmitted = !!s.attendance.find(a => (a as any).sessionId === selectedSession?.id && a.type === "student" && (a as any).status === "Submitted");
  const canEdit = !isSuper && selectedSession?.status === "Completed" && !hasSubmitted;

  // Homework state per student
  const [homework, setHomework] = useState<Record<string, "completed" | "incomplete" | "pending">>(
    Object.fromEntries(s.students.map((st) => [st.id, "pending"]))
  );

  // Real sessions from store — filtered by cluster for cluster admin
  const sessionDays = useMemo(() => {
    const filtered = isClusterAdmin(user?.role)
      ? s.sessions.filter(sess => sess.clusterId === myClusterId)
      : s.sessions;
    return Array.from({ length: 8 }, (_, i) => {
      const day = i + 1;
      const existing = filtered.find(sess => sess.day === day);
      // Format date cleanly
      let displayDate = "—";
      if (existing?.date) {
        try {
          const d = new Date(existing.date);
          if (!isNaN(d.getTime())) {
            displayDate = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
          } else {
            displayDate = existing.date.slice(0, 10);
          }
        } catch { displayDate = existing.date.slice(0, 10); }
      }
      return {
        day,
        date: displayDate,
        status: existing ? existing.status.toLowerCase() : "upcoming",
        title: existing?.title ?? `Day ${day}`,
      };
    });
  }, [s.sessions, myClusterId, user?.role]);

  // Filters
  const [panchayatFilter, setPanchayatFilter] = useState("");
  const [villageFilter, setVillageFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [standardFilter, setStandardFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  // Attendance state
  const [attendance, setAttendance] = useState<Record<string, "present" | "absent" | "pending">>(
    Object.fromEntries(s.students.map((st) => [st.id, "pending"]))
  );

  // Filtered students
  const filteredStudents = useMemo(() => {
    return s.students.filter((st) => {
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
  }, [s.students, s.schools, s.villages, s.panchayats, studentSearch, panchayatFilter, villageFilter, schoolFilter, standardFilter]);

  const presentCount = filteredStudents.filter((st) => attendance[st.id] === "present").length;
  const absentCount = filteredStudents.filter((st) => attendance[st.id] === "absent").length;
  const pendingCount = filteredStudents.filter((st) => attendance[st.id] === "pending").length;
  const attendancePercent = filteredStudents.length > 0 ? (presentCount / filteredStudents.length) * 100 : 0;

  // Super Admin: show cluster-wise summary instead of entry UI
  if (isSuper) {
    // Build ALL submissions grouped by cluster + day
    const allSubmittedRows = s.attendance.filter(a =>
      a.type === "student" && (a as any).status === "Submitted"
    );

    // Get unique days that have submissions
    const submittedDays = [...new Set(allSubmittedRows.map(r => {
      const sess = s.sessions.find(ss => ss.id === (r as any).sessionId);
      return sess?.day ?? 0;
    }).filter(d => d > 0))].sort();

    const clusterData = s.clusters.map(c => {
      // All submitted rows for this cluster across all days
      const cRows = allSubmittedRows.filter(a => (a as any).clusterId === c.id);

      // Group by session/day
      const dayData = Array.from({ length: 8 }, (_, i) => {
        const day = i + 1;
        const dayRows = cRows.filter(r => {
          const sess = s.sessions.find(ss => ss.id === (r as any).sessionId);
          return sess?.day === day;
        });
        const latestRow = [...dayRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] as any;
        const hwRows = s.homework.filter(h =>
          (h as any).clusterId === c.id && (h as any).status === "Submitted" &&
          (() => { const sess = s.sessions.find(ss => ss.id === (h as any).sessionId); return sess?.day === day; })()
        );
        const present = dayRows.reduce((sum, r) => sum + (r.present || 0), 0);
        const total   = dayRows.reduce((sum, r) => sum + (r.total   || 0), 0);
        const hwCompleted = hwRows.reduce((sum, r) => sum + (r.completed || 0), 0);
        const session = s.sessions.find(ss => ss.id === latestRow?.sessionId);
        return { day, present, total, absent: total - present, hwCompleted, session, submittedBy: latestRow?.submittedBy ?? "—", lastUpdate: latestRow?.date ?? null, submitted: dayRows.length > 0, latestRow };
      }).filter(d => d.total > 0 || (cRows.length > 0 && d.day <= 8));

      return { cluster: c, dayData, hasAny: cRows.length > 0 };
    });

    return (
      <AppShell>
        <div className="px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Student Attendance — Cluster Summary</h2>
              <p className="text-sm text-muted-foreground">Submitted by Cluster Admins</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Refresh</Button>
          </div>

          <div className="space-y-6">
            {clusterData.map(({ cluster, dayData, hasAny }) => (
              <div key={cluster.id} className="rounded-xl border shadow-sm overflow-hidden">
                {/* Cluster header */}
                <div className={`px-4 py-3 flex items-center justify-between ${hasAny ? "bg-blue-50 border-b border-blue-100" : "bg-slate-50 border-b"}`}>
                  <span className="font-semibold text-base">{cluster.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${hasAny ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}`}>
                    {hasAny ? `${dayData.filter(d => d.submitted).length} day(s) submitted` : "Pending"}
                  </span>
                </div>

                {!hasAny && (
                  <div className="px-4 py-4 text-xs text-slate-400 text-center">No submission yet from this cluster</div>
                )}

                {hasAny && (
                  <div className="divide-y">
                    {Array.from({ length: 8 }, (_, i) => i + 1).map(day => {
                      const dd = dayData.find(d => d.day === day);
                      if (!dd) return null;
                      const isOpen = openCluster === `${cluster.id}-day${day}`;

                      return (
                        <div key={day}>
                          <button
                            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors ${dd.submitted ? "" : "opacity-60"}`}
                            onClick={() => setOpenCluster(isOpen ? null : `${cluster.id}-day${day}`)}
                          >
                            <div className="flex items-center gap-3 text-sm">
                              <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${dd.submitted ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>{day}</span>
                              <div className="text-left">
                                <div className="font-medium">{dd.session ? `Day ${day} — ${dd.session.title}` : `Day ${day}`}</div>
                                {dd.submitted && <div className="text-xs text-slate-500">Present: {dd.present} · Absent: {dd.absent} · Hw: {dd.hwCompleted} · {dd.total > 0 ? ((dd.present/dd.total)*100).toFixed(0) : 0}%</div>}
                                {!dd.submitted && <div className="text-xs text-slate-400">Not submitted</div>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {dd.submitted && <span className="text-[10px] text-slate-400">{dd.lastUpdate}</span>}
                              <span className="text-primary text-xs">{isOpen ? "▲" : "▼"}</span>
                            </div>
                          </button>

                          {/* Expanded Village/Standard View */}
                          {isOpen && dd.submitted && (() => {
                            const cPanchayats = s.panchayats.filter(p => p.clusterId === cluster.id);
                            const cVillages = s.villages.filter(v => cPanchayats.some(p => p.id === v.panchayatId));
                            return (
                              <div className="bg-slate-50/80 px-4 pt-3 pb-4 border-t space-y-4">
                                <div className="text-xs text-slate-500">
                                  Submitted by: <strong>{dd.submittedBy}</strong>
                                  {dd.lastUpdate && <span> · {dd.lastUpdate}</span>}
                                </div>
                                {cVillages.map(village => {
                                  const vSchools = s.schools.filter(sc => sc.villageId === village.id);
                                  const vStudents = s.students.filter(st => vSchools.some(sc => sc.id === st.schoolId));
                                  if (vStudents.length === 0) return null;
                                  const standards = [...new Set(vStudents.map(st => st.grade))].sort();
                                  return (
                                    <div key={village.id} className="rounded-lg border bg-white overflow-hidden">
                                      <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">{village.name}</div>
                                      {standards.map(std => {
                                        const stdStudents = vStudents.filter(st => st.grade === std);
                                        return (
                                          <div key={std} className="border-t">
                                            <div className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50/60">Standard {std}</div>
                                            <table className="w-full text-xs">
                                              <thead><tr className="bg-slate-50/40 border-b">
                                                <th className="px-3 py-1 text-left text-slate-400">S.No</th>
                                                <th className="px-3 py-1 text-left text-slate-400">Student</th>
                                                <th className="px-3 py-1 text-left text-slate-400">Mobile</th>
                                                <th className="px-3 py-1 text-center text-slate-400">Attendance</th>
                                                <th className="px-3 py-1 text-center text-slate-400">Homework</th>
                                              </tr></thead>
                                              <tbody>
                                                {stdStudents.map((st, idx) => {
                                                  const attStatus = (() => {
                                                    for (const row of s.attendance.filter(a => (a as any).clusterId === cluster.id && a.type === "student" && (a as any).status === "Submitted")) {
                                                      const d = (row as any).details;
                                                      if (d && st.id in d) return d[st.id] as string;
                                                    }
                                                    return null;
                                                  })();
                                                  const hwStatus = (() => {
                                                    for (const row of s.homework.filter(h => (h as any).clusterId === cluster.id && (h as any).status === "Submitted")) {
                                                      const d = (row as any).details;
                                                      if (d && st.id in d) return d[st.id] as string;
                                                    }
                                                    return null;
                                                  })();
                                                  return (
                                                    <tr key={st.id} className="border-b hover:bg-slate-50/40">
                                                      <td className="px-3 py-1.5 text-slate-400">{idx + 1}</td>
                                                      <td className="px-3 py-1.5 font-medium">{st.name}</td>
                                                      <td className="px-3 py-1.5 text-slate-500">{st.phone}</td>
                                                      <td className="px-3 py-1.5 text-center">
                                                        {attStatus
                                                          ? <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${attStatus === "present" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{attStatus === "present" ? "Present" : "Absent"}</span>
                                                          : <span className="text-slate-300">—</span>}
                                                      </td>
                                                      <td className="px-3 py-1.5 text-center">
                                                        {hwStatus
                                                          ? <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${hwStatus === "completed" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>{hwStatus === "completed" ? "Completed" : "Not Completed"}</span>
                                                          : <span className="text-slate-300">—</span>}
                                                      </td>
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
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  const handleMarkAll = (status: "present" | "absent") => {
    const newAttendance: Record<string, "present" | "absent" | "pending"> = {};
    filteredStudents.forEach((st) => {
      newAttendance[st.id] = status;
    });
    setAttendance((prev) => ({ ...prev, ...newAttendance }));
    toast.success(`Marked all as ${status}`);
  };

  // Local draft storage key
  const draftKey = (sessId?: string) => `tqi:attendance:draft:${sessId}:${myClusterId}`;

  // Load draft when session changes
  useEffect(() => {
    if (!selectedSession) return;
    const raw = localStorage.getItem(draftKey(selectedSession.id));
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.attendance) setAttendance(parsed.attendance);
        if (parsed.homework) setHomework(parsed.homework);
        toast.success("Loaded saved draft");
      } catch (err) {
        // ignore
      }
    } else {
      // reset local states when changing session
      setAttendance(Object.fromEntries(filteredStudents.map((st) => [st.id, "pending"])));
      setHomework(Object.fromEntries(filteredStudents.map((st) => [st.id, "pending"])));
    }
  }, [selectedSession?.id]);

  const handleSave = () => {
    if (!selectedSession) return toast.error("No session selected");
    const payload = { attendance, homework, savedAt: new Date().toISOString() };
    localStorage.setItem(draftKey(selectedSession.id), JSON.stringify(payload));
    toast.success("Draft saved (local)");
  };

  const completeSession = async () => {
    if (!selectedSession) return toast.error("No session selected");
    await s.patch("sessions", selectedSession.id, { status: "Completed", completedAt: new Date().toISOString() });
    toast.success("Session marked Completed — 48h window started");
  };

  const handleSubmit = async () => {
    if (!selectedSession) return toast.error("No session selected");
    const hwPending = filteredStudents.filter(st => homework[st.id] === "pending").length;
    if (pendingCount > 0) return toast.error(`${pendingCount} students still pending`);
    if (hwPending > 0) return toast.error(`${hwPending} students have homework pending`);

    // build detailed attendance mapping
    const details: Record<string, "present" | "absent"> = {};
    filteredStudents.forEach(st => { details[st.id] = attendance[st.id] === "present" ? "present" : "absent"; });

    // persist aggregated attendance row with details and status Submitted
    await s.upsert("attendance", {
      id: newId(),
      date: selectedSession.date ?? new Date().toISOString().slice(0,10),
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

    // persist homework details
    const hwDetails: Record<string, "completed" | "incomplete"> = {};
    filteredStudents.forEach(st => { hwDetails[st.id] = homework[st.id] === "completed" ? "completed" : "incomplete"; });
    await s.upsert("homework", {
      id: newId(),
      date: selectedSession.date ?? new Date().toISOString().slice(0,10),
      schoolId: schoolFilter || "",
      completed: Object.values(hwDetails).filter(v => v === "completed").length,
      partial: 0,
      notDone: Object.values(hwDetails).filter(v => v === "incomplete").length,
      status: "Submitted",
      sessionId: selectedSession.id,
      clusterId: myClusterId,
      submittedBy: user?.name ?? user?.email ?? "Cluster Admin",
      details: hwDetails,
    } as any);

    // clear local draft
    localStorage.removeItem(draftKey(selectedSession.id));
    toast.success("Submitted final — visible to Super Admin");
  };

  return (
    <AppShell>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="border-b border-white/50 bg-white/80 backdrop-blur-xl">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Students Attendance</h1>
              <p className="text-sm text-slate-600">{isSuper ? "Review submitted attendance from Cluster Admins" : "Track and manage student attendance records"}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {isSuper ? (
                <>
                  <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Export Excel</Button>
                  <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Export PDF</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleMarkAll("absent")}><RotateCcw className="h-4 w-4 mr-2" /> Mark All Absent</Button>
                  <Button variant="outline" size="sm" onClick={() => handleMarkAll("present")}><Users className="h-4 w-4 mr-2" /> Mark All Present</Button>
                  <Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-2" /> Save Draft</Button>
                  <Button size="sm" onClick={handleSubmit}><Send className="h-4 w-4 mr-2" /> Submit Attendance</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6">
        {/* Session Cards */}
        <div className="mb-6 flex items-center gap-2">
          <button
            type="button"
            onClick={() => sessionStripRef.current?.scrollBy({ left: -240, behavior: "smooth" })}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 shadow-sm hover:bg-slate-100"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div ref={sessionStripRef} className="flex-1 overflow-x-auto scroll-smooth pb-2">
            <div className="flex min-w-max gap-3 snap-x snap-mandatory">
              {sessionDays.map((day) => (
                <button
                  key={day.day}
                  onClick={() => setSelectedDay(day.day)}
                  className={`snap-center min-w-[130px] flex-shrink-0 rounded-lg px-3 py-2 text-center text-xs font-medium transition-all ${
                    selectedDay === day.day
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200 text-white"
                      : `${
                          day.status === "completed"
                            ? "bg-white text-slate-900 border border-green-200"
                            : day.status === "ongoing"
                              ? "bg-white text-slate-900 border border-yellow-200"
                              : day.date !== "—"
                                ? "bg-white text-slate-900 border border-blue-200"
                                : "bg-white text-slate-400 border border-slate-200"
                        } hover:shadow-md`
                  }`}
                >
                  <div className="font-semibold">Day {day.day}</div>
                  <div className="text-[10px] opacity-75">{day.date}</div>
                  {day.status === "completed" && <div className="text-green-500">✓</div>}
                  {day.status === "ongoing" && <div className="text-yellow-500">◐</div>}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => sessionStripRef.current?.scrollBy({ left: 240, behavior: "smooth" })}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 shadow-sm hover:bg-slate-100"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Analytics Cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl bg-white/60 backdrop-blur border border-white/50 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600">Total Students</p>
                <p className="text-2xl font-bold text-slate-900">{filteredStudents.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500/20" />
            </div>
          </div>

          <div className="rounded-xl bg-white/60 backdrop-blur border border-white/50 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600">Present</p>
                <p className="text-2xl font-bold text-green-600">{presentCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/20" />
            </div>
          </div>

          <div className="rounded-xl bg-white/60 backdrop-blur border border-white/50 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600">Absent</p>
                <p className="text-2xl font-bold text-red-600">{absentCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500/20" />
            </div>
          </div>

          <div className="rounded-xl bg-white/60 backdrop-blur border border-white/50 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600">Attendance %</p>
                <p className="text-2xl font-bold text-indigo-600">{attendancePercent.toFixed(0)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-indigo-500/20" />
            </div>
          </div>

          <div className="rounded-xl bg-white/60 backdrop-blur border border-white/50 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500/20" />
            </div>
          </div>

          <div className="rounded-xl bg-white/60 backdrop-blur border border-white/50 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div>
              <p className="text-xs font-medium text-slate-600">Last Updated</p>
              <p className="text-sm font-medium text-slate-900">Just now</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl bg-white/60 backdrop-blur border border-white/50 p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs font-semibold">Panchayat</Label>
              <Select value={panchayatFilter} onValueChange={setPanchayatFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Panchayats</SelectItem>
                  {s.panchayats.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Village</Label>
              <Select value={villageFilter} onValueChange={setVillageFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Villages</SelectItem>
                  {s.villages.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">School</Label>
              <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Schools</SelectItem>
                  {s.schools.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Standard</Label>
              <Select value={standardFilter} onValueChange={setStandardFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Standards</SelectItem>
                  {ATTENDANCE_STANDARDS.map((std) => (
                    <SelectItem key={std} value={std}>Standard {std}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Session</Label>
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Sessions</SelectItem>
                  <SelectItem value="2024-2025">2024-2025</SelectItem>
                  <SelectItem value="2025-2026">2025-2026</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Date</Label>
              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="mt-1" />
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold">Search Student</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="By name or roll number..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Table and Right Panel */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Table */}
          <div className="lg:col-span-2 rounded-xl bg-white/60 backdrop-blur border border-white/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 w-12">S.No</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Mobile</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Village</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Std</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Attendance</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Homework</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // group by village -> standard
                    const byVillage: Record<string, typeof filteredStudents> = {};
                    filteredStudents.forEach(st => {
                      const school = s.schools.find(sc => sc.id === st.schoolId);
                      const village = school ? s.villages.find(v => v.id === school.villageId) : undefined;
                      const vname = village?.name ?? "—";
                      byVillage[vname] = byVillage[vname] || [];
                      byVillage[vname].push(st);
                    });
                    const villageKeys = Object.keys(byVillage).sort();
                    let globalIndex = 0;
                    return villageKeys.map(vname => (
                      <React.Fragment key={vname}>
                        <tr className="bg-slate-100"><td colSpan={8} className="px-4 py-2 font-semibold">{vname}</td></tr>
                        {(["9","10","11","12"] as string[]).map(std => {
                          const studentsOfStd = byVillage[vname].filter(st => String(st.grade) === std);
                          if (studentsOfStd.length === 0) return null;
                          return (
                            <React.Fragment key={vname+std}>
                              <tr className="bg-white"><td colSpan={8} className="px-4 py-1 text-sm text-muted-foreground">Standard {std}</td></tr>
                              {studentsOfStd.map((student) => {
                                globalIndex += 1;
                                return (
                                  <tr key={student.id} className={`border-b border-slate-100 hover:bg-blue-50/50 transition-colors ${selectedStudent?.id === student.id ? "bg-blue-100/30" : ""}`}>
                                    <td className="px-4 py-3 text-slate-600">{globalIndex}</td>
                                    <td className="px-4 py-3 font-medium text-slate-900">{student.name}</td>
                                    <td className="px-4 py-3 text-slate-600">{student.phone}</td>
                                    <td className="px-4 py-3 text-slate-600 text-xs">{vname}</td>
                                    <td className="px-4 py-3 text-slate-600">{student.grade}</td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex items-center justify-center gap-3">
                                        <label className={`flex items-center gap-1 text-xs ${!canEdit ? "opacity-60" : ""}`}>
                                          <input type="radio" name={`att-${student.id}`} value="present" disabled={!canEdit} checked={attendance[student.id] === "present"} onChange={() => setAttendance((prev) => ({ ...prev, [student.id]: "present" }))} className="hidden" />
                                          <span className={`inline-block h-3 w-3 rounded-full mr-1 ${attendance[student.id] === "present" ? "bg-green-600" : "border border-slate-300"}`} />
                                          <span>P</span>
                                        </label>
                                        <label className={`flex items-center gap-1 text-xs ${!canEdit ? "opacity-60" : ""}`}>
                                          <input type="radio" name={`att-${student.id}`} value="absent" disabled={!canEdit} checked={attendance[student.id] === "absent"} onChange={() => setAttendance((prev) => ({ ...prev, [student.id]: "absent" }))} className="hidden" />
                                          <span className={`inline-block h-3 w-3 rounded-full mr-1 ${attendance[student.id] === "absent" ? "bg-red-600" : "border border-slate-300"}`} />
                                          <span>A</span>
                                        </label>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <label className="inline-flex items-center gap-2">
                                        <button
                                          type="button"
                                          disabled={!canEdit}
                                          onClick={() => setHomework((prev) => ({ ...prev, [student.id]: prev[student.id] === "completed" ? "incomplete" : "completed" }))}
                                          className={`h-4 w-4 rounded-full border ${homework[student.id] === "completed" ? "bg-green-600 border-green-600" : "bg-white border-slate-300"}`}
                                          aria-pressed={homework[student.id] === "completed"}
                                        />
                                        <span className="text-xs">{homework[student.id] === "completed" ? "Completed" : homework[student.id] === "incomplete" ? "Incomplete" : "Pending"}</span>
                                      </label>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <button
                                        onClick={() => setSelectedStudent(student)}
                                        className="text-slate-600 hover:text-blue-600 transition-colors"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </button>
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

          {/* Right Panel */}
          <div className="lg:col-span-1">
            {selectedStudent ? (
              <div className="rounded-xl bg-gradient-to-br from-white/80 to-blue-50/50 backdrop-blur border border-white/50 shadow-sm p-5 sticky top-20">
                <div className="space-y-4">
                  {/* Student Header */}
                  <div className="text-center pb-4 border-b border-slate-200">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 text-white font-bold mb-2">
                      {selectedStudent.name.charAt(0)}
                    </div>
                    <h3 className="font-semibold text-slate-900">{selectedStudent.name}</h3>
                    <p className="text-xs text-slate-600">{s.schools.find((sc) => sc.id === selectedStudent.schoolId)?.name}</p>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Standard</span>
                      <span className="font-medium text-slate-900">{selectedStudent.grade}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Mobile</span>
                      <span className="font-medium text-slate-900">{selectedStudent.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Homework</span>
                      <span className="font-medium text-slate-900">{homework[selectedStudent.id] === "completed" ? "Completed" : homework[selectedStudent.id] === "incomplete" ? "Incomplete" : "Pending"}</span>
                    </div>
                  </div>

                  {/* Attendance History */}
                  <div className="pt-3 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-900 mb-2">Attendance History</p>
                    <div className="space-y-1">
                      {["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7", "Day 8"].map((day, i) => (
                        <div key={day} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{day}</span>
                          <span className={i < 3 ? "text-green-600 font-medium" : i === 3 ? "text-yellow-600 font-medium" : "text-slate-400"}>
                            {i < 3 ? "✓" : i === 3 ? "◐" : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Progress Charts */}
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700">Attendance %</span>
                        <span className="text-xs font-bold text-slate-900">87.5%</span>
                      </div>
                      <Progress value={87.5} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700">Homework %</span>
                        <span className="text-xs font-bold text-slate-900">65%</span>
                      </div>
                      <Progress value={65} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700">Completion %</span>
                        <span className="text-xs font-bold text-slate-900">92%</span>
                      </div>
                      <Progress value={92} className="h-1.5" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-white/60 backdrop-blur border border-white/50 shadow-sm p-8 text-center flex items-center justify-center h-96">
                <div className="text-slate-500">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">Select a student to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Export Buttons */}
        <div className="mt-6 flex gap-2 justify-end">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" /> Export Excel
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </Button>
        </div>
      </div>
    </div>

    </AppShell>
  );
}
