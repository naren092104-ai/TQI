import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/layout/data-table";
import { KpiCard } from "@/components/layout/kpi-card";
import { ShieldCheck, Check, X, FileText } from "lucide-react";
import { useStore, newId, type ApprovalReq } from "@/lib/store";
import { useAuth, isSuperAdmin } from "@/lib/auth";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/approvals")({
  head: () => ({ meta: [{ title: "Approvals — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const { user } = useAuth();
  const isSuper = isSuperAdmin(user?.role);
  const [action, setAction] = useState<{ row: ApprovalReq; kind: "Approved" | "Rejected" } | null>(null);
  const [remarks, setRemarks] = useState("");

  const counts = (t: ApprovalReq["type"] | "All") => {
    if (t === "All") return s.approvals.filter(a => (a.type === "Finance" || a.type === "Reopen") && a.status === "Pending").length;
    return s.approvals.filter(a => a.type === t && a.status === "Pending").length;
  };
  const submit = async () => {
    if (!action) return;
    await s.patch("approvals", action.row.id, { status: action.kind, remarks });
    if (action.row.type === "Reopen") {
      if (action.kind === "Approved" && action.row.sessionId) {
        await s.patch("sessions", action.row.sessionId, {
          reopenUntil: new Date(Date.now() + 86400000).toISOString(),
        });
      }
      await s.upsert("notifications", {
        id: newId(),
        title: `Reopen request ${action.kind.toLowerCase()}`,
        body:
          action.kind === "Approved"
            ? `Reopen request for ${action.row.reference} has been approved. Cluster Admin can submit attendance again.`
            : `Reopen request for ${action.row.reference} was rejected.`,
        type: "Reopen",
        read: false,
        at: new Date().toISOString(),
      });
    }
    toast.success(`${action.kind}`);
    setAction(null); setRemarks("");
  };

  const tableFor = (rows: ApprovalReq[]) => {
    const rowsWithSno = rows.map((r, i) => Object.assign({ _sno: i + 1 }, r));
    return (
      <DataTable exportName="approvals" rows={rowsWithSno} searchKeys={["reference","requestedBy"] as any} columns={[
        { key: "_sno", header: "S.No", render: (r) => String(r._sno) },
        { key: "cluster", header: "Cluster", render: (r) => s.clusters.find(c => c.id === r.clusterId)?.name ?? r.clusterId ?? "—" },
        { key: "target", header: "Target", render: (r) => r.target ?? (r.type === "Finance" ? "Finance" : "—") },
        { key: "reference", header: "Reference", render: (r) => r.reference },
        { key: "requestedBy", header: "Requested by" },
        { key: "amount", header: "Amount", render: (r) => r.amount ? inr(r.amount) : "—" },
        { key: "date", header: "Date" },
        { key: "status", header: "Status", render: (r) => r.status },
        { key: "_act", header: "", className: "text-right", render: (r) => (
          isSuper && r.status === "Pending" ? (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAction({ row: r, kind: "Approved" })}>Approve</Button>
              <Button variant="ghost" size="sm" onClick={() => setAction({ row: r, kind: "Rejected" })}>Reject</Button>
            </div>
          ) : null
        ) },
      ]} />
    );
  };

  const financeRows = s.approvals.filter(a => a.type === "Finance");
  const reopenRows = s.approvals.filter(a => a.type === "Reopen");
  const allRows = s.approvals.filter(a => a.type === "Finance" || a.type === "Reopen");

  return (
    <AppShell>
      <PageHeader title="Approval Center" description="Review and act on all pending requests." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="All (Finance + Attendance)" value={counts("All")} icon={ShieldCheck} tone="primary" />
        <KpiCard label="Finance" value={counts("Finance")} icon={ShieldCheck} tone="primary" />
        <KpiCard label="Reopen" value={counts("Reopen")} icon={ShieldCheck} tone="warning" />
      </div>
      <Tabs defaultValue="All">
        <TabsList>
          {(["All","Finance","Reopen"] as const).map(t => (
            <TabsTrigger key={t} value={t}>{t}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="All" className="mt-4">{tableFor(allRows)}</TabsContent>
        <TabsContent value="Finance" className="mt-4">{tableFor(financeRows)}</TabsContent>
        <TabsContent value="Reopen" className="mt-4">{tableFor(reopenRows)}</TabsContent>
      </Tabs>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{action?.kind} {action?.row.type} request</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm font-medium">Remarks</label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional remarks…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            {isSuper ? (
              <Button onClick={submit} className={action?.kind === "Rejected" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}>{action?.kind}</Button>
            ) : (
              <Button disabled size="sm">Only Super Admin can act</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
