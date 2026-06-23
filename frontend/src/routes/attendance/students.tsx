import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/layout/data-table";
import { ClipboardCheck, Users, Download, RotateCcw, Save } from "lucide-react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/attendance/students")({
  head: () => ({ meta: [{ title: "Students Attendance — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const stRows = s.attendance.filter(a => a.type === "student");
  const totalP = stRows.reduce((a,b)=>a+b.present,0);
  const totalT = stRows.reduce((a,b)=>a+b.total,0);
  const pct = totalT ? (totalP/totalT)*100 : 0;
  
  const [session, setSession] = useState("");
  const [date, setDate] = useState("");
  const [panchayat, setPanchayat] = useState("");
  const [village, setVillage] = useState("");
  const [school, setSchool] = useState("");
  const [standard, setStandard] = useState("");
  
  const sName = (id: string) => s.schools.find(x => x.id === id)?.name ?? "—";

  return (
    <AppShell>
      <PageHeader 
        title="Students Attendance" 
        description="Track and manage student attendance records."
        actions={
          <div className="flex gap-2">
            <Button variant="outline"><RotateCcw className="h-4 w-4" /> Mark All Absent</Button>
            <Button variant="outline"><ClipboardCheck className="h-4 w-4" /> Mark All Present</Button>
            <Button><Save className="h-4 w-4" /> Save Attendance</Button>
          </div>
        } 
      />

      <div className="mb-6 grid gap-4 rounded-lg border border-border bg-card/50 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <Label className="text-xs font-semibold">Session</Label>
            <Select value={session} onValueChange={setSession}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select session" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2024-2025">2024-2025</SelectItem>
                <SelectItem value="2025-2026">2025-2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-semibold">Panchayat</Label>
            <Select value={panchayat} onValueChange={setPanchayat}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Panchayats</SelectItem>
                {s.panchayats.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold">Village</Label>
            <Select value={village} onValueChange={setVillage}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Villages</SelectItem>
                {s.villages.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold">School</Label>
            <Select value={school} onValueChange={setSchool}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Schools</SelectItem>
                {s.schools.map(sc => <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold">Standard</Label>
            <Select value={standard} onValueChange={setStandard}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Standards</SelectItem>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card className="mb-6 shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" /> Attendance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <div className="text-sm text-muted-foreground">Average Attendance</div>
              <div className="mt-1 text-2xl font-bold">{pct.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Present</div>
              <div className="mt-1 text-2xl font-bold">{totalP.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Records</div>
              <div className="mt-1 text-2xl font-bold">{stRows.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Attendance Records</CardTitle>
            <Button variant="ghost" size="sm"><Download className="h-4 w-4" /> Export</Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            exportName="attendance-students"
            rows={stRows}
            searchKeys={["date"] as any}
            columns={[
              { key: "date", header: "Date" },
              { key: "school", header: "School", render: (r) => sName(r.schoolId) },
              { key: "present", header: "Present" },
              { key: "absent", header: "Absent", render: (r) => r.total - r.present },
              { key: "total", header: "Total" },
              { key: "pct", header: "%", render: (r) => {
                const p = r.total ? (r.present/r.total)*100 : 0;
                return (
                  <div className="flex items-center gap-2">
                    <Progress value={p} className="h-1.5 w-24" />
                    <span className="text-xs">{p.toFixed(0)}%</span>
                  </div>
                );
              } },
            ]}
          />
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-2">
        <Button><Save className="h-4 w-4" /> Save Attendance</Button>
        <Button variant="outline">Attendance History</Button>
        <Button variant="outline"><Download className="h-4 w-4" /> Export</Button>
      </div>
    </AppShell>
  );
}
