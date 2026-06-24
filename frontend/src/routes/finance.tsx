import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/layout/data-table";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { KpiCard } from "@/components/layout/kpi-card";
import { BillManager } from "@/components/layout/bill-manager";
import { FinanceReport } from "@/components/layout/finance-report";
import {
  Wallet, Plus, Pencil, Eye, FileText, Check, X,
  Plane, Utensils, PenLine, Boxes, Car, Bike, Fuel,
  Lock, Unlock, AlertTriangle, Download, Users,
} from "lucide-react";
import { useStore, newId, type Expense, type Bill, type FoodBill, type ReopenRequest } from "@/lib/store";
import { useAuth, isSuperAdmin, isClusterAdmin } from "@/lib/auth";
import { inr } from "@/lib/format";
import { downloadFinancePdf } from "@/lib/finance-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance — TQI" }] }),
  component: Page,
});

const CATEGORIES = ["Travel", "Food", "Stationery", "Cab", "Auto", "Fuel", "Other"] as const;
type Category = typeof CATEGORIES[number];

const CAT_ICONS: Record<Category, any> = {
  Travel: Plane, Food: Utensils, Stationery: PenLine,
  Cab: Car, Auto: Bike, Fuel: Fuel, Other: Boxes,
};

const FOOD_SUBS = ["Breakfast", "Lunch", "Dinner", "Refreshments"] as const;

function blankBill(): Bill { return { id: newId(), name: "", url: "", type: "uploaded", amount: 0, remarks: "" }; }
function blankFoodBill(sub: typeof FOOD_SUBS[number]): FoodBill {
  return { subCategory: sub, bills: [blankBill()], volunteerCount: 0, remarks: "" };
}

type FormState = {
  sessionDay: number;
  date: string;
  category: Category;
  // auto-filled
  clusterName: string;
  collegeName: string;
  financerName: string;
  submittedBy: string;
  // Travel / Cab / Auto
  travelFrom: string;
  travelTo: string;
  volunteerCount: number;
  // Food
  foodBills: FoodBill[];
  // Stationery
  itemName: string;
  quantity: number;
  // Fuel
  fuelType: string;
  litres: number;
  vehicleNumber: string;
  // Other
  purpose: string;
  description: string;
  remarks: string;
  // Bills (non-food)
  bills: Bill[];
};

function blankForm(clusterName: string, collegeName: string, financerName: string, submittedBy: string): FormState {
  return {
    sessionDay: 1, date: new Date().toISOString().slice(0, 10), category: "Travel",
    clusterName, collegeName, financerName, submittedBy,
    travelFrom: "", travelTo: "", volunteerCount: 0,
    foodBills: FOOD_SUBS.map(blankFoodBill),
    itemName: "", quantity: 1,
    fuelType: "Petrol", litres: 0, vehicleNumber: "",
    purpose: "", description: "", remarks: "",
    bills: [],
  };
}

function billsTotal(bills: Bill[]): number {
  return bills.reduce((s, b) => s + Number(b.amount || 0), 0);
}
function foodTotal(foodBills: FoodBill[]): number {
  return foodBills.reduce((s, fb) => s + billsTotal(fb.bills), 0);
}
function calcAmount(form: FormState): number {
  if (form.category === "Food") return foodTotal(form.foodBills);
  return billsTotal(form.bills);
}

