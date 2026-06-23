import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/layout/data-table";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { KpiCard } from "@/components/layout/kpi-card";
import { Banknote, Plus, Pencil, ArrowDown, ArrowUp, Equal } from "lucide-react";
import { useStore, newId, type Advance } from "@/lib/store";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/advance")({
  head: () => ({ meta: [{ title: "Advance — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Advance | null>(null);
  const [form, setForm] = useState({ amount: 0, date: "", receivedFrom: "", utr: "", remarks: "" });

  const totalAdv = s.advances.reduce((a,b)=>a+b.amount,0);
  const totalExp = s.expenses.reduce((a,b)=>a+b.amount,0);
  const totalRef = s.refunds.reduce((a,b)=>a+b.amount,0);
  const balance = totalAdv - totalExp;
  const pending = s.advances.filter(a => a.status !== "Settled").reduce((a,b)=>a+b.amount,0);

  const openCreate = () => { setEdit(null); setForm({ amount: 0, date: new Date().toISOString().slice(0,10), receivedFrom: "HQ Finance", utr: "", remarks: "" }); setOpen(true); };
  const openEdit = (a: Advance) => { setEdit(a); setForm({ amount: a.amount, date: a.date, receivedFrom: a.receivedFrom, utr: a.utr, remarks: a.remarks }); setOpen(true); };
  const save = () => {
    if (!form.amount || !form.utr) return toast.error("Amount + UTR required");
    s.upsert("advances", { id: edit?.id ?? newId(), status: edit?.status ?? "Pending", ...form });
    toast.success("Saved"); setOpen(false);
  };

  return (
    <AppShell>
      <PageHeader title="Advance Management" description="Track all field advances and live balance." actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Advance</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Total Advance Received" value={inr(totalAdv)} icon={Banknote} tone="info" />
        <KpiCard label="Total Expenses" value={inr(totalExp)} icon={Banknote} tone="primary" />
        <KpiCard label="Balance Available" value={inr(balance)} icon={Banknote} tone={balance >= 0 ? "success" : "warning"} />
        <KpiCard label="Pending Settlement" value={inr(pending)} icon={Banknote} tone="warning" />
        <KpiCard label="Refund Received" value={inr(totalRef)} icon={Banknote} tone="secondary" />
      </div>

      <Card className="mb-4 shadow-card">
        <CardHeader><CardTitle className="text-base">Auto Calculator</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-center gap-3 text-center sm:gap-6">
            <div>
              <ArrowDown className="mx-auto h-5 w-5 text-info" />
              <div className="mt-1 text-xs text-muted-foreground">Advance</div>
              <div className="text-2xl font-bold text-info">{inr(totalAdv)}</div>
            </div>
            <div className="text-3xl text-muted-foreground">−</div>
            <div>
              <ArrowUp className="mx-auto h-5 w-5 text-destructive" />
              <div className="mt-1 text-xs text-muted-foreground">Expenses</div>
              <div className="text-2xl font-bold text-destructive">{inr(totalExp)}</div>
            </div>
            <div className="text-3xl text-muted-foreground">=</div>
            <div>
              <Equal className="mx-auto h-5 w-5 text-success" />
              <div className="mt-1 text-xs text-muted-foreground">Balance</div>
              <div className={`text-2xl font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>{inr(balance)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        exportName="advances" rows={s.advances} searchKeys={["utr","receivedFrom"] as any}
        columns={[
          { key: "date", header: "Date" },
          { key: "amount", header: "Amount", render: (r) => <b>{inr(r.amount)}</b> },
          { key: "receivedFrom", header: "Received From" },
          { key: "utr", header: "UTR", render: (r) => <Badge variant="outline">{r.utr}</Badge> },
          { key: "remarks", header: "Remarks" },
          { key: "status", header: "Status", render: (r) =>
            r.status === "Settled" ? <Badge className="bg-success text-success-foreground">Settled</Badge> :
            r.status === "Approved" ? <Badge className="bg-info text-info-foreground">Approved</Badge> :
            <Badge variant="outline">Pending</Badge>
          },
          { key: "_act", header: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => { s.remove("advances", r.id); toast.success("Deleted"); }} />
            </div>
          ) },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Add"} Advance</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label>Received from</Label><Input value={form.receivedFrom} onChange={(e) => setForm({ ...form, receivedFrom: e.target.value })} /></div>
            <div><Label>UTR Number</Label><Input value={form.utr} onChange={(e) => setForm({ ...form, utr: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
