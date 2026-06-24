import { createFileRoute, Link } from "@tanstack/react-router";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { KpiCard } from "@/components/layout/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { inr } from "@/lib/format";
import {
  Network, MapPin, Trees, School as SchoolIcon, Users, HeartHandshake, BookOpen,
  Wallet, Banknote, Undo2, ShieldCheck, ClipboardCheck, BookCheck, Activity,
  Plus, FileText, RefreshCw,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, Legend,
} from "recharts";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — TQI Admin" }] }),
  component: Dashboard,
});

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const trend = (base: number, vol = 0.2) =>
  months.map((m, i) => ({ name: m, value: Math.round(base * (1 + Math.sin(i / 1.5) * vol + i * 0.04)) }));

function Dashboard() {
  const s = useStore();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await s.reload();
      toast.success("Data refreshed");
    } catch {
      toast.error("Refresh failed — check backend");
    } finally {
      setRefreshing(false);
    }
  };
  const totalExp = s.expenses.reduce((a, b) => a + b.amount, 0);
  const totalAdv = s.advances.reduce((a, b) => a + b.amount, 0);
  const totalRef = s.refunds.reduce((a, b) => a + b.amount, 0);
  const pendingAppr = s.approvals.filter((a) => a.status === "Pending").length;
  const pendingSettle = s.advances.filter((a) => a.status !== "Settled").length;
  const pendingTL = s.timeline.filter((t) => t.status !== "Completed" && t.status !== "Locked").length;
  const attAgg = s.attendance.reduce((a, r) => ({ p: a.p + r.present, t: a.t + r.total }), { p: 0, t: 0 });
  const hwAgg = s.homework.reduce((a, r) => ({ c: a.c + r.completed, t: a.t + r.completed + r.partial + r.notDone }), { c: 0, t: 0 });

  const studentGrowth = trend(s.students.length / 8, 0.25);
  const volunteerGrowth = trend(s.volunteers.length / 6, 0.3);
  const financeTrend = trend(totalExp / 8, 0.4);
  const clusterPerf = s.clusters.map((c) => {
    const pCount = s.panchayats.filter((p) => p.clusterId === c.id).length;
    const vCount = s.villages.filter((v) => s.panchayats.find((p) => p.id === v.panchayatId && p.clusterId === c.id)).length;
    return { name: (c.name ?? c.code ?? "Cluster").split(" ")[0], panchayats: pCount, villages: vCount, volunteers: s.volunteers.filter((v) => v.clusterId === c.id).length };
  });
  const attendanceTrend = trend(75, 0.1).map((d) => ({ ...d, value: Math.min(98, d.value) }));

  const kpis = [
    { label: "Total Clusters", value: s.clusters.length, icon: Network, tone: "primary" as const },
    { label: "Total Panchayats", value: s.panchayats.length, icon: MapPin, tone: "info" as const },
    { label: "Total Villages", value: s.villages.length, icon: Trees, tone: "success" as const },
    { label: "Total Schools", value: s.schools.length, icon: SchoolIcon, tone: "secondary" as const },
    { label: "Total Students", value: s.students.length, icon: Users, tone: "primary" as const },
    { label: "Total Volunteers", value: s.volunteers.length, icon: HeartHandshake, tone: "secondary" as const },
    { label: "Total Sessions", value: s.sessions.length, icon: BookOpen, tone: "info" as const },
    { label: "Total Expenses", value: inr(totalExp), icon: Wallet, tone: "warning" as const },
    { label: "Total Advances", value: inr(totalAdv), icon: Banknote, tone: "info" as const },
    { label: "Total Refunds", value: inr(totalRef), icon: Undo2, tone: "success" as const },
    { label: "Pending Approvals", value: pendingAppr, icon: ShieldCheck, tone: "warning" as const },
    { label: "Pending Settlements", value: pendingSettle, icon: Activity, tone: "warning" as const },
    { label: "Pending Timeline", value: pendingTL, icon: Activity, tone: "warning" as const },
    { label: "Attendance %", value: attAgg.t ? ((attAgg.p / attAgg.t) * 100).toFixed(1) + "%" : "0%", icon: ClipboardCheck, tone: "success" as const },
    { label: "Homework %", value: hwAgg.t ? ((hwAgg.c / hwAgg.t) * 100).toFixed(1) + "%" : "0%", icon: BookCheck, tone: "success" as const },
  ];

  const quick = [
    { to: "/clusters", label: "Clusters" },
    { to: "/panchayats", label: "Panchayats" },
    { to: "/villages", label: "Villages" },
    { to: "/schools", label: "Schools" },
    { to: "/colleges", label: "Colleges" },
    { to: "/admins", label: "Admins" },
    { to: "/sessions", label: "Sessions" },
    { to: "/timeline", label: "Timeline" },
    { to: "/approvals", label: "Approvals" },
    { to: "/reports", label: "Reports" },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description="Real-time overview of the entire TQI program."
        badge="Live"
        actions={
          <>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" asChild><Link to="/reports"><FileText className="h-4 w-4" /> Reports</Link></Button>
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90" asChild>
              <Link to="/clusters"><Plus className="h-4 w-4" /> Quick Create</Link>
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Student Growth</CardTitle><span className="text-xs text-muted-foreground">12 months</span></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={studentGrowth}>
                <defs><linearGradient id="g1" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} /><stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                <Area type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Volunteer Growth</CardTitle><span className="text-xs text-muted-foreground">12 months</span></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={volunteerGrowth}>
                <defs><linearGradient id="g2" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--color-secondary)" stopOpacity={0.5} /><stop offset="100%" stopColor="var(--color-secondary)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                <Area type="monotone" dataKey="value" stroke="var(--color-secondary)" strokeWidth={2} fill="url(#g2)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Attendance & Homework Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                <Legend />
                <Line type="monotone" dataKey="value" name="Attendance %" stroke="var(--color-success)" strokeWidth={2} />
                <Line type="monotone" dataKey="value" name="Homework %" stroke="var(--color-chart-4)" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Finance / Advance / Refund Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={financeTrend.map((d, i) => ({ ...d, advance: Math.round(d.value * 1.3), refund: Math.round(d.value * 0.2) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                <Legend />
                <Line type="monotone" dataKey="value" name="Expenses" stroke="var(--color-primary)" strokeWidth={2} />
                <Line type="monotone" dataKey="advance" name="Advance" stroke="var(--color-secondary)" strokeWidth={2} />
                <Line type="monotone" dataKey="refund" name="Refund" stroke="var(--color-success)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-card lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Cluster Performance</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={clusterPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                <Legend />
                <Bar dataKey="panchayats" fill="var(--color-primary)" radius={[4,4,0,0]} />
                <Bar dataKey="villages" fill="var(--color-secondary)" radius={[4,4,0,0]} />
                <Bar dataKey="volunteers" fill="var(--color-info)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-card">
        <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {quick.map((q) => (
              <Button key={q.to} variant="outline" className="h-auto justify-start py-3 text-left" asChild>
                <Link to={q.to}><Plus className="h-4 w-4" /> {q.label}</Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
