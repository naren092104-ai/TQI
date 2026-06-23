import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, isClusterAdmin } from "@/lib/auth";
import { ClusterAdminShell } from "@/components/layout/cluster-admin-shell";
import { KpiCard } from "@/components/layout/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import {
  MapPin, Trees, School as SchoolIcon, Users, HeartHandshake,
  ClipboardCheck, BookCheck, Wallet, Bell, Activity, ChevronRight,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/cluster-dashboard")({
  head: () => ({ meta: [{ title: "Cluster Dashboard — TQI" }] }),
  component: ClusterDashboard,
});

function ClusterDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const s = useStore();

  // Guard — only Cluster Admin can access. Wait until user is loaded.
  useEffect(() => {
    if (!user) return; // still loading, don't redirect yet
    if (!isClusterAdmin(user.role)) {
      nav({ to: "/" });
    }
  }, [user, nav]);

  // Get this cluster admin's cluster
  const clusterId = user?.clusterId ?? "";
  const cluster = s.clusters.find((c) => c.id === clusterId);
  const panchayats = s.panchayats.filter((p) => p.clusterId === clusterId);
  const panchayatIds = panchayats.map((p) => p.id);
  const villages = s.villages.filter((v) => panchayatIds.includes(v.panchayatId));
  const villageIds = villages.map((v) => v.id);
  const schools = s.schools.filter((sc) => villageIds.includes(sc.villageId));
  const schoolIds = schools.map((sc) => sc.id);
  const students = s.students.filter((st) => schoolIds.includes(st.schoolId));
  const volunteers = s.volunteers.filter((v) => v.clusterId === clusterId);

  const attAgg = s.attendance
    .filter((a) => schoolIds.includes(a.schoolId))
    .reduce((acc, r) => ({ p: acc.p + r.present, t: acc.t + r.total }), { p: 0, t: 0 });
  const hwAgg = s.homework
    .filter((h) => schoolIds.includes(h.schoolId))
    .reduce((acc, r) => ({ c: acc.c + r.completed, t: acc.t + r.completed + r.partial + r.notDone }), { c: 0, t: 0 });

  const totalExpenses = s.expenses.reduce((a, b) => a + b.amount, 0);
  const pendingApprovals = s.approvals.filter((a) => a.status === "Pending").length;
  const pendingTasks = s.timeline.filter((t) => t.status !== "Completed" && t.status !== "Locked").length;
  const unreadNotifs = s.notifications.filter((n) => !n.read).length;

  const recentActivities = [
    { label: "Attendance marked for Day 5", time: "2h ago", color: "bg-green-500" },
    { label: "Finance entry submitted", time: "4h ago", color: "bg-blue-500" },
    { label: "3 new students added", time: "Yesterday", color: "bg-purple-500" },
    { label: "Homework updated for Standard 10", time: "Yesterday", color: "bg-orange-500" },
    { label: "Volunteer attendance saved", time: "2 days ago", color: "bg-teal-500" },
  ];

  return (
    <ClusterAdminShell>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">
              {cluster ? cluster.name : "My Cluster"} — Dashboard
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome back, <span className="font-medium text-foreground">{user?.name}</span>
            </p>
          </div>
          {unreadNotifs > 0 && (
            <Link to="/cluster-notifications">
              <Button variant="outline" className="gap-2">
                <Bell className="h-4 w-4" />
                <Badge variant="destructive">{unreadNotifs}</Badge>
                Notifications
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Total Panchayats" value={panchayats.length} icon={MapPin} tone="primary" />
        <KpiCard label="Total Villages" value={villages.length} icon={Trees} tone="success" />
        <KpiCard label="Total Schools" value={schools.length} icon={SchoolIcon} tone="secondary" />
        <KpiCard label="Total Students" value={students.length} icon={Users} tone="info" />
        <KpiCard label="Total Volunteers" value={volunteers.length} icon={HeartHandshake} tone="warning" />
        <KpiCard
          label="Attendance %"
          value={attAgg.t ? ((attAgg.p / attAgg.t) * 100).toFixed(1) + "%" : "0%"}
          icon={ClipboardCheck}
          tone="success"
        />
        <KpiCard
          label="Homework %"
          value={hwAgg.t ? ((hwAgg.c / hwAgg.t) * 100).toFixed(1) + "%" : "0%"}
          icon={BookCheck}
          tone="success"
        />
        <KpiCard label="Total Expenses" value={inr(totalExpenses)} icon={Wallet} tone="warning" />
      </div>

      {/* Pending Tasks + Finance Summary */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Pending Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Attendance Pending", count: pendingApprovals, color: "text-yellow-600", link: "/cluster-attendance/students" },
              { label: "Finance Pending", count: s.expenses.filter(e => e.status === "Pending").length, color: "text-orange-600", link: "/cluster-finance" },
              { label: "Timeline Tasks", count: pendingTasks, color: "text-red-600", link: "/cluster-timeline" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2">
                <span className="text-sm font-medium">{item.label}</span>
                <Badge variant={item.count > 0 ? "destructive" : "secondary"}>{item.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Finance Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Total Advance", value: inr(s.advances.reduce((a, b) => a + b.amount, 0)) },
              { label: "Total Expenses", value: inr(totalExpenses) },
              { label: "Total Refunds", value: inr(s.refunds.reduce((a, b) => a + b.amount, 0)) },
              {
                label: "Balance",
                value: inr(
                  s.advances.reduce((a, b) => a + b.amount, 0) -
                  totalExpenses +
                  s.refunds.reduce((a, b) => a + b.amount, 0)
                ),
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-bold">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Hierarchy + Recent Activities */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cluster Hierarchy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {panchayats.slice(0, 5).map((p) => {
                const pvs = villages.filter((v) => v.panchayatId === p.id);
                const psc = schools.filter((sc) => pvs.some((v) => v.id === sc.villageId));
                const pst = students.filter((st) => psc.some((sc) => sc.id === st.schoolId));
                return (
                  <div key={p.id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between font-medium">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {p.name}
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{pvs.length} villages</span>
                        <span>·</span>
                        <span>{psc.length} schools</span>
                        <span>·</span>
                        <span>{pst.length} students</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {panchayats.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No panchayats in this cluster</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities.map((a, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${a.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.label}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{a.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ClusterAdminShell>
  );
}
