import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { SmartShell as AppShell } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BillManager } from "@/components/layout/bill-manager";
import { KpiCard } from "@/components/layout/kpi-card";
import {
  Wallet, Plus, Save, Send, Eye, Trash2, Pencil,
  Plane, Utensils, PenLine, Boxes, FileText, Download,
} from "lucide-react";
import { useStore, newId, type Expense, type Bill } from "@/lib/store";
import { useAuth, isSuperAdmin, isClusterAdmin } from "@/lib/auth";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance — TQI" }] }),
  component: FinancePage,
});

type FoodCategory = "Breakfast" | "Lunch" | "Refreshments" | "Dinner";
const FOOD_CATEGORIES: FoodCategory[] = ["Breakfast", "Lunch", "Refreshments", "Dinner"];

interface TravelEntry { id: string; from: string; to: string; volunteers: number; amountPerPerson: number; remarks: string; bills: Bill[]; }
interface FoodEntry   { id: string; category: FoodCategory; amount: number; bills: Bill[]; }
interface OtherEntry  { id: string; description: string; amount: number; bills: Bill[]; }

interface FinanceForm {
  // auto-fill header
  clusterName: string; collegeName: string; sessionName: string; sessionDay: number;
  date: string; spocName: string; financerName: string; volunteersCount: number;
  // entries
  travelEntries: TravelEntry[];
  foodEntries: FoodEntry[];
  stationeryAmount: number; stationeryBills: Bill[];
  otherEntries: OtherEntry[];
}

function blankForm(): FinanceForm {
  return {
    clusterName: "", collegeName: "", sessionName: "", sessionDay: 1,
    date: new Date().toISOString().slice(0, 10), spocName: "", financerName: "", volunteersCount: 0,
    travelEntries: [], foodEntries: [],
    stationeryAmount: 0, stationeryBills: [],
    otherEntries: [],
  };
}

