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
import { useStore, type ApprovalReq } from "@/lib/store";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/approvals")({
  head: () => ({ meta: [{ title: "Approvals — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const [action, setAction] = useState<{ row: ApprovalReq; kind: "Approved" | "Rejected" } | null>(null);
  const [remarks, setRemarks] = useState("");

  const counts = (t: ApprovalReq["type"]) => s.approvals.filter(a => a.type === t && a.status === "Pending").length;
  const submit = () => {
    if (!action) return;
    s.patch("approvals", action.row.id, { status: action.kind, remarks });
    toast.success(`${action.kind}`);
    setAction(null); setRemarks("");
  };

  const tableFor = (type: ApprovalReq["type"]) => (
    <DataTable
      exportName={`approvals-${type.toLowerCase()}`}
      rows={s.approvals.filter(a => a.type === type)}
      searchKeys={["reference","requestedBy"] as any}
      columns={[
        { key: "reference", header: "Reference", render: (r) => <span className="font-medium">{r.reference}</span> },
        { key: "requestedBy", header: "Requested by" },
        { key: "amount", header: "Amount", render: (r) => r.amount ? inr(r.amount) : "—" },
        { key: "date", header: "Date" },
        { key: "status", header: "Status", render: (r) =>
          r.status === "Approved" ? <Badge className="bg-success text-success-foreground">Approved</Badge> :
          r.status === "Rejected" ? <Badge variant="destructive">Rejected</Badge> :
          <Badge variant="outline">Pending</Badge>
        },
        { key: "_act", header: "", className: "text-right", render: (r) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Opened detail")}><FileText className="h-4 w-4" /></Button>
            {r.status === "Pending" && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => setAction({ row: r, kind: "Approved" })}><Check className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setAction({ row: r, kind: "Rejected" })}><X className="h-4 w-4" /></Button>
              </>
            )}
          </div>
        ) },
      ]}
    />
  );

  return (
    <AppShell>
      <PageHeader title="Approval Center" description="Review and act on all pending requests." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Finance" value={counts("Finance")} icon={ShieldCheck} tone="primary" />
        <KpiCard label="Advance" value={counts("Advance")} icon={ShieldCheck} tone="info" />
        <KpiCard label="Refund" value={counts("Refund")} icon={ShieldCheck} tone="secondary" />
        <KpiCard label="Timeline" value={counts("Timeline")} icon={ShieldCheck} tone="warning" />
        <KpiCard label="Extension" value={counts("Extension")} icon={ShieldCheck} tone="success" />
      </div>
      <Tabs defaultValue="Finance">
        <TabsList>
          {(["Finance","Advance","Refund","Timeline","Extension"] as const).map(t => (
            <TabsTrigger key={t} value={t}>{t}</TabsTrigger>
          ))}
        </TabsList>
        {(["Finance","Advance","Refund","Timeline","Extension"] as const).map(t => (
          <TabsContent key={t} value={t} className="mt-4">{tableFor(t)}</TabsContent>
        ))}
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
            <Button onClick={submit} className={action?.kind === "Rejected" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}>{action?.kind}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
