import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/layout/data-table";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { KpiCard } from "@/components/layout/kpi-card";
import { BillManager } from "@/components/layout/bill-manager";
import { FinanceReport } from "@/components/layout/finance-report";
import { Wallet, Plus, Pencil, Eye, FileText, Check, X, Plane, Utensils, PenLine, Boxes } from "lucide-react";
import { useStore, newId, type Expense, type Bill } from "@/lib/store";
import { inr } from "@/lib/format";
import { downloadFinancePdf } from "@/lib/finance-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance Command Center — TQI Admin" }] }),
  component: Page,
});

const catIcon = { Travel: Plane, Food: Utensils, Stationery: PenLine, Other: Boxes } as const;

function Page() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Expense | null>(null);
  const [form, setForm] = useState<{ date: string; category: Expense["category"]; amount: number; description?: string; submittedBy: string; travelFrom?: string; travelTo?: string; breakfast?: number; lunch?: number; dinner?: number; refreshment?: number; bills: Bill[]; clusterId?: string; villageId?: string; schoolId?: string }>({
    date: "", category: "Travel", amount: 0, submittedBy: "", travelFrom: "", travelTo: "", breakfast: 0, lunch: 0, dinner: 0, refreshment: 0, bills: [], clusterId: "", villageId: "", schoolId: "",
  });
  const [view, setView] = useState<Expense | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);

  const totals = {
    all: s.expenses.reduce((a,b)=>a+b.amount,0),
    Travel: s.expenses.filter(e=>e.category==="Travel").reduce((a,b)=>a+b.amount,0),
    Food: s.expenses.filter(e=>e.category==="Food").reduce((a,b)=>a+b.amount,0),
    Stationery: s.expenses.filter(e=>e.category==="Stationery").reduce((a,b)=>a+b.amount,0),
    Other: s.expenses.filter(e=>e.category==="Other").reduce((a,b)=>a+b.amount,0),
    pending: s.expenses.filter(e=>e.status==="Pending").length,
  };

  const allBills = s.expenses.flatMap((e) => e.bills.map((b) => ({ ...b, expense: e })));

  const currentUser = s.admins[0]?.name || "User";
  const panchayatsForCluster = form.clusterId ? s.panchayats.filter(p => p.clusterId === form.clusterId) : [];
  const villagesForPanchayat = form.villageId ? s.villages.filter(v => panchayatsForCluster.some(p => v.panchayatId === p.id)) : [];
  const schoolsForVillage = form.schoolId || form.villageId ? s.schools.filter(sc => sc.villageId === form.villageId) : [];
  const selectedSchool = form.schoolId ? s.schools.find(sc => sc.id === form.schoolId) : null;
  
  const openCreate = () => { setEdit(null); setForm({ date: new Date().toISOString().slice(0,10), category: "Travel", amount: 0, submittedBy: currentUser, travelFrom: "", travelTo: "", breakfast: 0, lunch: 0, dinner: 0, refreshment: 0, bills: [], clusterId: "", villageId: "", schoolId: "" }); setOpen(true); };
  const openEdit = (e: Expense) => { setEdit(e); setForm({ date: e.date, category: e.category, amount: e.amount, description: e.description ?? "", submittedBy: e.submittedBy, travelFrom: e.travelFrom ?? "", travelTo: e.travelTo ?? "", breakfast: e.breakfast ?? 0, lunch: e.lunch ?? 0, dinner: e.dinner ?? 0, refreshment: e.refreshment ?? 0, bills: e.bills, clusterId: "", villageId: "", schoolId: "" }); setOpen(true); };
  const save = () => {
    const amount = form.category === "Food"
      ? Number(form.breakfast || 0) + Number(form.lunch || 0) + Number(form.dinner || 0) + Number(form.refreshment || 0)
      : form.amount;
    if (!amount) return toast.error("Amount is required");
    const payload: any = {
      id: edit?.id ?? newId(),
      status: edit?.status ?? "Pending",
      advanceId: edit?.advanceId,
      ...form,
      amount,
    };
    if (form.category === "Travel") {
      delete payload.breakfast;
      delete payload.lunch;
      delete payload.dinner;
      delete payload.refreshment;
      delete payload.description;
    }
    if (form.category === "Food") {
      delete payload.travelFrom;
      delete payload.travelTo;
      delete payload.description;
    }
    delete payload.clusterId;
    delete payload.villageId;
    delete payload.schoolId;
    s.upsert("expenses", payload);
    toast.success("Saved"); setOpen(false);
  };
  const setStatus = (id: string, status: Expense["status"]) => { s.patch("expenses", id, { status }); toast.success(`Marked ${status}`); };

  return (
    <AppShell>
      <PageHeader title="Finance Command Center" description="Track all program expenses end-to-end." actions={
        <>
          <Button variant="outline" onClick={() => setPdfOpen(true)}><FileText className="h-4 w-4" /> PDF Preview</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Expense</Button>
        </>
      } />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Expenses" value={inr(totals.all)} icon={Wallet} tone="primary" />
        <KpiCard label="Travel" value={inr(totals.Travel)} icon={Plane} tone="info" />
        <KpiCard label="Food" value={inr(totals.Food)} icon={Utensils} tone="secondary" />
        <KpiCard label="Stationery" value={inr(totals.Stationery)} icon={PenLine} tone="success" />
        <KpiCard label="Other" value={inr(totals.Other)} icon={Boxes} tone="warning" />
        <KpiCard label="Pending Approvals" value={totals.pending} icon={Check} tone="warning" />
      </div>

      <Card className="mb-4 shadow-card">
        <CardHeader><CardTitle className="text-base">Finance Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {[
              { label: "Advance Received", val: inr(s.advances.reduce((a,b)=>a+b.amount,0)), color: "bg-info text-info-foreground" },
              { label: "Expense Submitted", val: inr(totals.all), color: "bg-primary text-primary-foreground" },
              { label: "Finance Approved", val: inr(s.expenses.filter(e=>e.status==="Approved").reduce((a,b)=>a+b.amount,0)), color: "bg-success text-success-foreground" },
              { label: "Refund Received", val: inr(s.refunds.reduce((a,b)=>a+b.amount,0)), color: "bg-secondary text-secondary-foreground" },
              { label: "Settlement Closed", val: s.advances.filter(a=>a.status==="Settled").length, color: "bg-muted text-foreground" },
            ].map((step, i) => (
              <div key={i} className="relative rounded-lg border border-border p-3">
                <div className={`mb-2 inline-grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${step.color}`}>{i+1}</div>
                <div className="text-xs text-muted-foreground">{step.label}</div>
                <div className="text-lg font-bold">{step.val}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {allBills.length > 0 && (
        <Card className="mb-4 shadow-card">
          <CardHeader><CardTitle className="text-base">Attached Bills ({allBills.length})</CardTitle></CardHeader>
          <CardContent>
            <BillManager bills={allBills.map((b) => ({ id: b.id, name: `${b.name} · ${b.expense.category}`, url: b.url, originalUrl: b.originalUrl, type: b.type }))} onChange={() => {}} readOnly />
          </CardContent>
        </Card>
      )}

      <DataTable
        exportName="expenses" rows={s.expenses} searchKeys={["description","submittedBy"] as any}
        columns={[
          { key: "date", header: "Date" },
          { key: "category", header: "Category", render: (r) => { const Icon = catIcon[r.category]; return <Badge variant="outline" className="gap-1"><Icon className="h-3 w-3" /> {r.category}</Badge>; } },
          { key: "description", header: "Description" },
          { key: "amount", header: "Amount", render: (r) => <b>{inr(r.amount)}</b> },
          { key: "submittedBy", header: "By" },
          { key: "bills", header: "Bills", render: (r) => <Badge>{r.bills.length}</Badge> },
          { key: "status", header: "Status", render: (r) =>
            r.status === "Approved" ? <Badge className="bg-success text-success-foreground">Approved</Badge> :
            r.status === "Rejected" ? <Badge variant="destructive">Rejected</Badge> :
            <Badge variant="outline">Pending</Badge>
          },
          { key: "_act", header: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView(r)}><Eye className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => setStatus(r.id, "Approved")}><Check className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setStatus(r.id, "Rejected")}><X className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => { s.remove("expenses", r.id); toast.success("Deleted"); }} />
            </div>
          ) },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Add"} Expense</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Expense["category"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Travel","Food","Stationery","Other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Cluster</Label>
              <Select value={form.clusterId} onValueChange={(v) => setForm({ ...form, clusterId: v, villageId: "", schoolId: "" })}>
                <SelectTrigger><SelectValue placeholder="Select cluster" /></SelectTrigger>
                <SelectContent>{s.clusters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Village</Label>
              <Select value={form.villageId} onValueChange={(v) => setForm({ ...form, villageId: v, schoolId: "" })} disabled={!form.clusterId}>
                <SelectTrigger><SelectValue placeholder="Select village" /></SelectTrigger>
                <SelectContent>{villagesForPanchayat.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>School</Label>
              <Select value={form.schoolId} onValueChange={(v) => { setForm({ ...form, schoolId: v }); const school = s.schools.find(sc => sc.id === v); if (school?.principal) setForm(f => ({ ...f, submittedBy: school.principal })); }} disabled={!form.villageId}>
                <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>{schoolsForVillage.map(sc => <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.category === "Travel" ? (
              <>
                <div><Label>From</Label><Input value={form.travelFrom} onChange={(e) => setForm({ ...form, travelFrom: e.target.value })} /></div>
                <div><Label>To</Label><Input value={form.travelTo} onChange={(e) => setForm({ ...form, travelTo: e.target.value })} /></div>
                <div><Label>Amount (₹)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></div>
              </>
            ) : form.category === "Food" ? (
              <>
                <div><Label>Breakfast</Label><Input type="number" value={form.breakfast} onChange={(e) => setForm({ ...form, breakfast: Number(e.target.value) })} /></div>
                <div><Label>Lunch</Label><Input type="number" value={form.lunch} onChange={(e) => setForm({ ...form, lunch: Number(e.target.value) })} /></div>
                <div><Label>Dinner</Label><Input type="number" value={form.dinner} onChange={(e) => setForm({ ...form, dinner: Number(e.target.value) })} /></div>
                <div><Label>Refreshment</Label><Input type="number" value={form.refreshment} onChange={(e) => setForm({ ...form, refreshment: Number(e.target.value) })} /></div>
                <div className="sm:col-span-2"><Label>Total Amount</Label><Input type="number" readOnly value={Number(form.breakfast || 0) + Number(form.lunch || 0) + Number(form.dinner || 0) + Number(form.refreshment || 0)} /></div>
              </>
            ) : (
              <>
                <div><Label>Amount (₹)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Description</Label><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              </>
            )}
            <div><Label>Submitted by</Label><Input readOnly value={form.submittedBy} className="bg-muted" /></div>
            <div className="sm:col-span-2">
              <Label>Bills (upload or scan)</Label>
              <BillManager bills={form.bills} onChange={(bs) => setForm({ ...form, bills: bs })} />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-2xl">
          {view && (
            <>
              <DialogHeader><DialogTitle>Expense Details</DialogTitle></DialogHeader>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">Date:</span> {view.date}</div>
                <div><span className="text-muted-foreground">Category:</span> {view.category}</div>
                <div><span className="text-muted-foreground">Amount:</span> <b>{inr(view.amount)}</b></div>
                <div><span className="text-muted-foreground">Status:</span> {view.status}</div>
                <div className="sm:col-span-2"><span className="text-muted-foreground">Description:</span> {view.description}</div>
                <div className="sm:col-span-2">
                  <div className="mb-2 text-muted-foreground">Attached bills ({view.bills.length})</div>
                  <BillManager bills={view.bills} onChange={() => {}} readOnly />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Finance Settlement Report</DialogTitle><DialogDescription>Same layout as downloaded PDF</DialogDescription></DialogHeader>
          <FinanceReport expenses={s.expenses} advances={s.advances} refunds={s.refunds} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfOpen(false)}>Close</Button>
            <Button onClick={() => {
              if (downloadFinancePdf(s.expenses, s.advances, s.refunds)) {
                toast.success("Choose 'Save as PDF' in the print dialog");
              } else {
                toast.error("Allow pop-ups to download PDF");
              }
            }}>Download PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