function numInput(val: number, onChange: (n: number) => void, className = "") {
  return (
    <input
      className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className}`}
      inputMode="numeric"
      value={val === 0 ? "" : val}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
    />
  );
}

// ── TQI PDF generation ──────────────────────────────────────────────────
function buildTqiFinancePdf(form: FinanceForm, volunteers: string[]): string {
  const travelTotal = form.travelEntries.reduce((s, e) => s + e.volunteers * e.amountPerPerson, 0);
  const foodTotal   = form.foodEntries.reduce((s, e) => s + e.amount, 0);
  const stTotal     = form.stationeryAmount;
  const otherTotal  = form.otherEntries.reduce((s, e) => s + e.amount, 0);
  const grand       = travelTotal + foodTotal + stTotal + otherTotal;

  const th = (t: string) => `<th style="border:1px solid #999;padding:5px 7px;background:#f5f5f5;font-size:11px;text-align:left">${t}</th>`;
  const td = (t: string, align = "left") => `<td style="border:1px solid #ccc;padding:5px 7px;font-size:11px;text-align:${align}">${t}</td>`;

  let sno = 1;
  let tableRows = "";

  // Travel
  form.travelEntries.forEach(e => {
    const billHtml = e.bills.map(b => b.url ? `<img src="${b.url}" style="max-width:60px;max-height:40px;object-fit:contain;vertical-align:middle">` : "").join(" ");
    tableRows += `<tr>
      ${td(String(sno++))}
      ${td(`${e.from} to ${e.to}`)}
      ${td(String(e.volunteers), "center")}
      ${td(`${e.volunteers} × ${e.amountPerPerson}`)}
      ${td(inr(e.volunteers * e.amountPerPerson), "right")}
      ${td(billHtml || "—", "center")}
      ${td(e.remarks || "—")}
    </tr>`;
  });

  // Food
  form.foodEntries.filter(e => e.amount > 0).forEach(e => {
    const billHtml = e.bills.map(b => b.url ? `<img src="${b.url}" style="max-width:60px;max-height:40px;object-fit:contain;vertical-align:middle">` : "").join(" ");
    tableRows += `<tr>
      ${td(String(sno++))}
      ${td(e.category)}
      ${td(String(form.volunteersCount), "center")}
      ${td(`${form.volunteersCount} × ${Math.round(e.amount / Math.max(1, form.volunteersCount))}`)}
      ${td(inr(e.amount), "right")}
      ${td(billHtml || "—", "center")}
      ${td("—")}
    </tr>`;
  });

  // Stationery
  if (stTotal > 0) {
    const billHtml = form.stationeryBills.map(b => b.url ? `<img src="${b.url}" style="max-width:60px;max-height:40px;object-fit:contain;vertical-align:middle">` : "").join(" ");
    tableRows += `<tr>${td(String(sno++))}${td("Stationery")}${td("—","center")}${td("—")}${td(inr(stTotal),"right")}${td(billHtml||"—","center")}${td("—")}</tr>`;
  }

  // Other
  form.otherEntries.filter(e => e.amount > 0).forEach(e => {
    const billHtml = e.bills.map(b => b.url ? `<img src="${b.url}" style="max-width:60px;max-height:40px;object-fit:contain;vertical-align:middle">` : "").join(" ");
    tableRows += `<tr>
      ${td(String(sno++))}
      ${td(e.description || "Other")}
      ${td("—", "center")}${td("—")}
      ${td(inr(e.amount), "right")}
      ${td(billHtml || "—", "center")}
      ${td("—")}
    </tr>`;
  });

  const volList = volunteers.map(v => `<span style="display:inline-block;margin:2px 6px 2px 0;font-size:11px">${v}</span>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>TQI Finance — ${form.clusterName} Day ${form.sessionDay}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:20px}
  h1{text-align:center;font-size:16px;margin:0 0 2px} .sub{text-align:center;font-size:11px;color:#555;margin-bottom:12px}
  .header-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:11px;margin-bottom:14px;border:1px solid #ddd;padding:10px;border-radius:4px}
  .header-grid .lbl{color:#888;font-size:10px} .header-grid .val{font-weight:600}
  table{width:100%;border-collapse:collapse;margin-bottom:10px}
  .total-row td{font-weight:700;background:#f9f9f9}
  .grand-row td{font-weight:700;font-size:13px;background:#e8f0fe;color:#1a56db}
  .vol-section{margin-top:10px;font-size:11px} h3{font-size:12px;margin:14px 0 6px;border-bottom:1px solid #aaa;padding-bottom:3px}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:28px}
  .sign-line{border-top:1px solid #111;padding-top:6px;font-size:11px;text-align:center}
  @media print{body{padding:10px}}
</style></head><body>
<h1>Talent Quest for India — Finance Sheet</h1>
<div class="sub">Session Finance Report</div>

<div class="header-grid">
  <div><div class="lbl">College Name</div><div class="val">${form.collegeName || "—"}</div></div>
  <div><div class="lbl">Cluster</div><div class="val">${form.clusterName || "—"}</div></div>
  <div><div class="lbl">Session</div><div class="val">${form.sessionName || `Day ${form.sessionDay}`}</div></div>
  <div><div class="lbl">Day</div><div class="val">Day ${form.sessionDay}</div></div>
  <div><div class="lbl">Date</div><div class="val">${form.date}</div></div>
  <div><div class="lbl">No. of Volunteers</div><div class="val">${form.volunteersCount}</div></div>
  <div><div class="lbl">SPOC Name</div><div class="val">${form.spocName || "—"}</div></div>
  <div><div class="lbl">Financer Name</div><div class="val">${form.financerName || "—"}</div></div>
</div>

<h3>Expense Details</h3>
<table>
  <thead><tr>
    ${th("S.No")}${th("Description")}${th("No. of Volunteers")}${th("Count × Amount")}${th("Total Amount")}${th("Bill/Ticket")}${th("Remarks")}
  </tr></thead>
  <tbody>${tableRows}</tbody>
  <tfoot>
    ${travelTotal>0?`<tr class="total-row">${td("")}${td("Travel Total")}${td("")}${td("")}${td(inr(travelTotal),"right")}${td("")}${td("")}</tr>`:""}
    ${foodTotal>0?`<tr class="total-row">${td("")}${td("Food Total")}${td("")}${td("")}${td(inr(foodTotal),"right")}${td("")}${td("")}</tr>`:""}
    ${stTotal>0?`<tr class="total-row">${td("")}${td("Stationery Total")}${td("")}${td("")}${td(inr(stTotal),"right")}${td("")}${td("")}</tr>`:""}
    ${otherTotal>0?`<tr class="total-row">${td("")}${td("Other Total")}${td("")}${td("")}${td(inr(otherTotal),"right")}${td("")}${td("")}</tr>`:""}
    <tr class="grand-row">${td("")}${td("Grand Total")}${td("")}${td("")}${td(inr(grand),"right")}${td("")}${td("")}</tr>
  </tfoot>
</table>

${volunteers.length > 0 ? `<h3>Volunteer List</h3><div class="vol-section">${volList}</div>` : ""}

<div class="signatures">
  <div><div style="margin-bottom:40px"></div><div class="sign-line">Volunteer Signature</div></div>
  <div><div style="margin-bottom:40px"></div><div class="sign-line">Coordinator / SPOC Signature</div></div>
</div>
</body></html>`;
}

function printTqiFinancePdf(form: FinanceForm, volunteers: string[]) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) { toast.error("Allow pop-ups to download PDF"); return; }
  win.document.write(buildTqiFinancePdf(form, volunteers));
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

// ── Main page component ──────────────────────────────────────────────────
function FinancePage() {
  const s = useStore();
  const { user } = useAuth();
  const isSuper  = isSuperAdmin(user?.role);
  const isCluster = isClusterAdmin(user?.role);
  const myClusterId = user?.clusterId ?? "";

  const [form, setForm]       = useState<FinanceForm>(blankForm());
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId]   = useState<string | null>(null);
  const [viewExp, setViewExp] = useState<Expense | null>(null);

  // Auto-fill header on open / store change
  useEffect(() => {
    const cluster = s.clusters.find(c => c.id === myClusterId);
    const admin   = s.admins.find(a => a.id === user?.id);
    const college = s.colleges.find(c => c.clusterId === myClusterId);
    setForm(prev => ({
      ...prev,
      clusterName:  cluster?.name ?? "",
      collegeName:  college?.name ?? admin?.college ?? "",
      spocName:     admin?.name ?? user?.name ?? "",
      financerName: s.financeSettings?.[0]?.defaultFinancerName ?? "TQI Finance Team",
    }));
  }, [s.clusters, s.admins, s.colleges, s.financeSettings, myClusterId, user]);

  // My expenses
  const myExpenses = useMemo(() =>
    isCluster ? s.expenses.filter(e => e.clusterId === myClusterId) : s.expenses,
    [s.expenses, isCluster, myClusterId]);

  // Totals
  const totals = useMemo(() => {
    const travel = form.travelEntries.reduce((s, e) => s + e.volunteers * e.amountPerPerson, 0);
    const food   = form.foodEntries.reduce((s, e) => s + e.amount, 0);
    const st     = form.stationeryAmount || 0;
    const other  = form.otherEntries.reduce((s, e) => s + e.amount, 0);
    return { travel, food, st, other, grand: travel + food + st + other };
  }, [form]);

  // ── Volunteer list for PDF ──
  const myVolunteers = useMemo(() =>
    s.volunteers.filter(v => v.clusterId === myClusterId).map(v => v.name),
    [s.volunteers, myClusterId]);

  // ── Actions ──
  const openCreate = () => {
    setEditId(null);
    setForm(prev => ({ ...blankForm(), clusterName: prev.clusterName, collegeName: prev.collegeName, spocName: prev.spocName, financerName: prev.financerName }));
    setFormOpen(true);
  };

  const openEdit = (exp: Expense) => {
    setEditId(exp.id);
    setForm({
      clusterName: exp.clusterName ?? "",
      collegeName: exp.collegeName ?? "",
      sessionName: exp.description ?? "",
      sessionDay: exp.sessionDay ?? 1,
      date: exp.date,
      spocName: exp.submittedBy ?? "",
      financerName: exp.financerName ?? "",
      volunteersCount: exp.volunteerCount ?? 0,
      travelEntries: (exp as any).travelEntries ?? [],
      foodEntries: (exp as any).foodEntries ?? [],
      stationeryAmount: (exp as any).stationeryAmount ?? 0,
      stationeryBills: (exp as any).stationeryBills ?? [],
      otherEntries: (exp as any).otherEntries ?? [],
    });
    setFormOpen(true);
  };

  const handleSave = async (status: "Pending" | "Submitted") => {
    if (!form.date) return toast.error("Date required");
    const payload: any = {
      id: editId || newId(),
      sessionDay: form.sessionDay,
      date: form.date,
      clusterId: myClusterId,
      clusterName: form.clusterName,
      collegeName: form.collegeName,
      description: form.sessionName,
      financerName: form.financerName,
      submittedBy: form.spocName,
      volunteerCount: form.volunteersCount,
      category: "Travel" as const,
      amount: totals.grand,
      status,
      bills: [
        ...form.travelEntries.flatMap(e => e.bills),
        ...form.foodEntries.flatMap(e => e.bills),
        ...form.stationeryBills,
        ...form.otherEntries.flatMap(e => e.bills),
      ],
      // full detail stored for view/pdf
      travelEntries: form.travelEntries,
      foodEntries: form.foodEntries,
      stationeryAmount: form.stationeryAmount,
      stationeryBills: form.stationeryBills,
      otherEntries: form.otherEntries,
    };
    await s.upsert("expenses", payload);
    toast.success(status === "Submitted" ? "Finance submitted" : "Draft saved");
    setFormOpen(false);
    setEditId(null);
  };

  // ── Super Admin view ──
  if (isSuper) {
    const allTotal = s.expenses.reduce((sum, e) => sum + e.amount, 0);
    const clusterSums = s.clusters.map(c => ({
      ...c,
      total: s.expenses.filter(e => e.clusterId === c.id).reduce((sum, e) => sum + e.amount, 0),
      submitted: s.expenses.filter(e => e.clusterId === c.id && e.status === "Submitted").length,
    }));
    return (
      <AppShell>
        <div className="px-4 sm:px-6 py-6">
          <h2 className="text-xl font-bold mb-4">Finance — All Clusters (View Only)</h2>
          <div className="grid gap-3 md:grid-cols-3 mb-6">
            <KpiCard label="Total Finance" value={inr(allTotal)} icon={Wallet} tone="primary" />
            <KpiCard label="Total Entries" value={s.expenses.length} icon={FileText} tone="info" />
            <KpiCard label="Submitted" value={s.expenses.filter(e => e.status === "Submitted").length} icon={Send} tone="success" />
          </div>
          <div className="space-y-3">
            {clusterSums.map(c => (
              <Card key={c.id} className="shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.submitted} submitted · {inr(c.total)}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* All entries table */}
          <div className="mt-6 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs">
                <tr>
                  {["Session","Date","Grand Total","Status","Created By","Cluster","Actions"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.expenses.map(exp => (
                  <tr key={exp.id} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2">Day {exp.sessionDay}</td>
                    <td className="px-3 py-2">{exp.date}</td>
                    <td className="px-3 py-2 font-semibold">{inr(exp.amount)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={exp.status === "Submitted" ? "default" : "outline"}>{exp.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{exp.submittedBy}</td>
                    <td className="px-3 py-2 text-muted-foreground">{exp.clusterName}</td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewExp(exp)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {s.expenses.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No finance entries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Cluster Admin — not allowed ──
  if (!isCluster) {
    return <AppShell><div className="p-8 text-center text-muted-foreground">Only Cluster Admin can manage finance entries.</div></AppShell>;
  }

  // ── Cluster Admin main view ──
  return (
    <AppShell>
      <div className="px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-bold">Finance</h2>
            <p className="text-sm text-muted-foreground">Track session-wise expenses</p>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> New Finance Entry</Button>
        </div>

        {/* Dashboard table */}
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs">
              <tr>
                {["Session","Date","Grand Total","Status","Created By","Last Updated","Actions"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myExpenses.map(exp => (
                <tr key={exp.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2">Day {exp.sessionDay}{exp.description ? ` — ${exp.description}` : ""}</td>
                  <td className="px-3 py-2">{exp.date}</td>
                  <td className="px-3 py-2 font-semibold">{inr(exp.amount)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={exp.status === "Submitted" ? "default" : exp.status === "Approved" ? "default" : "outline"}
                      className={exp.status === "Submitted" ? "bg-blue-600 text-white" : exp.status === "Approved" ? "bg-green-600 text-white" : ""}>
                      {exp.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{exp.submittedBy}</td>
                  <td className="px-3 py-2 text-muted-foreground">{exp.date}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="View / Generate PDF" onClick={() => setViewExp(exp)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {exp.status !== "Submitted" && exp.status !== "Approved" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => openEdit(exp)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {myExpenses.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No finance entries yet. Click "New Finance Entry" to start.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create / Edit Form Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Finance Entry" : "New Finance Entry"} — {form.clusterName}</DialogTitle>
          </DialogHeader>

          {/* Auto-fill header */}
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-4">
            {[
              { label: "Cluster", value: form.clusterName },
              { label: "College Name", value: form.collegeName },
              { label: "SPOC Name", value: form.spocName },
              { label: "Financer Name", value: form.financerName },
            ].map(f => (
              <div key={f.label}>
                <div className="text-[10px] uppercase text-muted-foreground">{f.label}</div>
                <div className="font-medium truncate">{f.value || "—"}</div>
              </div>
            ))}
          </div>

          {/* Manual header fields */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Session Day <span className="text-destructive">*</span></Label>
              <Select value={String(form.sessionDay)} onValueChange={v => {
                const sess = s.sessions.find(ss => ss.day === +v && ss.clusterId === myClusterId);
                setForm(prev => ({ ...prev, sessionDay: +v, sessionName: sess?.title ?? "", date: sess?.date ?? prev.date }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map(d => {
                    const sess = s.sessions.find(ss => ss.day === d && ss.clusterId === myClusterId);
                    return <SelectItem key={d} value={String(d)}>Day {d}{sess ? ` — ${sess.title}` : ""}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">No. of Volunteers</Label>
              {numInput(form.volunteersCount, n => setForm(prev => ({ ...prev, volunteersCount: n })))}
            </div>
          </div>

          {/* ── TRAVEL ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Plane className="h-4 w-4" /> Travel</h3>
              <Button size="sm" variant="outline" onClick={() => setForm(prev => ({
                ...prev, travelEntries: [...prev.travelEntries, { id: newId(), from: "", to: "", volunteers: 0, amountPerPerson: 0, remarks: "", bills: [] }]
              }))}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Travel Entry
              </Button>
            </div>
            {form.travelEntries.map((entry, i) => (
              <Card key={entry.id} className="shadow-sm">
                <CardContent className="pt-4 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-5">
                    <div>
                      <Label className="text-xs">From</Label>
                      <Input placeholder="e.g. KSR" value={entry.from} onChange={e => setForm(prev => ({ ...prev, travelEntries: prev.travelEntries.map((t, j) => j === i ? { ...t, from: e.target.value } : t) }))} />
                    </div>
                    <div>
                      <Label className="text-xs">To</Label>
                      <Input placeholder="e.g. Salem" value={entry.to} onChange={e => setForm(prev => ({ ...prev, travelEntries: prev.travelEntries.map((t, j) => j === i ? { ...t, to: e.target.value } : t) }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Volunteers</Label>
                      {numInput(entry.volunteers, n => setForm(prev => ({ ...prev, travelEntries: prev.travelEntries.map((t, j) => j === i ? { ...t, volunteers: n } : t) })))}
                    </div>
                    <div>
                      <Label className="text-xs">Amount / Person (₹)</Label>
                      {numInput(entry.amountPerPerson, n => setForm(prev => ({ ...prev, travelEntries: prev.travelEntries.map((t, j) => j === i ? { ...t, amountPerPerson: n } : t) })))}
                    </div>
                    <div>
                      <Label className="text-xs">Total</Label>
                      <div className="h-9 flex items-center px-3 bg-blue-50 rounded-md text-sm font-semibold text-blue-700">
                        {entry.volunteers} × {entry.amountPerPerson} = {inr(entry.volunteers * entry.amountPerPerson)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Remarks (optional)</Label>
                    <Input placeholder="Optional remarks" value={entry.remarks} onChange={e => setForm(prev => ({ ...prev, travelEntries: prev.travelEntries.map((t, j) => j === i ? { ...t, remarks: e.target.value } : t) }))} />
                  </div>
                  <BillManager bills={entry.bills} onChange={bills => setForm(prev => ({ ...prev, travelEntries: prev.travelEntries.map((t, j) => j === i ? { ...t, bills } : t) }))} />
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setForm(prev => ({ ...prev, travelEntries: prev.travelEntries.filter((_, j) => j !== i) }))}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── FOOD ── */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Utensils className="h-4 w-4" /> Food</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {FOOD_CATEGORIES.map(cat => {
                const entry = form.foodEntries.find(f => f.category === cat);
                const updateAmount = (n: number) => {
                  if (entry) {
                    setForm(prev => ({ ...prev, foodEntries: prev.foodEntries.map(f => f.category === cat ? { ...f, amount: n } : f) }));
                  } else {
                    setForm(prev => ({ ...prev, foodEntries: [...prev.foodEntries, { id: newId(), category: cat, amount: n, bills: [] }] }));
                  }
                };
                const updateBills = (bills: Bill[]) => {
                  if (entry) {
                    setForm(prev => ({ ...prev, foodEntries: prev.foodEntries.map(f => f.category === cat ? { ...f, bills } : f) }));
                  } else {
                    setForm(prev => ({ ...prev, foodEntries: [...prev.foodEntries, { id: newId(), category: cat, amount: 0, bills }] }));
                  }
                };
                return (
                  <Card key={cat} className="shadow-sm">
                    <CardHeader className="py-3 px-4"><CardTitle className="text-sm">{cat}</CardTitle></CardHeader>
                    <CardContent className="pb-4 px-4 space-y-2">
                      <div><Label className="text-xs">Amount (₹)</Label>{numInput(entry?.amount ?? 0, updateAmount)}</div>
                      <BillManager bills={entry?.bills ?? []} onChange={updateBills} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* ── STATIONERY ── */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2"><PenLine className="h-4 w-4" /> Stationery</h3>
            <Card className="shadow-sm"><CardContent className="pt-4 pb-4 space-y-2">
              <div><Label className="text-xs">Amount (₹)</Label>{numInput(form.stationeryAmount, n => setForm(prev => ({ ...prev, stationeryAmount: n })))}</div>
              <BillManager bills={form.stationeryBills} onChange={bills => setForm(prev => ({ ...prev, stationeryBills: bills }))} />
            </CardContent></Card>
          </div>

          {/* ── OTHER ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Boxes className="h-4 w-4" /> Other</h3>
              <Button size="sm" variant="outline" onClick={() => setForm(prev => ({
                ...prev, otherEntries: [...prev.otherEntries, { id: newId(), description: "", amount: 0, bills: [] }]
              }))}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Other
              </Button>
            </div>
            {form.otherEntries.map((entry, i) => (
              <Card key={entry.id} className="shadow-sm">
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Description</Label>
                      <Input placeholder="e.g. Banner, Certificates" value={entry.description} onChange={e => setForm(prev => ({ ...prev, otherEntries: prev.otherEntries.map((o, j) => j === i ? { ...o, description: e.target.value } : o) }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Amount (₹)</Label>
                      {numInput(entry.amount, n => setForm(prev => ({ ...prev, otherEntries: prev.otherEntries.map((o, j) => j === i ? { ...o, amount: n } : o) })))}
                    </div>
                  </div>
                  <BillManager bills={entry.bills} onChange={bills => setForm(prev => ({ ...prev, otherEntries: prev.otherEntries.map((o, j) => j === i ? { ...o, bills } : o) }))} />
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setForm(prev => ({ ...prev, otherEntries: prev.otherEntries.filter((_, j) => j !== i) }))}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Totals ── */}
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 space-y-1.5 text-sm">
            {totals.travel > 0 && <div className="flex justify-between"><span>Travel Total</span><b>{inr(totals.travel)}</b></div>}
            {totals.food > 0   && <div className="flex justify-between"><span>Food Total</span><b>{inr(totals.food)}</b></div>}
            {totals.st > 0     && <div className="flex justify-between"><span>Stationery Total</span><b>{inr(totals.st)}</b></div>}
            {totals.other > 0  && <div className="flex justify-between"><span>Other Total</span><b>{inr(totals.other)}</b></div>}
            <div className="flex justify-between border-t pt-2 font-bold text-base text-blue-700">
              <span>Grand Total</span><span>{inr(totals.grand)}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => handleSave("Pending")}><Save className="h-4 w-4 mr-1" /> Save Draft</Button>
            <Button onClick={() => handleSave("Submitted")}><Send className="h-4 w-4 mr-1" /> Submit Finance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View / PDF Dialog ── */}
      {viewExp && (() => {
        const formData: FinanceForm = {
          clusterName: viewExp.clusterName ?? "",
          collegeName: viewExp.collegeName ?? "",
          sessionName: viewExp.description ?? "",
          sessionDay: viewExp.sessionDay ?? 1,
          date: viewExp.date,
          spocName: viewExp.submittedBy ?? "",
          financerName: viewExp.financerName ?? "",
          volunteersCount: viewExp.volunteerCount ?? 0,
          travelEntries: (viewExp as any).travelEntries ?? [],
          foodEntries: (viewExp as any).foodEntries ?? [],
          stationeryAmount: (viewExp as any).stationeryAmount ?? 0,
          stationeryBills: (viewExp as any).stationeryBills ?? [],
          otherEntries: (viewExp as any).otherEntries ?? [],
        };
        const tTotal = formData.travelEntries.reduce((s, e) => s + e.volunteers * e.amountPerPerson, 0);
        const fTotal = formData.foodEntries.reduce((s, e) => s + e.amount, 0);
        const sTotal = formData.stationeryAmount;
        const oTotal = formData.otherEntries.reduce((s, e) => s + e.amount, 0);
        const grand  = tTotal + fTotal + sTotal + oTotal;
        return (
          <Dialog open={!!viewExp} onOpenChange={o => !o && setViewExp(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Finance Preview — Day {viewExp.sessionDay} · {viewExp.clusterName}</DialogTitle>
              </DialogHeader>
              {/* Header */}
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4">
                {[["College", formData.collegeName], ["Cluster", formData.clusterName], ["Session", formData.sessionName || `Day ${formData.sessionDay}`], ["Day", `Day ${formData.sessionDay}`], ["Date", formData.date], ["Volunteers", String(formData.volunteersCount)], ["SPOC", formData.spocName], ["Financer", formData.financerName]].map(([l, v]) => (
                  <div key={l}><div className="text-muted-foreground">{l}</div><div className="font-medium">{v || "—"}</div></div>
                ))}
              </div>
              {/* Detail table */}
              <div className="overflow-x-auto text-xs">
                <table className="w-full border-collapse">
                  <thead><tr className="bg-muted">
                    {["S.No","Description","Volunteers","Count×Amount","Total","Bills","Remarks"].map(h => <th key={h} className="border border-border px-2 py-1.5 text-left font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {[...formData.travelEntries.map((e, i) => ({
                      sno: i + 1, desc: `${e.from} → ${e.to}`, vol: e.volunteers,
                      calc: `${e.volunteers} × ${e.amountPerPerson}`,
                      total: e.volunteers * e.amountPerPerson, bills: e.bills, remarks: e.remarks
                    })),
                    ...formData.foodEntries.filter(e => e.amount > 0).map((e, i) => ({
                      sno: formData.travelEntries.length + i + 1, desc: e.category, vol: formData.volunteersCount,
                      calc: `—`, total: e.amount, bills: e.bills, remarks: "—"
                    })),
                    ...(sTotal > 0 ? [{ sno: 999, desc: "Stationery", vol: 0, calc: "—", total: sTotal, bills: formData.stationeryBills, remarks: "—" }] : []),
                    ...formData.otherEntries.filter(e => e.amount > 0).map((e, i) => ({
                      sno: 1000 + i, desc: e.description || "Other", vol: 0, calc: "—", total: e.amount, bills: e.bills, remarks: "—"
                    }))
                    ].map((row, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="border border-border/40 px-2 py-1">{idx + 1}</td>
                        <td className="border border-border/40 px-2 py-1 font-medium">{row.desc}</td>
                        <td className="border border-border/40 px-2 py-1 text-center">{row.vol || "—"}</td>
                        <td className="border border-border/40 px-2 py-1">{row.calc}</td>
                        <td className="border border-border/40 px-2 py-1 font-semibold text-right">{inr(row.total)}</td>
                        <td className="border border-border/40 px-2 py-1">
                          <div className="flex flex-wrap gap-1">
                            {row.bills.map(b => b.url ? <img key={b.id} src={b.url} alt={b.name} className="h-8 w-8 object-contain rounded border" /> : null)}
                            {row.bills.length === 0 && "—"}
                          </div>
                        </td>
                        <td className="border border-border/40 px-2 py-1">{row.remarks || "—"}</td>
                      </tr>
                    ))}
                    {tTotal > 0 && <tr className="bg-slate-50 font-semibold"><td colSpan={4} className="border border-border/40 px-2 py-1 text-right">Travel Total</td><td className="border border-border/40 px-2 py-1 text-right">{inr(tTotal)}</td><td colSpan={2} className="border border-border/40"></td></tr>}
                    {fTotal > 0 && <tr className="bg-slate-50 font-semibold"><td colSpan={4} className="border border-border/40 px-2 py-1 text-right">Food Total</td><td className="border border-border/40 px-2 py-1 text-right">{inr(fTotal)}</td><td colSpan={2} className="border border-border/40"></td></tr>}
                    {sTotal > 0 && <tr className="bg-slate-50 font-semibold"><td colSpan={4} className="border border-border/40 px-2 py-1 text-right">Stationery Total</td><td className="border border-border/40 px-2 py-1 text-right">{inr(sTotal)}</td><td colSpan={2} className="border border-border/40"></td></tr>}
                    {oTotal > 0 && <tr className="bg-slate-50 font-semibold"><td colSpan={4} className="border border-border/40 px-2 py-1 text-right">Other Total</td><td className="border border-border/40 px-2 py-1 text-right">{inr(oTotal)}</td><td colSpan={2} className="border border-border/40"></td></tr>}
                    <tr className="bg-blue-50 font-bold text-blue-700"><td colSpan={4} className="border border-border/40 px-2 py-2 text-right text-sm">Grand Total</td><td className="border border-border/40 px-2 py-2 text-right text-sm">{inr(grand)}</td><td colSpan={2} className="border border-border/40"></td></tr>
                  </tbody>
                </table>
              </div>
              {/* Volunteer list */}
              {myVolunteers.length > 0 && (
                <div>
                  <div className="text-xs font-semibold mb-1 text-muted-foreground uppercase">Volunteer List</div>
                  <div className="flex flex-wrap gap-1">
                    {myVolunteers.map(v => <Badge key={v} variant="outline" className="text-xs">{v}</Badge>)}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewExp(null)}>Close</Button>
                <Button onClick={() => printTqiFinancePdf(formData, myVolunteers)}>
                  <Download className="h-4 w-4 mr-1" /> Generate PDF
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </AppShell>
  );
}
