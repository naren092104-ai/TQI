import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/layout/data-table";
import { Users, Download, RotateCcw, Save } from "lucide-react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/attendance/volunteers")({
  head: () => ({ meta: [{ title: "Volunteers Attendance — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  
  const [session, setSession] = useState("");
  const [date, setDate] = useState("");
  const [volunteer, setVolunteer] = useState("");
  const [college, setCollege] = useState("");

  return (
    <AppShell>
      <PageHeader 
        title="Volunteers Attendance" 
        description="Track and manage volunteer attendance records."
        actions={
          <div className="flex gap-2">
            <Button variant="outline"><RotateCcw className="h-4 w-4" /> Mark All Absent</Button>
            <Button variant="outline"><Users className="h-4 w-4" /> Mark All Present</Button>
            <Button><Save className="h-4 w-4" /> Save Attendance</Button>
          </div>
        } 
      />

      <div className="mb-6 grid gap-4 rounded-lg border border-border bg-card/50 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <Label className="text-xs font-semibold">Volunteer</Label>
            <Input placeholder="Search volunteer..." value={volunteer} onChange={(e) => setVolunteer(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-semibold">College</Label>
            <Select value={college} onValueChange={setCollege}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Colleges</SelectItem>
                {s.colleges.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card className="mb-6 shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Volunteers Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <div className="text-sm text-muted-foreground">Total Volunteers</div>
              <div className="mt-1 text-2xl font-bold">{s.volunteers.length}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Active This Week</div>
              <div className="mt-1 text-2xl font-bold">{Math.floor(s.volunteers.length * 0.75)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Average Attendance</div>
              <div className="mt-1 text-2xl font-bold">{(65 + Math.random() * 20).toFixed(1)}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Volunteer Records</CardTitle>
            <Button variant="ghost" size="sm"><Download className="h-4 w-4" /> Export</Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            exportName="attendance-volunteers"
            rows={s.volunteers}
            searchKeys={["name","skill"] as any}
            columns={[
              { key: "name", header: "Volunteer Name" },
              { key: "skill", header: "Skill", render: (r) => <Badge variant="outline">{r.skill}</Badge> },
              { key: "college", header: "College", render: (r) => s.colleges.find(c => c.id === r.collegeId)?.name ?? "—" },
              { key: "sessions", header: "Sessions", render: (r) => <span className="font-medium">{r.sessions}</span> },
              { key: "_pct", header: "Attendance %", render: (r) => {
                const p = Math.min(100, (r.sessions/8)*100);
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
