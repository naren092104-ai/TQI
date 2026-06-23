import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/layout/data-table";
import { KpiCard } from "@/components/layout/kpi-card";
import { ScrollText, Download } from "lucide-react";
import { useStore } from "@/lib/store";
import { downloadMock, toCSV } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/audit-logs")({
  head: () => ({ meta: [{ title: "Audit Logs — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const [user, setUser] = useState("all");
  const [action, setAction] = useState("all");

  const rows = s.auditLogs.filter(l =>
    (user === "all" || l.user === user) && (action === "all" || l.action === action)
  );
  const users = Array.from(new Set(s.auditLogs.map(l => l.user)));
  const actions = Array.from(new Set(s.auditLogs.map(l => l.action)));

  return (
    <AppShell>
      <PageHeader title="Audit Logs" description="System-wide event tracking." actions={
        <Button variant="outline" onClick={() => { downloadMock("audit-logs.csv", toCSV(rows as any), "text/csv"); toast.success("Exported"); }}>
          <Download className="h-4 w-4" /> Export
        </Button>
      } />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Events" value={s.auditLogs.length} icon={ScrollText} tone="primary" />
        <KpiCard label="Active Users" value={users.length} icon={ScrollText} tone="info" />
        <KpiCard label="Action Types" value={actions.length} icon={ScrollText} tone="success" />
        <KpiCard label="Last 24h" value={s.auditLogs.filter(l => Date.now() - new Date(l.at).getTime() < 86400000).length} icon={ScrollText} tone="secondary" />
      </div>
      <DataTable
        exportName="audit-logs" rows={rows} searchKeys={["user","action","ip"] as any}
        filterBar={
          <div className="flex gap-2">
            <Select value={user} onValueChange={setUser}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All users</SelectItem>{users.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All actions</SelectItem>{actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        }
        columns={[
          { key: "user", header: "User", render: (r) => <span className="font-medium">{r.user}</span> },
          { key: "action", header: "Action", render: (r) => <Badge variant="outline">{r.action}</Badge> },
          { key: "at", header: "Timestamp", render: (r) => new Date(r.at).toLocaleString() },
          { key: "ip", header: "IP" },
        ]}
      />
    </AppShell>
  );
}
