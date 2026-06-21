import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { KpiCard } from "@/components/layout/kpi-card";
import { DataTable } from "@/components/layout/data-table";
import { ClipboardCheck, Users, HeartHandshake, Save } from "lucide-react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/attendance")({
  head: () => ({ meta: [{ title: "Attendance — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const stRows = s.attendance.filter(a => a.type === "student");
  const totalP = stRows.reduce((a,b)=>a+b.present,0);
  const totalT = stRows.reduce((a,b)=>a+b.total,0);
  const pct = totalT ? (totalP/totalT)*100 : 0;
  const [bulkOpen, setBulkOpen] = useState(false);
  const sName = (id: string) => s.schools.find(x => x.id === id)?.name ?? "—";

  return (
    <AppShell>
      <PageHeader title="Attendance" description="Track student & volunteer attendance." actions={<Button onClick={() => setBulkOpen(true)}><Save className="h-4 w-4" /> Bulk Attendance</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Avg Attendance" value={pct.toFixed(1)+"%"} icon={ClipboardCheck} tone="success" />
        <KpiCard label="Students Present" value={totalP.toLocaleString()} icon={Users} tone="primary" />
        <KpiCard label="Total Records" value={s.attendance.length} icon={ClipboardCheck} tone="info" />
        <KpiCard label="Volunteers" value={s.volunteers.length} icon={HeartHandshake} tone="secondary" />
      </div>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Student Attendance</TabsTrigger>
          <TabsTrigger value="volunteers">Volunteer Attendance</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Entry</TabsTrigger>
        </TabsList>
        <TabsContent value="students" className="mt-4">
          <DataTable
            exportName="attendance-students" rows={stRows} searchKeys={["date"] as any}
            columns={[
              { key: "date", header: "Date" },
              { key: "school", header: "School", render: (r) => sName(r.schoolId) },
              { key: "present", header: "Present" },
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
        </TabsContent>
        <TabsContent value="volunteers" className="mt-4">
          <DataTable
            exportName="attendance-volunteers" rows={s.volunteers}
            searchKeys={["name","skill"] as any}
            columns={[
              { key: "name", header: "Volunteer" },
              { key: "skill", header: "Skill", render: (r) => <Badge variant="outline">{r.skill}</Badge> },
              { key: "sessions", header: "Sessions" },
              { key: "_pct", header: "Attendance %", render: (r) => {
                const p = Math.min(100, (r.sessions/8)*100);
                return <div className="flex items-center gap-2"><Progress value={p} className="h-1.5 w-24" /><span className="text-xs">{p.toFixed(0)}%</span></div>;
              } },
            ]}
          />
        </TabsContent>
        <TabsContent value="bulk" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Mark today's attendance</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {s.students.slice(0, 12).map(st => (
                  <label key={st.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                    <span>{st.name} · <span className="text-muted-foreground">{st.rollNo}</span></span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7" onClick={() => toast.success("Marked present")}>Present</Button>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => toast.success("Marked absent")}>Absent</Button>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {bulkOpen && (
        <Card className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md shadow-glow">
          <CardContent className="flex items-center justify-between p-4">
            <div><div className="font-medium">Bulk update saved</div><div className="text-xs text-muted-foreground">All records refreshed.</div></div>
            <Button size="sm" onClick={() => setBulkOpen(false)}>Close</Button>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