function Page() {
  const s = useStore();
  const { user } = useAuth();
  const isSuper = isSuperAdmin(user?.role);
  const isCluster = isClusterAdmin(user?.role);

  // Auto-fill values
  const myCluster = s.clusters.find(c => c.id === user?.clusterId);
  const myAdmin = s.admins.find(a => a.id === user?.id);
  const defaultFinancer = s.financeSettings?.[0]?.defaultFinancerName ?? "TQI Finance Team";
  const autoClusterName = myCluster?.name ?? "";
  const autoCollegeName = myAdmin?.college ?? "";
  const autoSubmittedBy = myAdmin?.name ?? user?.name ?? "";

  // Dialogs
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(blankForm(autoClusterName, autoCollegeName, defaultFinancer, autoSubmittedBy));
  const [view, setView] = useState<Expense | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<Expense | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  // Visible expenses
  const visibleExpenses = useMemo(() =>
    isCluster ? s.expenses.filter(e => e.clusterId === user?.clusterId) : s.expenses,
    [s.expenses, isCluster, user?.clusterId]);

  // Totals
  const totals = useMemo(() => {
    const byCategory = (cat: Category) => visibleExpenses.filter(e => e.category === cat).reduce((a, b) => a + b.amount, 0);
    return {
      all: visibleExpenses.reduce((a, b) => a + b.amount, 0),
      Travel: byCategory("Travel"), Food: byCategory("Food"),
      Stationery: byCategory("Stationery"), Cab: byCategory("Cab"),
      Auto: byCategory("Auto"), Fuel: byCategory("Fuel"), Other: byCategory("Other"),
      pending: visibleExpenses.filter(e => e.status === "Pending").length,
      volunteers: visibleExpenses.reduce((a, b) => a + (b.volunteerCount ?? 0), 0),
    };
  }, [visibleExpenses]);

  const openCreate = () => {
    if (!isCluster && !isSuper) return toast.error("Only Cluster Admin can create finance entries");
    if (isSuper) return toast.error("Super Admin can only view finance entries");
    setEdit(null);
    setForm(blankForm(autoClusterName, autoCollegeName, defaultFinancer, autoSubmittedBy));
    setOpen(true);
  };

  const openEdit = (e: Expense) => {
    if (isSuper) return toast.error("Super Admin cannot edit finance entries");
    if (e.status === "Locked") {
      toast.error("This entry is locked. Request reopen to edit.");
      return;
    }
    setEdit(e);
    setForm({
      sessionDay: e.sessionDay ?? 1,
      date: e.date,
      category: (e.category as Category) ?? "Travel",
      clusterName: e.clusterName ?? autoClusterName,
      collegeName: e.collegeName ?? autoCollegeName,
      financerName: e.financerName ?? defaultFinancer,
      submittedBy: e.submittedBy,
      travelFrom: e.travelFrom ?? "",
      travelTo: e.travelTo ?? "",
      volunteerCount: e.volunteerCount ?? 0,
      foodBills: (e.foodBills && e.foodBills.length > 0) ? e.foodBills : FOOD_SUBS.map(blankFoodBill),
      itemName: (e as any).itemName ?? "",
      quantity: (e as any).quantity ?? 1,
      fuelType: (e as any).fuelType ?? "Petrol",
      litres: (e as any).litres ?? 0,
      vehicleNumber: (e as any).vehicleNumber ?? "",
      purpose: (e as any).purpose ?? "",
      description: e.description ?? "",
      remarks: e.remarks ?? "",
      bills: e.bills,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.sessionDay) return toast.error("Session day is required");
    if (!form.date) return toast.error("Date is required");
    const amount = calcAmount(form);
    try {
      const payload: any = {
        id: edit?.id ?? newId(),
        sessionDay: form.sessionDay,
        date: form.date,
        category: form.category,
        clusterName: form.clusterName,
        collegeName: form.collegeName,
        financerName: form.financerName,
        submittedBy: form.submittedBy,
        clusterId: user?.clusterId,
        amount,
        status: edit?.status ?? "Pending",
        bills: form.category === "Food" ? form.foodBills.flatMap(fb => fb.bills) : form.bills,
        foodBills: form.category === "Food" ? form.foodBills : undefined,
        travelFrom: ["Travel","Cab","Auto"].includes(form.category) ? form.travelFrom : undefined,
        travelTo: ["Travel","Cab","Auto"].includes(form.category) ? form.travelTo : undefined,
        volunteerCount: ["Travel","Cab","Auto","Food"].includes(form.category) ? form.volunteerCount : undefined,
        itemName: form.category === "Stationery" ? form.itemName : undefined,
        quantity: form.category === "Stationery" ? form.quantity : undefined,
        fuelType: form.category === "Fuel" ? form.fuelType : undefined,
        litres: form.category === "Fuel" ? form.litres : undefined,
        vehicleNumber: form.category === "Fuel" ? form.vehicleNumber : undefined,
        purpose: form.category === "Other" ? form.purpose : undefined,
        description: form.description,
        remarks: form.remarks,
      };
      await s.upsert("expenses", payload);
      toast.success(edit ? "Updated" : "Finance entry saved");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  const setStatus = (id: string, status: Expense["status"]) => {
    s.patch("expenses", id, { status });
    toast.success(`Marked ${status}`);
  };

  const submitReopen = async () => {
    if (!reopenTarget) return;
    if (!reopenReason.trim()) return toast.error("Reason is required");
    const req: ReopenRequest = {
      id: newId(),
      clusterId: user?.clusterId ?? "",
      sessionDay: reopenTarget.sessionDay,
      reason: reopenReason,
      requestedBy: autoSubmittedBy,
      requestDate: new Date().toISOString().slice(0, 10),
      status: "Pending",
    };
    await s.upsert("reopenRequests", req);
    toast.success("Reopen request submitted");
    setReopenOpen(false);
    setReopenReason("");
  };

  // ── JSX ──
  return (
    <AppShell>
      <PageHeader
        title="Finance"
        description={isCluster ? "Create and submit finance entries for your cluster." : "View and approve cluster finance entries."}
        actions={
          <div className="flex flex-wrap gap-2">
            {isCluster && <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Expense</Button>}
            <Button variant="outline" onClick={() => setPdfOpen(true)}><FileText className="h-4 w-4" /> PDF</Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Total" value={inr(totals.all)} icon={Wallet} tone="primary" />
        <KpiCard label="Travel" value={inr(totals.Travel)} icon={Plane} tone="info" />
        <KpiCard label="Food" value={inr(totals.Food)} icon={Utensils} tone="secondary" />
        <KpiCard label="Stationery" value={inr(totals.Stationery)} icon={PenLine} tone="success" />
        <KpiCard label="Cab" value={inr(totals.Cab)} icon={Car} tone="info" />
        <KpiCard label="Auto" value={inr(totals.Auto)} icon={Bike} tone="secondary" />
        <KpiCard label="Fuel" value={inr(totals.Fuel)} icon={Fuel} tone="warning" />
        <KpiCard label="Other" value={inr(totals.Other)} icon={Boxes} tone="default" />
      </div>

      {/* Finance Timeline */}
      <Card className="mb-4 shadow-card">
        <CardHeader><CardTitle className="text-base">Finance Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {[
              { label: "Advance Received", val: inr(s.advances.reduce((a,b)=>a+b.amount,0)), color: "bg-info text-info-foreground" },
              { label: "Expense Submitted", val: inr(totals.all), color: "bg-primary text-primary-foreground" },
              { label: "Finance Approved", val: inr(visibleExpenses.filter(e=>e.status==="Approved").reduce((a,b)=>a+b.amount,0)), color: "bg-success text-success-foreground" },
              { label: "Refund Received", val: inr(s.refunds.reduce((a,b)=>a+b.amount,0)), color: "bg-secondary text-secondary-foreground" },
              { label: "Volunteers Benefited", val: totals.volunteers, color: "bg-muted text-foreground" },
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

      {/* Reopen Requests — Super Admin */}
      {isSuper && s.reopenRequests?.filter(r => r.status === "Pending").length > 0 && (
        <Card className="mb-4 shadow-card border-yellow-200">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-600" /> Reopen Requests ({s.reopenRequests.filter(r=>r.status==="Pending").length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {s.reopenRequests.filter(r=>r.status==="Pending").map(req => (
                <div key={req.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div>
                    <div className="font-medium">Day {req.sessionDay} — {s.clusters.find(c=>c.id===req.clusterId)?.name ?? req.clusterId}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Reason: {req.reason} · By: {req.requestedBy} · {req.requestDate}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 bg-success text-success-foreground" onClick={() => { s.patch("reopenRequests", req.id, { status: "Approved", approvedUntil: new Date(Date.now()+86400000).toISOString().slice(0,10) }); toast.success("Reopen approved — unlocked for 24h"); }}>
                      <Check className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7" onClick={() => { s.patch("reopenRequests", req.id, { status: "Rejected" }); toast.success("Rejected"); }}>
                      <X className="h-3 w-3 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses Table */}
      <DataTable
        exportName="expenses"
        rows={visibleExpenses}
        searchKeys={["submittedBy", "clusterName", "description"] as any}
        columns={[
          { key: "sessionDay", header: "Day", render: (r) => <Badge variant="outline">Day {(r as any).sessionDay ?? "—"}</Badge> },
          { key: "date", header: "Date" },
          { key: "category", header: "Category", render: (r) => { const Icon = CAT_ICONS[r.category as Category] ?? Boxes; return <Badge variant="outline" className="gap-1"><Icon className="h-3 w-3" />{r.category}</Badge>; } },
          { key: "clusterName", header: "Cluster", render: (r) => <span className="text-sm">{(r as any).clusterName ?? "—"}</span> },
          { key: "amount", header: "Amount", render: (r) => <b>{inr(r.amount)}</b> },
          { key: "submittedBy", header: "By" },
          { key: "bills", header: "Bills", render: (r) => <Badge>{r.bills.length}</Badge> },
          { key: "status", header: "Status", render: (r) =>
            r.status === "Approved" ? <Badge className="bg-success text-success-foreground">Approved</Badge> :
            r.status === "Rejected" ? <Badge variant="destructive">Rejected</Badge> :
            r.status === "Locked" ? <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" />Locked</Badge> :
            <Badge variant="outline">Pending</Badge>
          },
          { key: "_act", header: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView(r)}><Eye className="h-4 w-4" /></Button>
              {isSuper && r.status === "Pending" && <>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => setStatus(r.id, "Approved")}><Check className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setStatus(r.id, "Rejected")}><X className="h-4 w-4" /></Button>
              </>}
              {isCluster && r.status !== "Locked" && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>}
              {isCluster && r.status === "Locked" && <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-600" onClick={() => { setReopenTarget(r); setReopenOpen(true); }}><Unlock className="h-4 w-4" /></Button>}
              {isCluster && r.status !== "Locked" && <ConfirmDelete onConfirm={() => { s.remove("expenses", r.id); toast.success("Deleted"); }} />}
            </div>
          ) },
        ]}
      />

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit ? "Edit" : "Add"} Finance Entry</DialogTitle>
            <DialogDescription>All auto-filled fields are read-only.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">

            {/* Top fields */}
            <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase sm:col-span-2">Session & Date</p>
              <div>
                <Label>Session Day <span className="text-destructive">*</span></Label>
                <Select value={String(form.sessionDay)} onValueChange={(v) => setForm({...form, sessionDay: +v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({length:8},(_,i)=>i+1).map(d=><SelectItem key={d} value={String(d)}>Day {d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})} />
              </div>
            </div>

            {/* Auto-filled */}
            <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-border bg-primary/5 p-3">
              <p className="text-xs font-semibold text-primary uppercase sm:col-span-2">Auto-filled Fields (read-only)</p>
              <div><Label>Cluster Name</Label><Input readOnly value={form.clusterName} className="bg-muted" /></div>
              <div><Label>College Name</Label><Input readOnly value={form.collegeName} className="bg-muted" placeholder="—" /></div>
              <div><Label>Financer Name</Label><Input readOnly value={form.financerName} className="bg-muted" /></div>
              <div><Label>Submitted By</Label><Input readOnly value={form.submittedBy} className="bg-muted" /></div>
            </div>

            {/* Category */}
            <div>
              <Label>Expense Category <span className="text-destructive">*</span></Label>
              <Select value={form.category} onValueChange={(v)=>setForm({...form,category:v as Category,bills:[],foodBills:FOOD_SUBS.map(blankFoodBill)})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Travel / Cab / Auto */}
            {["Travel","Cab","Auto"].includes(form.category) && (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{form.category} Details</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>From</Label><Input value={form.travelFrom} onChange={(e)=>setForm({...form,travelFrom:e.target.value})} placeholder="Origin" /></div>
                  <div><Label>To</Label><Input value={form.travelTo} onChange={(e)=>setForm({...form,travelTo:e.target.value})} placeholder="Destination" /></div>
                  <div><Label>No. of Volunteers</Label><Input type="number" min={0} value={form.volunteerCount} onChange={(e)=>setForm({...form,volunteerCount:+e.target.value})} /></div>
                  <div><Label>Remarks</Label><Input value={form.remarks} onChange={(e)=>setForm({...form,remarks:e.target.value})} /></div>
                </div>
                <div>
                  <Label>Bills (unlimited) — Grand Total: <b>{inr(billsTotal(form.bills))}</b></Label>
                  <div className="mt-2 space-y-2">
                    {form.bills.map((bill,idx)=>(
                      <div key={bill.id} className="rounded-md border border-border p-2 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                          <span>Bill {idx+1}</span>
                          <button type="button" onClick={()=>setForm({...form,bills:form.bills.filter((_,i)=>i!==idx)})} className="text-destructive hover:underline">Delete</button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div><Label className="text-xs">Amount (₹) *</Label><Input type="number" min={0} value={bill.amount||""} onChange={(e)=>{const b=[...form.bills];b[idx]={...b[idx],amount:+e.target.value};setForm({...form,bills:b});}} /></div>
                          <div><Label className="text-xs">Remarks</Label><Input value={bill.remarks||""} onChange={(e)=>{const b=[...form.bills];b[idx]={...b[idx],remarks:e.target.value};setForm({...form,bills:b});}} /></div>
                          <div><Label className="text-xs">Vendor (optional)</Label><Input value={bill.vendorName||""} onChange={(e)=>{const b=[...form.bills];b[idx]={...b[idx],vendorName:e.target.value};setForm({...form,bills:b});}} /></div>
                          <div><Label className="text-xs">Bill No. (optional)</Label><Input value={bill.billNumber||""} onChange={(e)=>{const b=[...form.bills];b[idx]={...b[idx],billNumber:e.target.value};setForm({...form,bills:b});}} /></div>
                        </div>
                        <BillManager bills={bill.url?[bill]:[]} onChange={(bs)=>{const b=[...form.bills];b[idx]={...b[idx],...(bs[bs.length-1]??{}),amount:b[idx].amount,remarks:b[idx].remarks};setForm({...form,bills:b});}} />
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={()=>setForm({...form,bills:[...form.bills,blankBill()]})}><Plus className="h-3 w-3 mr-1"/>Add Bill</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Food */}
            {form.category === "Food" && (
              <div className="rounded-lg border border-border p-3 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Food & Refreshments</p>
                  <span className="text-sm font-bold">Grand Total: {inr(foodTotal(form.foodBills))}</span>
                </div>
                <div><Label>No. of Volunteers Served</Label><Input type="number" min={0} value={form.volunteerCount} onChange={(e)=>setForm({...form,volunteerCount:+e.target.value})} className="w-32" /></div>
                {form.foodBills.map((fb,fi)=>(
                  <div key={fi} className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{fb.subCategory}</span>
                      <span className="text-xs text-muted-foreground">Subtotal: {inr(billsTotal(fb.bills))}</span>
                    </div>
                    {fb.bills.map((bill,bi)=>(
                      <div key={bill.id} className="rounded border border-border p-2 space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Bill {bi+1}</span>
                          {fb.bills.length>1&&<button type="button" onClick={()=>{const f=[...form.foodBills];f[fi]={...f[fi],bills:f[fi].bills.filter((_,i)=>i!==bi)};setForm({...form,foodBills:f});}} className="text-destructive hover:underline">Delete</button>}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div><Label className="text-xs">Amount (₹) *</Label><Input type="number" min={0} value={bill.amount||""} onChange={(e)=>{const f=[...form.foodBills];const b=[...f[fi].bills];b[bi]={...b[bi],amount:+e.target.value};f[fi]={...f[fi],bills:b};setForm({...form,foodBills:f});}} /></div>
                          <div><Label className="text-xs">Hotel (optional)</Label><Input value={bill.hotelName||""} onChange={(e)=>{const f=[...form.foodBills];const b=[...f[fi].bills];b[bi]={...b[bi],hotelName:e.target.value};f[fi]={...f[fi],bills:b};setForm({...form,foodBills:f});}} /></div>
                        </div>
                        <BillManager bills={bill.url?[bill]:[]} onChange={(bs)=>{const f=[...form.foodBills];const b=[...f[fi].bills];b[bi]={...b[bi],...(bs[bs.length-1]??{}),amount:b[bi].amount};f[fi]={...f[fi],bills:b};setForm({...form,foodBills:f});}} />
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={()=>{const f=[...form.foodBills];f[fi]={...f[fi],bills:[...f[fi].bills,blankBill()]};setForm({...form,foodBills:f});}}><Plus className="h-3 w-3 mr-1"/>Add Bill</Button>
                  </div>
                ))}
              </div>
            )}

            {/* Stationery */}
            {form.category === "Stationery" && (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Stationery Details</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Item Name</Label><Input value={form.itemName} onChange={(e)=>setForm({...form,itemName:e.target.value})} /></div>
                  <div><Label>Quantity</Label><Input type="number" min={1} value={form.quantity} onChange={(e)=>setForm({...form,quantity:+e.target.value})} /></div>
                  <div className="sm:col-span-2"><Label>Remarks</Label><Input value={form.remarks} onChange={(e)=>setForm({...form,remarks:e.target.value})} /></div>
                </div>
                <Label>Bills — Grand Total: <b>{inr(billsTotal(form.bills))}</b></Label>
                <div className="space-y-2">
                  {form.bills.map((bill,idx)=>(
                    <div key={bill.id} className="rounded-md border border-border p-2 space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground"><span>Bill {idx+1}</span><button type="button" onClick={()=>setForm({...form,bills:form.bills.filter((_,i)=>i!==idx)})} className="text-destructive hover:underline">Delete</button></div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div><Label className="text-xs">Amount (₹) *</Label><Input type="number" min={0} value={bill.amount||""} onChange={(e)=>{const b=[...form.bills];b[idx]={...b[idx],amount:+e.target.value};setForm({...form,bills:b});}} /></div>
                        <div><Label className="text-xs">Vendor (optional)</Label><Input value={bill.vendorName||""} onChange={(e)=>{const b=[...form.bills];b[idx]={...b[idx],vendorName:e.target.value};setForm({...form,bills:b});}} /></div>
                      </div>
                      <BillManager bills={bill.url?[bill]:[]} onChange={(bs)=>{const b=[...form.bills];b[idx]={...b[idx],...(bs[bs.length-1]??{}),amount:b[idx].amount};setForm({...form,bills:b});}} />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={()=>setForm({...form,bills:[...form.bills,blankBill()]})}><Plus className="h-3 w-3 mr-1"/>Add Bill</Button>
                </div>
              </div>
            )}

            {/* Fuel */}
            {form.category === "Fuel" && (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Fuel Details</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><Label>Fuel Type</Label>
                    <Select value={form.fuelType} onValueChange={(v)=>setForm({...form,fuelType:v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Petrol","Diesel","CNG","Electric"].map(f=><SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Litres</Label><Input type="number" min={0} step={0.1} value={form.litres} onChange={(e)=>setForm({...form,litres:+e.target.value})} /></div>
                  <div><Label>Vehicle No. (optional)</Label><Input value={form.vehicleNumber} onChange={(e)=>setForm({...form,vehicleNumber:e.target.value})} /></div>
                  <div className="sm:col-span-3"><Label>Remarks</Label><Input value={form.remarks} onChange={(e)=>setForm({...form,remarks:e.target.value})} /></div>
                </div>
                <Label>Bills — Grand Total: <b>{inr(billsTotal(form.bills))}</b></Label>
                <div className="space-y-2">
                  {form.bills.map((bill,idx)=>(
                    <div key={bill.id} className="rounded-md border border-border p-2 space-y-2">
                      <div className="flex justify-between text-xs"><span>Bill {idx+1}</span><button type="button" onClick={()=>setForm({...form,bills:form.bills.filter((_,i)=>i!==idx)})} className="text-destructive hover:underline text-xs">Delete</button></div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div><Label className="text-xs">Amount (₹) *</Label><Input type="number" value={bill.amount||""} onChange={(e)=>{const b=[...form.bills];b[idx]={...b[idx],amount:+e.target.value};setForm({...form,bills:b});}} /></div>
                        <div><Label className="text-xs">Vehicle No.</Label><Input value={bill.vehicleNumber||""} onChange={(e)=>{const b=[...form.bills];b[idx]={...b[idx],vehicleNumber:e.target.value};setForm({...form,bills:b});}} /></div>
                      </div>
                      <BillManager bills={bill.url?[bill]:[]} onChange={(bs)=>{const b=[...form.bills];b[idx]={...b[idx],...(bs[bs.length-1]??{}),amount:b[idx].amount};setForm({...form,bills:b});}} />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={()=>setForm({...form,bills:[...form.bills,blankBill()]})}><Plus className="h-3 w-3 mr-1"/>Add Bill</Button>
                </div>
              </div>
            )}

            {/* Other */}
            {form.category === "Other" && (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Other Expense</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Purpose</Label><Input value={form.purpose} onChange={(e)=>setForm({...form,purpose:e.target.value})} /></div>
                  <div><Label>Remarks</Label><Input value={form.remarks} onChange={(e)=>setForm({...form,remarks:e.target.value})} /></div>
                  <div className="sm:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} rows={2} /></div>
                </div>
                <Label>Bills — Grand Total: <b>{inr(billsTotal(form.bills))}</b></Label>
                <div className="space-y-2">
                  {form.bills.map((bill,idx)=>(
                    <div key={bill.id} className="rounded-md border border-border p-2 space-y-2">
                      <div className="flex justify-between text-xs"><span>Bill {idx+1}</span><button type="button" onClick={()=>setForm({...form,bills:form.bills.filter((_,i)=>i!==idx)})} className="text-destructive hover:underline text-xs">Delete</button></div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div><Label className="text-xs">Amount (₹) *</Label><Input type="number" value={bill.amount||""} onChange={(e)=>{const b=[...form.bills];b[idx]={...b[idx],amount:+e.target.value};setForm({...form,bills:b});}} /></div>
                        <div><Label className="text-xs">Remarks</Label><Input value={bill.remarks||""} onChange={(e)=>{const b=[...form.bills];b[idx]={...b[idx],remarks:e.target.value};setForm({...form,bills:b});}} /></div>
                      </div>
                      <BillManager bills={bill.url?[bill]:[]} onChange={(bs)=>{const b=[...form.bills];b[idx]={...b[idx],...(bs[bs.length-1]??{}),amount:b[idx].amount};setForm({...form,bills:b});}} />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={()=>setForm({...form,bills:[...form.bills,blankBill()]})}><Plus className="h-3 w-3 mr-1"/>Add Bill</Button>
                </div>
              </div>
            )}

            {/* Grand Total */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex justify-between items-center">
              <span className="font-semibold">Grand Total</span>
              <span className="text-xl font-bold text-primary">{inr(calcAmount(form))}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!view} onOpenChange={(o)=>!o&&setView(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {view && (
            <>
              <DialogHeader><DialogTitle>Finance Entry — Day {(view as any).sessionDay}</DialogTitle></DialogHeader>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">Date:</span> {view.date}</div>
                <div><span className="text-muted-foreground">Category:</span> {view.category}</div>
                <div><span className="text-muted-foreground">Cluster:</span> {(view as any).clusterName ?? "—"}</div>
                <div><span className="text-muted-foreground">College:</span> {(view as any).collegeName ?? "—"}</div>
                <div><span className="text-muted-foreground">Financer:</span> {(view as any).financerName ?? "—"}</div>
                <div><span className="text-muted-foreground">Submitted By:</span> {view.submittedBy}</div>
                <div><span className="text-muted-foreground">Amount:</span> <b>{inr(view.amount)}</b></div>
                <div><span className="text-muted-foreground">Status:</span> {view.status}</div>
                {view.travelFrom && <div><span className="text-muted-foreground">From → To:</span> {view.travelFrom} → {view.travelTo}</div>}
                {view.volunteerCount && <div><span className="text-muted-foreground">Volunteers:</span> {view.volunteerCount}</div>}
                {view.description && <div className="sm:col-span-2"><span className="text-muted-foreground">Description:</span> {view.description}</div>}
                <div className="sm:col-span-2">
                  <div className="mb-2 text-muted-foreground">Attached Bills ({view.bills.length})</div>
                  <BillManager bills={view.bills} onChange={()=>{}} readOnly />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reopen Request Dialog */}
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request Reopen</DialogTitle>
            <DialogDescription>Entry is locked. Provide a reason to request reopen from Super Admin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Reason <span className="text-destructive">*</span></Label><Textarea value={reopenReason} onChange={(e)=>setReopenReason(e.target.value)} placeholder="Why do you need to edit this entry?" rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setReopenOpen(false)}>Cancel</Button>
            <Button onClick={submitReopen}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Dialog */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Finance Settlement Report</DialogTitle></DialogHeader>
          <FinanceReport expenses={s.expenses} advances={s.advances} refunds={s.refunds} />
          <DialogFooter>
            <Button variant="outline" onClick={()=>setPdfOpen(false)}>Close</Button>
            <Button onClick={()=>{ if(downloadFinancePdf(s.expenses,s.advances,s.refunds)){toast.success("Save as PDF in print dialog");}else{toast.error("Allow pop-ups");} }}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
