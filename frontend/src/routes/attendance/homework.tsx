import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KpiCard } from "@/components/layout/kpi-card";
import { DataTable } from "@/components/layout/data-table";
import { BookCheck, Users, School as SchoolIcon, Download, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useState } from "react";

export const Route = createFileRoute("/attendance/homework")({
  head: () => ({ meta: [{ title: "Homework — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const [session, setSession] = useState("");
  const [date, setDate] = useState("");
  const [panchayat, setPanchayat] = useState("");
  const [village, setVillage] = useState("");
  const [school, setSchool] = useState("");
  const [standard, setStandard] = useState("");
  
  const totals = s.homework.reduce((a, r) => ({ c: a.c + r.completed, p: a.p + r.partial, n: a.n + r.notDone }), { c: 0, p: 0, n: 0 });
  const t = totals.c + totals.p + totals.n;
  const sName = (id: string) => s.schools.find(x => x.id === id)?.name ?? "—";
  const byCluster = s.clusters.map(c => {
    const pIds = s.panchayats.filter(p => p.clusterId === c.id).map(p => p.id);
    const vIds = s.villages.filter(v => pIds.includes(v.panchayatId)).map(v => v.id);
    const scIds = s.schools.filter(sc => vIds.includes(sc.villageId)).map(sc => sc.id);
    const rows = s.homework.filter(h => scIds.includes(h.schoolId));
    const sum = rows.reduce((a, r) => ({ c: a.c + r.completed, p: a.p + r.partial, n: a.n + r.notDone }), { c: 0, p: 0, n: 0 });
    return { name: (c.name ?? c.code ?? "Cluster").split(" ")[0], ...sum };
  });

  return (
    <AppShell>
      <PageHeader 
        title="Homework" 
        description="Track completion across students, schools and clusters."
        actions={
          <div className="flex gap-2">
            <Button variant="outline"><Zap className="h-4 w-4" /> Bulk Update</Button>
            <Button><Download className="h-4 w-4" /> Export</Button>
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

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Completed %" value={t ? ((totals.c/t)*100).toFixed(1)+"%" : "—"} icon={BookCheck} tone="success" />
        <KpiCard label="Partial %" value={t ? ((totals.p/t)*100).toFixed(1)+"%" : "—"} icon={BookCheck} tone="warning" />
        <KpiCard label="Not Done %" value={t ? ((totals.n/t)*100).toFixed(1)+"%" : "—"} icon={BookCheck} tone="default" />
        <KpiCard label="Schools tracked" value={new Set(s.homework.map(h=>h.schoolId)).size} icon={SchoolIcon} tone="info" />
      </div>

      <Card className="mb-4 shadow-card">
        <CardHeader><CardTitle className="text-base">Cluster-wise homework</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCluster}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              <Legend />
              <Bar dataKey="c" stackId="a" name="Completed" fill="var(--color-success)" />
              <Bar dataKey="p" stackId="a" name="Partial" fill="var(--color-warning)" />
              <Bar dataKey="n" stackId="a" name="Not Done" fill="var(--color-destructive)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Student Homework Status</CardTitle>
            <Button variant="ghost" size="sm"><Download className="h-4 w-4" /> Export</Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            exportName="homework"
            rows={s.students.slice(0, 100)}
            searchKeys={["name","rollNo"] as any}
            columns={[
              { key: "rollNo", header: "Roll" },
              { key: "name", header: "Student Name" },
              { key: "school", header: "School", render: (r) => sName(r.schoolId) },
              { key: "standard", header: "Standard", render: (r) => r.standard ?? "—" },
              { key: "_status", header: "Homework Status", render: () => {
                const r = Math.random();
                return r > 0.6 ? <Badge className="bg-success text-success-foreground">Completed</Badge> :
                  r > 0.3 ? <Badge variant="outline">Partially Completed</Badge> : <Badge variant="destructive">Not Completed</Badge>;
              } },
            ]}
          />
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-2">
        <Button>Update Homework</Button>
        <Button variant="outline"><Zap className="h-4 w-4" /> Bulk Update</Button>
        <Button variant="outline">Homework History</Button>
        <Button variant="outline"><Download className="h-4 w-4" /> Export</Button>
      </div>
    </AppShell>
  );
}
