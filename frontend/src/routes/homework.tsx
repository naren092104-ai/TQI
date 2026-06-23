import { createFileRoute } from "@tanstack/react-router";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/layout/kpi-card";
import { DataTable } from "@/components/layout/data-table";
import { BookCheck, Users, School as SchoolIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const Route = createFileRoute("/homework")({
  head: () => ({ meta: [{ title: "Homework — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
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
      <PageHeader title="Homework" description="Track completion across students, schools and clusters." />
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

      <Tabs defaultValue="school">
        <TabsList>
          <TabsTrigger value="school"><SchoolIcon className="h-4 w-4" /> School-wise</TabsTrigger>
          <TabsTrigger value="student"><Users className="h-4 w-4" /> Student-wise</TabsTrigger>
        </TabsList>
        <TabsContent value="school" className="mt-4">
          <DataTable
            exportName="homework-school" rows={s.homework} searchKeys={["date"] as any}
            columns={[
              { key: "date", header: "Date" },
              { key: "school", header: "School", render: (r) => sName(r.schoolId) },
              { key: "completed", header: "Completed", render: (r) => <Badge className="bg-success text-success-foreground">{r.completed}</Badge> },
              { key: "partial", header: "Partial", render: (r) => <Badge variant="outline">{r.partial}</Badge> },
              { key: "notDone", header: "Not Done", render: (r) => <Badge variant="destructive">{r.notDone}</Badge> },
            ]}
          />
        </TabsContent>
        <TabsContent value="student" className="mt-4">
          <DataTable
            exportName="homework-student" rows={s.students.slice(0, 100)} searchKeys={["name","rollNo"] as any}
            columns={[
              { key: "rollNo", header: "Roll" },
              { key: "name", header: "Student" },
              { key: "school", header: "School", render: (r) => sName(r.schoolId) },
              { key: "_status", header: "Status", render: () => {
                const r = Math.random();
                return r > 0.6 ? <Badge className="bg-success text-success-foreground">Completed</Badge> :
                  r > 0.3 ? <Badge variant="outline">Partial</Badge> : <Badge variant="destructive">Not Done</Badge>;
              } },
            ]}
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
