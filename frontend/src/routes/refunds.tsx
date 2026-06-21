import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/layout/data-table";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { KpiCard } from "@/components/layout/kpi-card";
import { Plus, Pencil, Undo2, Check } from "lucide-react";
import { useStore, newId, type Refund } from "@/lib/store";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/refunds")({
  head: () => ({ meta: [{ title: "Refunds — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Refund | null>(null);
  const [form, setForm] = useState({ amount: 0, date: "", utr: "", txn: "", remarks: "" });

  const total = s.refunds.reduce((a,b)=>a+b.amount,0);
  const pending = s.refunds.filter(r => r.status === "Pending");
  const completed = s.refunds.filter(r => r.status === "Completed");

  const openCreate = () => { setEdit(null); setForm({ amount: 0, date: new Date().toISOString().slice(0,10), utr: "", txn: "", remarks: "" }); setOpen(true); };
  const openEdit = (r: Refund) => { setEdit(r); setForm({ amount: r.amount, date: r.date, utr: r.utr, txn: r.txn, remarks: r.remarks }); setOpen(true); };
  const save = () => {
    if (!form.amount) return toast.error("Amount required");
    s.upsert("refunds", { id: edit?.id ?? newId(), status: edit?.status ?? "Pending", ...form });
    toast.success("Saved"); setOpen(false);
  };

  return (
    <AppShell>
      <PageHeader title="Refunds" description="Track refunds back to HQ." actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Refund</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Refunds" value={inr(total)} icon={Undo2} tone="primary" />
        <KpiCard label="Pending" value={inr(pending.reduce((a,b)=>a+b.amount,0))} icon={Undo2} tone="warning" />
        <KpiCard label="Completed" value={inr(completed.reduce((a,b)=>a+b.amount,0))} icon={Undo2} tone="success" />
        <KpiCard label="Settlement Balance" value={inr(s.advances.reduce((a,b)=>a+b.amount,0) - s.expenses.reduce((a,b)=>a+b.amount,0) - total)} icon={Undo2} tone="info" />
      </div>
      <DataTable
        exportName="refunds" rows={s.refunds} searchKeys={["utr","txn"] as any}
        columns={[
          { key: "date", header: "Date" },
          { key: "amount", header: "Amount", render: (r) => <b>{inr(r.amount)}</b> },
          { key: "utr", header: "UTR", render: (r) => <Badge variant="outline">{r.utr}</Badge> },
          { key: "txn", header: "Txn #" },
          { key: "remarks", header: "Remarks" },
          { key: "status", header: "Status", render: (r) =>
            r.status === "Completed" ? <Badge className="bg-success text-success-foreground">Completed</Badge> : <Badge variant="outline">Pending</Badge>
          },
          { key: "_act", header: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              {r.status === "Pending" && <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => { s.patch("refunds", r.id, { status: "Completed" }); toast.success("Completed"); }}><Check className="h-4 w-4" /></Button>}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => { s.remove("refunds", r.id); toast.success("Deleted"); }} />
            </div>
          ) },
        ]}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Add"} Refund</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label>UTR</Label><Input value={form.utr} onChange={(e) => setForm({ ...form, utr: e.target.value })} /></div>
            <div><Label>Transaction #</Label><Input value={form.txn} onChange={(e) => setForm({ ...form, txn: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
