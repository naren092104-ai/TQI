import React, { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  RotateCcw,
  Save,
  Send,
  Search,
  Eye,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRef } from "react";

// Allowed years — dropdown only
const VOLUNTEER_YEARS = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
] as const;

function yearLabel(val?: string) {
  return VOLUNTEER_YEARS.find(y => y.value === val)?.label ?? val ?? "—";
}

function VolunteersPage() {
  const s = useStore();
  const sessionStripRef = useRef<HTMLDivElement | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedVolunteer, setSelectedVolunteer] = useState<any>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Filters
  const [collegeFilter, setCollegeFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [volunteerSearch, setVolunteerSearch] = useState("");

  // Attendance state
  const [attendance, setAttendance] = useState<Record<string, "present" | "absent" | "pending">>(
    Object.fromEntries(s.volunteers.map((v) => [v.id, "pending"]))
  );

  // Mock session days
  const sessionDays = Array.from({ length: 8 }, (_, i) => ({
    day: i + 1,
    date: new Date(Date.now() - (7 - i) * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN"),
    status: i < 4 ? "completed" : i === 4 ? "pending" : "upcoming",
  }));

  // Filtered volunteers
  const filteredVolunteers = useMemo(() => {
    return s.volunteers.filter((v) => {
      const college = s.colleges.find((c) => c.id === v.collegeId);
      return (
        (!volunteerSearch || v.name.toLowerCase().includes(volunteerSearch.toLowerCase()) || v.skill.toLowerCase().includes(volunteerSearch.toLowerCase())) &&
        (!collegeFilter || college?.id === collegeFilter) &&
        (!yearFilter || v.year === yearFilter)
      );
    });
  }, [s.volunteers, s.colleges, volunteerSearch, collegeFilter, yearFilter]);

  const presentCount = filteredVolunteers.filter((v) => attendance[v.id] === "present").length;
  const absentCount = filteredVolunteers.filter((v) => attendance[v.id] === "absent").length;
  const pendingCount = filteredVolunteers.filter((v) => attendance[v.id] === "pending").length;
  const attendancePercent = filteredVolunteers.length > 0 ? (presentCount / filteredVolunteers.length) * 100 : 0;

  const handleMarkAll = (status: "present" | "absent") => {
    const newAttendance: Record<string, "present" | "absent" | "pending"> = {};
    filteredVolunteers.forEach((v) => {
      newAttendance[v.id] = status;
    });
    setAttendance((prev) => ({ ...prev, ...newAttendance }));
    toast.success(`Marked all as ${status}`);
  };

  const handleSave = () => {
    toast.success("Attendance saved successfully");
  };

  const handleSubmit = () => {
    if (pendingCount > 0) {
      return toast.error(`${pendingCount} volunteers still pending`);
    }
    toast.success("Attendance submitted");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-white/50 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Volunteers Attendance</h1>
              <p className="text-sm text-slate-600">Track and manage volunteer attendance records</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleMarkAll("absent")}>
                <RotateCcw className="h-4 w-4 mr-2" /> Mark All Absent
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleMarkAll("present")}>
                <Users className="h-4 w-4 mr-2" /> Mark All Present
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
              <Button size="sm" onClick={handleSubmit}>
                <Send className="h-4 w-4 mr-2" /> Submit
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
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
                            : day.status === "pending"
                              ? "bg-white text-slate-900 border border-yellow-200"
                              : "bg-white text-slate-400 border border-slate-200"
                        } hover:shadow-md`
                  }`}
                >
                  <div className="font-semibold">Day {day.day}</div>
                  <div className="text-[10px] opacity-75">{day.date}</div>
                  {day.status === "completed" && <div className="text-green-500">✓</div>}
                  {day.status === "pending" && <div className="text-yellow-500">◐</div>}
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
                <p className="text-xs font-medium text-slate-600">Total Volunteers</p>
                <p className="text-2xl font-bold text-slate-900">{filteredVolunteers.length}</p>
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
              <Label className="text-xs font-semibold">College</Label>
              <Select value={collegeFilter} onValueChange={setCollegeFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Colleges</SelectItem>
                  {s.colleges.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Year</Label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Years</SelectItem>
                  {VOLUNTEER_YEARS.map((y) => (
                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
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
                  {[1,2,3,4,5,6,7,8].map((d) => (
                    <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Date</Label>
              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="mt-1" />
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <Label className="text-xs font-semibold">Search Volunteer</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="By name or skill..."
                  value={volunteerSearch}
                  onChange={(e) => setVolunteerSearch(e.target.value)}
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
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 w-10">
                      <Checkbox />
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">College</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Year</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Mobile</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Attendance</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Remarks</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVolunteers.map((volunteer) => (
                    <tr
                      key={volunteer.id}
                      className={`border-b border-slate-100 hover:bg-blue-50/50 transition-colors ${
                        selectedVolunteer?.id === volunteer.id ? "bg-blue-100/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedRows.has(volunteer.id)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedRows);
                            if (checked) {
                              newSet.add(volunteer.id);
                            } else {
                              newSet.delete(volunteer.id);
                            }
                            setSelectedRows(newSet);
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{volunteer.name}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {volunteer.college || s.colleges.find((c) => c.id === (volunteer as any).collegeId)?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{yearLabel(volunteer.year)}</td>
                      <td className="px-4 py-3 text-slate-600">{volunteer.phone}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() =>
                              setAttendance((prev) => ({
                                ...prev,
                                [volunteer.id]: attendance[volunteer.id] === "present" ? "pending" : "present",
                              }))
                            }
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                              attendance[volunteer.id] === "present"
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            P
                          </button>
                          <button
                            onClick={() =>
                              setAttendance((prev) => ({
                                ...prev,
                                [volunteer.id]: attendance[volunteer.id] === "absent" ? "pending" : "absent",
                              }))
                            }
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                              attendance[volunteer.id] === "absent"
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            A
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className="text-xs">—</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedVolunteer(volunteer)}
                          className="text-slate-600 hover:text-blue-600 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-1">
            {selectedVolunteer ? (
              <div className="rounded-xl bg-gradient-to-br from-white/80 to-blue-50/50 backdrop-blur border border-white/50 shadow-sm p-5 sticky top-20">
                <div className="space-y-4">
                  {/* Volunteer Header */}
                  <div className="text-center pb-4 border-b border-slate-200">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 text-white font-bold mb-2">
                      {selectedVolunteer.name.charAt(0)}
                    </div>
                    <h3 className="font-semibold text-slate-900">{selectedVolunteer.name}</h3>
                    <p className="text-xs text-slate-600">{selectedVolunteer.skill}</p>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">College</span>
                      <span className="font-medium text-slate-900 text-right">{selectedVolunteer.college || s.colleges.find((c: any) => c.id === selectedVolunteer.collegeId)?.name || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Department</span>
                      <span className="font-medium text-slate-900">{selectedVolunteer.department || selectedVolunteer.skill}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Year</span>
                      <span className="font-medium text-slate-900">{yearLabel(selectedVolunteer.year)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Mobile</span>
                      <span className="font-medium text-slate-900">{selectedVolunteer.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Sessions</span>
                      <span className="font-medium text-slate-900">{selectedVolunteer.sessions}</span>
                    </div>
                  </div>

                  {/* Attendance History */}
                  <div className="pt-3 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-900 mb-2">Attendance History</p>
                    <div className="space-y-1">
                      {["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7", "Day 8"].map((day, i) => (
                        <div key={day} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{day}</span>
                          <span className={[0, 2, 3].includes(i) ? "text-green-600 font-medium" : i === 1 ? "text-red-600 font-medium" : "text-slate-400"}>
                            {[0, 2, 3].includes(i) ? "✓" : i === 1 ? "✗" : "—"}
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
                        <span className="text-xs font-bold text-slate-900">75%</span>
                      </div>
                      <Progress value={75} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700">Completion %</span>
                        <span className="text-xs font-bold text-slate-900">88%</span>
                      </div>
                      <Progress value={88} className="h-1.5" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-white/60 backdrop-blur border border-white/50 shadow-sm p-8 text-center flex items-center justify-center h-96">
                <div className="text-slate-500">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">Select a volunteer to view details</p>
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
  );
}

export const Route = createFileRoute("/attendance/volunteers")({
  head: () => ({ meta: [{ title: "Volunteers Attendance — TQI" }] }),
  component: VolunteersPage,
});
