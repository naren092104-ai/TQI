import { createFileRoute } from "@tanstack/react-router";
import React, { useMemo, useState, useEffect } from "react";
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
import {
  Wallet, Plus, Save, Send, Eye, Trash2, Pencil, Settings,
  Plane, Utensils, PenLine, Boxes, FileText, Download,
  ChevronRight, ChevronLeft, CheckCircle, XCircle, Lock, Unlock,
  TrendingUp, ArrowLeft,
} from "lucide-react";
import { useStore, newId, type Expense, type Bill, type FinanceSettingsRecord } from "@/lib/store";
import { useAuth, isSuperAdmin, isClusterAdmin } from "@/lib/auth";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance — TQI" }] }),
  component: FinancePage,
});

// ─── Types ───────────────────────────────────────────────────────────────────
type FoodCategory = "Breakfast" | "Lunch" | "Dinner" | "Refreshments";
const FOOD_CATEGORIES: FoodCategory[] = ["Breakfast", "Lunch", "Dinner", "Refreshments"];

interface TravelEntry { id: string; from: string; to: string; volunteers: number; amountPerPerson: number; remarks: string; bills: Bill[]; }
interface FoodEntry   { id: string; category: FoodCategory; count: number; amount: number; bills: Bill[]; }
interface StationeryEntry { id: string; itemName: string; quantity: number; amount: number; }
interface OtherEntry  { id: string; description: string; amount: number; remarks: string; bills: Bill[]; }

interface FinanceForm {
  clusterName: string; collegeName: string; sessionName: string; sessionDay: number;
  date: string; spocName: string; financerName: string; volunteersCount: number;
  travelEntries: TravelEntry[];
  foodEntries: FoodEntry[];
  stationeryEntries: StationeryEntry[];
  stationeryBills: Bill[];
  otherEntries: OtherEntry[];
}

function blankForm(): FinanceForm {
  return {
    clusterName: "", collegeName: "", sessionName: "", sessionDay: 1,
    date: new Date().toISOString().slice(0, 10), spocName: "", financerName: "", volunteersCount: 0,
    travelEntries: [],
    foodEntries: FOOD_CATEGORIES.map(c => ({ id: newId(), category: c, count: 0, amount: 0, bills: [] })),
    stationeryEntries: [],
    stationeryBills: [],
    otherEntries: [],
  };
}

function numInput(val: number, onChange: (n: number) => void, className = "") {
  return (
    <input
      className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className}`}
      inputMode="decimal"
      value={val === 0 ? "" : val}
      placeholder="0"
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
    />
  );
}

function calcTotals(form: FinanceForm) {
  const travel = (form.travelEntries ?? []).reduce((s, e) => s + (Number(e.volunteers)||0) * (Number(e.amountPerPerson)||0), 0);
  const food   = (form.foodEntries ?? []).reduce((s, e) => s + (Number(e.count)||0) * (Number(e.amount)||0), 0);
  const st     = (form.stationeryEntries ?? []).reduce((s, e) => s + (Number(e.quantity)||0) * (Number(e.amount)||0), 0);
  const other  = (form.otherEntries ?? []).reduce((s, e) => s + (Number(e.amount)||0), 0);
  return { travel, food, st, other, grand: travel + food + st + other };
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

function statusBadge(status: string) {
  const cls =
    status === "Submitted" ? "bg-blue-100 text-blue-700" :
    status === "Approved"  ? "bg-green-100 text-green-700" :
    status === "Rejected"  ? "bg-red-100 text-red-600" :
    status === "Locked"    ? "bg-slate-200 text-slate-600" :
    "bg-yellow-100 text-yellow-700";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{status}</span>;
}

// ─── PDF Generator ───────────────────────────────────────────────────────────
function buildPdf(form: FinanceForm, volunteers: {name:string;college?:string;year?:string}[], settings: FinanceSettingsRecord | null, advance: number, balance: number): string {
  const t = calcTotals(form);
  const th = (x: string) => `<th style="border:1px solid #999;padding:5px 8px;background:#f0f4f8;font-size:11px;text-align:left">${x}</th>`;
  const td = (x: string, align = "left") => `<td style="border:1px solid #ddd;padding:5px 8px;font-size:11px;text-align:${align}">${x}</td>`;
  let sno = 1; let rows = "";

  (form.travelEntries ?? []).forEach(e => {
    const vol = Number(e.volunteers) || 0;
    const amt = Number(e.amountPerPerson) || 0;
    const billHtml = (e.bills ?? []).map(b => b.url ? `<img src="${b.url}" style="max-width:55px;max-height:38px;object-fit:contain">` : "").join(" ");
    rows += `<tr>${td(String(sno++))}${td("Travel")}${td(`${e.from||"—"} → ${e.to||"—"}`)}${td(String(vol),"center")}${td(`${vol}×₹${amt}`,"center")}${td(inr(vol*amt),"right")}${td(billHtml||"—","center")}${td(e.remarks||"—")}</tr>`;
  });
  (form.foodEntries ?? []).filter(e => (Number(e.count)||0) > 0 && (Number(e.amount)||0) > 0).forEach(e => {
    const cnt = Number(e.count) || 0;
    const amt = Number(e.amount) || 0;
    const billHtml = (e.bills ?? []).map(b => b.url ? `<img src="${b.url}" style="max-width:55px;max-height:38px;object-fit:contain">` : "").join(" ");
    rows += `<tr>${td(String(sno++))}${td("Food")}${td(e.category||"Food")}${td(String(cnt),"center")}${td(`${cnt}×₹${amt}`,"center")}${td(inr(cnt*amt),"right")}${td(billHtml||"—","center")}${td("—")}</tr>`;
  });
  (form.stationeryEntries ?? []).filter(e => (Number(e.quantity)||0) > 0 && (Number(e.amount)||0) > 0).forEach(e => {
    const qty = Number(e.quantity) || 0;
    const amt = Number(e.amount) || 0;
    rows += `<tr>${td(String(sno++))}${td("Stationery")}${td(e.itemName||"Item")}${td(String(qty),"center")}${td(`${qty}×₹${amt}`,"center")}${td(inr(qty*amt),"right")}${td("—","center")}${td("—")}</tr>`;
  });
  (form.otherEntries ?? []).filter(e => (Number(e.amount)||0) > 0).forEach(e => {
    const amt = Number(e.amount) || 0;
    const billHtml = (e.bills ?? []).map(b => b.url ? `<img src="${b.url}" style="max-width:55px;max-height:38px;object-fit:contain">` : "").join(" ");
    rows += `<tr>${td(String(sno++))}${td("Other")}${td(e.description||"Misc")}${td("—","center")}${td("—","center")}${td(inr(amt),"right")}${td(billHtml||"—","center")}${td(e.remarks||"—")}</tr>`;
  });

  if (!rows) rows = `<tr><td colspan="8" style="padding:8px;text-align:center;color:#999">No expense entries</td></tr>`;

  const subRow = (label: string, val: number) => val > 0 ? `<tr style="background:#f8f8f8"><td colspan="5" style="border:1px solid #ddd;padding:4px 8px;font-size:11px;text-align:right;font-weight:600">${label}</td><td style="border:1px solid #ddd;padding:4px 8px;font-size:11px;text-align:right;font-weight:600">${inr(val)}</td><td colspan="2" style="border:1px solid #ddd"></td></tr>` : "";
  const footer = settings?.pdfFooter ?? "Talent Quest for India — Finance Audit Document";
  const sigName = settings?.signatureName ?? "Coordinator";
  const sigDes  = settings?.signatureDesignation ?? "SPOC";

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>TQI Finance — ${form.clusterName} Day ${form.sessionDay}</title>
<style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;padding:18px;color:#111}
h1{text-align:center;font-size:15px;margin:0 0 2px}.sub{text-align:center;font-size:10px;color:#555;margin-bottom:10px}
.hdr{display:grid;grid-template-columns:repeat(4,1fr);gap:4px 20px;border:1px solid #ddd;padding:8px;border-radius:4px;margin-bottom:12px;font-size:11px}
.lbl{color:#888;font-size:9px;text-transform:uppercase}.val{font-weight:600}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
.grand{background:#dbeafe;font-weight:700;font-size:13px;color:#1d4ed8}
.adv{background:#dcfce7;font-weight:700;color:#166534}
.bal{background:#fff7ed;font-weight:700;color:#9a3412}
.vol-sec{font-size:11px;margin-top:8px}h3{font-size:11px;font-weight:700;border-bottom:1px solid #aaa;padding-bottom:2px;margin:10px 0 5px}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:24px}
.sig-line{border-top:1px solid #111;padding-top:5px;font-size:10px;text-align:center}
.foot{text-align:center;font-size:9px;color:#888;margin-top:14px;border-top:1px solid #eee;padding-top:6px}
@media print{body{padding:8px}}</style></head><body>
<h1>Talent Quest for India — Finance Sheet</h1>
<div class="sub">${settings?.organizationName || "TQI"}</div>
<div class="hdr">
  <div><div class="lbl">College</div><div class="val">${form.collegeName||"—"}</div></div>
  <div><div class="lbl">Cluster</div><div class="val">${form.clusterName||"—"}</div></div>
  <div><div class="lbl">Session</div><div class="val">${form.sessionName||`Day ${form.sessionDay}`}</div></div>
  <div><div class="lbl">Day</div><div class="val">Day ${form.sessionDay}</div></div>
  <div><div class="lbl">Date</div><div class="val">${form.date}</div></div>
  <div><div class="lbl">Volunteers</div><div class="val">${form.volunteersCount}</div></div>
  <div><div class="lbl">SPOC</div><div class="val">${form.spocName||"—"}</div></div>
  <div><div class="lbl">Financer</div><div class="val">${form.financerName||"—"}</div></div>
  <div><div class="lbl">Advance Released</div><div class="val">${inr(advance)}</div></div>
  <div><div class="lbl">Balance</div><div class="val">${inr(balance)}</div></div>
</div>
<h3>Expense Details</h3>
<table><thead><tr>${th("S.No")}${th("Category")}${th("Description")}${th("Count")}${th("Count×Amount")}${th("Total")}${th("Bills")}${th("Remarks")}</tr></thead>
<tbody>${rows}</tbody>
<tfoot>
${subRow("Travel Total", t.travel)}
${subRow("Food Total", t.food)}
${subRow("Stationery Total", t.st)}
${subRow("Other Total", t.other)}
<tr class="grand"><td colspan="5" style="border:1px solid #ddd;padding:5px 8px;text-align:right">Grand Total</td><td style="border:1px solid #ddd;padding:5px 8px;text-align:right">${inr(t.grand)}</td><td colspan="2" style="border:1px solid #ddd"></td></tr>
<tr class="adv"><td colspan="5" style="border:1px solid #ddd;padding:5px 8px;text-align:right">Advance Released</td><td style="border:1px solid #ddd;padding:5px 8px;text-align:right">${inr(advance)}</td><td colspan="2" style="border:1px solid #ddd"></td></tr>
<tr class="bal"><td colspan="5" style="border:1px solid #ddd;padding:5px 8px;text-align:right">Balance</td><td style="border:1px solid #ddd;padding:5px 8px;text-align:right">${inr(balance)}</td><td colspan="2" style="border:1px solid #ddd"></td></tr>
</tfoot></table>
${volunteers.length > 0 ? `<h3>Volunteer List</h3><table><thead><tr>${th("S.No")}${th("Volunteer Name")}${th("College")}${th("Year")}</tr></thead><tbody>${volunteers.map((v,i)=>`<tr>${td(String(i+1))}${td(v.name)}${td(v.college||"—")}${td(v.year||"—")}</tr>`).join("")}</tbody></table>` : ""}
<div class="sigs">
  <div><div style="height:32px"></div><div class="sig-line">${sigName}<br><span style="color:#888;font-size:9px">${sigDes}</span></div></div>
  <div><div style="height:32px"></div><div class="sig-line">Cluster Admin<br><span style="color:#888;font-size:9px">${form.spocName||"SPOC"}</span></div></div>
</div>
<div class="foot">${footer}</div>
</body></html>`;
}

function printFinancePdf(form: FinanceForm, volunteers: {name:string;college?:string;year?:string}[], settings: FinanceSettingsRecord | null, advance: number, balance: number) {
  const html = buildPdf(form, volunteers, settings, advance, balance);
  // Try popup first; fall back to blob download if blocked
  const win = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  } else {
    // Fallback: open as blob URL in same tab
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast.info("PDF opened in new tab — use Ctrl+P / Cmd+P to print");
  }
}

// ─── Main Page ───────────────────────────────────────────────────────────────
type SuperView = "dashboard" | "cluster" | "day";

function FinancePage() {
  const s = useStore();
  const { user } = useAuth();
  const isSuper = isSuperAdmin(user?.role);
  const isCluster = isClusterAdmin(user?.role);
  const myClusterId = user?.clusterId ?? "";

  // ── Finance Settings state (Super Admin) ─────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const savedSettings = s.financeSettingsDb?.[0] ?? null;
  const [fsForm, setFsForm] = useState({
    financerName: savedSettings?.financerName ?? "TQI Finance Team",
    financeEmail: savedSettings?.financeEmail ?? "",
    approverName: savedSettings?.approverName ?? "",
    approverDesignation: savedSettings?.approverDesignation ?? "",
    organizationName: savedSettings?.organizationName ?? "Talent Quest for India",
    pdfFooter: savedSettings?.pdfFooter ?? "Talent Quest for India — Official Finance Document",
    signatureName: savedSettings?.signatureName ?? "",
    signatureDesignation: savedSettings?.signatureDesignation ?? "",
  });

  const handleSaveSettings = async () => {
    const rec = { id: savedSettings?.id ?? newId(), ...fsForm, updatedAt: new Date().toISOString() };
    await s.upsert("financeSettingsDb" as any, rec as any);
    toast.success("Finance settings saved");
  };

  // ── Super Admin navigation state ─────────────────────────────────────────
  const [saView, setSaView] = useState<SuperView>("dashboard");
  const [saClusterId, setSaClusterId] = useState<string | null>(null);
  const [saExpenseId, setSaExpenseId] = useState<string | null>(null);

  const goToCluster = (cid: string) => { setSaClusterId(cid); setSaView("cluster"); };
  const goToDay = (eid: string) => { setSaExpenseId(eid); setSaView("day"); };
  const backToDashboard = () => { setSaView("dashboard"); setSaClusterId(null); setSaExpenseId(null); };
  const backToCluster = () => { setSaView("cluster"); setSaExpenseId(null); };

  // ── Cluster Admin form state ──────────────────────────────────────────────
  const [form, setForm] = useState<FinanceForm>(blankForm());
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"travel"|"food"|"stationery"|"other">("travel");

  // Auto-fill header from store
  useEffect(() => {
    const cluster = s.clusters.find(c => c.id === myClusterId);
    const admin   = s.admins.find(a => a.id === user?.id);
    const college = s.colleges.find(c => (c as any).clusterId === myClusterId);
    const settings = s.financeSettingsDb?.[0];
    setForm(prev => ({
      ...prev,
      clusterName:  cluster?.name ?? "",
      collegeName:  college?.name ?? (admin as any)?.college ?? "",
      spocName:     admin?.name ?? user?.name ?? "",
      financerName: settings?.financerName ?? s.financeSettings?.[0]?.defaultFinancerName ?? "TQI Finance Team",
    }));
  }, [s.clusters, s.admins, s.colleges, s.financeSettingsDb, s.financeSettings, myClusterId, user]);

  // Totals
  const totals = useMemo(() => calcTotals(form), [form]);

  // Advance for cluster
  const clusterAdvance = useMemo(() => {
    const advs = s.advances.filter(a => a.clusterId === myClusterId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return advs[0]?.amount ?? 0;
  }, [s.advances, myClusterId]);

  const balance = clusterAdvance - totals.grand;

  // My submitted expenses
  const myExpenses = useMemo(() =>
    isCluster ? s.expenses.filter(e => e.clusterId === myClusterId) : s.expenses,
    [s.expenses, isCluster, myClusterId]);

  // Volunteers for PDF
  const myVolunteers = useMemo(() =>
    s.volunteers.filter(v => v.clusterId === myClusterId),
    [s.volunteers, myClusterId]);

  const openCreate = () => {
    setEditId(null);
    setForm(prev => ({ ...blankForm(), clusterName: prev.clusterName, collegeName: prev.collegeName, spocName: prev.spocName, financerName: prev.financerName }));
    setActiveTab("travel");
    setFormOpen(true);
  };

  const openEdit = (exp: Expense) => {
    if (exp.status !== "Pending") return;
    setEditId(exp.id);
    setForm({
      clusterName: exp.clusterName ?? "",
      collegeName: exp.collegeName ?? "",
      sessionName: exp.sessionName ?? exp.description ?? "",
      sessionDay: exp.sessionDay ?? 1,
      date: exp.date,
      spocName: exp.spocName ?? exp.submittedBy ?? "",
      financerName: exp.financerName ?? "",
      volunteersCount: exp.volunteerCount ?? 0,
      travelEntries: (exp.travelEntries as TravelEntry[]) ?? [],
      foodEntries: (exp.foodEntries as FoodEntry[]) ?? FOOD_CATEGORIES.map(c => ({ id: newId(), category: c, count: 0, amount: 0, bills: [] })),
      stationeryEntries: (exp as any).stationeryEntries ?? [],
      stationeryBills: exp.stationeryBills ?? [],
      otherEntries: (exp.otherEntries as OtherEntry[]) ?? [],
    });
    setActiveTab("travel");
    setFormOpen(true);
  };

  const handleSave = async (status: "Pending" | "Submitted") => {
    if (!form.date) return toast.error("Date is required");
    const t = calcTotals(form);
    const advAmt = s.advances.filter(a => a.clusterId === myClusterId).sort((a,b) => new Date(b.date).getTime()-new Date(a.date).getTime())[0]?.amount ?? 0;
    const bal = advAmt - t.grand;
    const allBills = [
      ...form.travelEntries.flatMap(e => e.bills),
      ...form.foodEntries.flatMap(e => e.bills),
      ...form.stationeryBills,
      ...form.otherEntries.flatMap(e => e.bills),
    ];
    const payload: any = {
      id: editId || newId(),
      sessionDay: form.sessionDay,
      sessionName: form.sessionName,
      date: form.date,
      clusterId: myClusterId,
      clusterName: form.clusterName,
      collegeName: form.collegeName,
      financerName: form.financerName,
      spocName: form.spocName,
      submittedBy: form.spocName,
      volunteerCount: form.volunteersCount,
      category: "Travel",
      amount: t.grand,
      grandTotal: t.grand,
      balance: bal,
      description: form.sessionName,
      status,
      bills: allBills,
      travelEntries: form.travelEntries,
      foodEntries: form.foodEntries,
      stationeryEntries: form.stationeryEntries,
      stationeryAmount: form.stationeryEntries.reduce((s, e) => s + e.quantity * e.amount, 0),
      stationeryBills: form.stationeryBills,
      otherEntries: form.otherEntries,
    };
    await s.upsert("expenses", payload);
    toast.success(status === "Submitted" ? "Finance submitted — visible to Super Admin" : "Draft saved");
    setFormOpen(false);
    setEditId(null);
  };

  // ── Super Admin Dashboard ─────────────────────────────────────────────────
  if (isSuper && saView === "dashboard") {
    const allAdvTotal = s.advances.reduce((sum, a) => sum + (a.amount || 0), 0);
    const allExpTotal = s.expenses.filter(e => e.status === "Submitted" || e.status === "Approved").reduce((sum, e) => sum + (e.grandTotal || e.amount || 0), 0);
    const clusterCards = s.clusters.map(c => {
      const advs = s.advances.filter(a => a.clusterId === c.id).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
      const adv = advs[0]?.amount ?? 0;
      const exps = s.expenses.filter(e => e.clusterId === c.id && (e.status==="Submitted"||e.status==="Approved"));
      const submitted = exps.reduce((s,e)=>s+(e.grandTotal||e.amount||0),0);
      const lastExp = exps.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime())[0];
      return { cluster: c, adv, submitted, balance: adv-submitted, sessions: exps.length, lastDate: lastExp?.date ?? null };
    });
    return (
      <AppShell>
        <div className="px-4 sm:px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div><h2 className="text-xl font-bold">Finance Dashboard</h2><p className="text-sm text-muted-foreground">All Clusters — Super Admin View</p></div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setShowSettings(v => !v)}><Settings className="h-4 w-4 mr-1" />Finance Settings</Button>
              <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export Excel</Button>
            </div>
          </div>
          {/* Finance Settings Panel */}
          {showSettings && (
            <div className="mb-6 rounded-xl border bg-white shadow-sm p-5">
              <h3 className="font-semibold text-base mb-4 flex items-center gap-2"><Settings className="h-4 w-4" /> Finance Settings</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Name of Financer", key: "financerName" },
                  { label: "Finance Team Email", key: "financeEmail" },
                  { label: "Approver Name", key: "approverName" },
                  { label: "Approver Designation", key: "approverDesignation" },
                  { label: "Organization Name", key: "organizationName" },
                  { label: "Signature Name", key: "signatureName" },
                  { label: "Signature Designation", key: "signatureDesignation" },
                ].map(f => (
                  <div key={f.key}>
                    <Label className="text-xs font-semibold">{f.label}</Label>
                    <Input className="mt-1" value={(fsForm as any)[f.key]} onChange={e => setFsForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div className="sm:col-span-2 lg:col-span-4">
                  <Label className="text-xs font-semibold">PDF Footer</Label>
                  <Input className="mt-1" value={fsForm.pdfFooter} onChange={e => setFsForm(p => ({ ...p, pdfFooter: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleSaveSettings}><Save className="h-4 w-4 mr-1" />{savedSettings ? "Update" : "Save"}</Button>
                <Button variant="outline" onClick={() => setFsForm({ financerName:"TQI Finance Team",financeEmail:"",approverName:"",approverDesignation:"",organizationName:"Talent Quest for India",pdfFooter:"Talent Quest for India — Official Finance Document",signatureName:"",signatureDesignation:"" })}>Reset</Button>
              </div>
            </div>
          )}
          {/* Global KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {[
              { label: "Total Advance Released", value: inr(allAdvTotal), color: "text-blue-700" },
              { label: "Total Expenses Submitted", value: inr(allExpTotal), color: "text-slate-800" },
              { label: "Total Balance", value: inr(allAdvTotal - allExpTotal), color: allAdvTotal-allExpTotal < 0 ? "text-red-600" : "text-green-600" },
            ].map(c => (
              <div key={c.label} className="rounded-xl bg-white border shadow-sm p-4">
                <p className="text-xs text-slate-500">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>
          {/* Cluster Cards */}
          <div className="space-y-3">
            {clusterCards.map(({ cluster, adv, submitted, balance: bal, sessions, lastDate }) => (
              <button key={cluster.id} onClick={() => goToCluster(cluster.id)}
                className="w-full rounded-xl border bg-white shadow-sm px-4 py-4 flex items-center justify-between hover:bg-blue-50 hover:border-blue-200 transition-colors group text-left">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-base font-bold shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    {cluster.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-base text-slate-800 uppercase">{cluster.name}</div>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-0.5">
                      <span>Advance: <strong className="text-blue-700">{inr(adv)}</strong></span>
                      <span>Submitted: <strong className="text-slate-700">{inr(submitted)}</strong></span>
                      <span>Balance: <strong className={bal < 0 ? "text-red-600" : "text-green-600"}>{inr(bal)}</strong></span>
                      <span>Sessions: <strong className="text-slate-700">{sessions}/8</strong></span>
                      {lastDate && <span>Last: <strong className="text-slate-700">{fmtDate(lastDate)}</strong></span>}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Super Admin: Cluster Finance Dashboard ────────────────────────────────
  if (isSuper && saView === "cluster" && saClusterId) {
    const cluster = s.clusters.find(c => c.id === saClusterId);
    const clusterExps = s.expenses.filter(e => e.clusterId === saClusterId && (e.status==="Submitted"||e.status==="Approved")).sort((a,b)=>a.sessionDay-b.sessionDay);
    const advs = s.advances.filter(a => a.clusterId === saClusterId).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
    const totalAdv = advs[0]?.amount ?? 0;
    const totalExp = clusterExps.reduce((s,e)=>s+(e.grandTotal||e.amount||0),0);
    return (
      <AppShell>
        <div className="px-4 sm:px-6 py-6">
          <nav className="flex items-center gap-1.5 text-sm mb-4">
            <button onClick={backToDashboard} className="text-blue-600 hover:underline font-medium">Finance</button>
            <span className="text-slate-400">/</span>
            <span className="text-slate-600 font-semibold">{cluster?.name}</span>
          </nav>
          <button onClick={backToDashboard} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mb-4 font-medium">
            <ChevronLeft className="h-4 w-4" /> Back to All Clusters
          </button>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div><h2 className="text-xl font-bold">{cluster?.name} — Finance</h2><p className="text-sm text-muted-foreground">{clusterExps.length} submission(s)</p></div>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export Excel</Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl bg-white border shadow-sm p-3"><p className="text-xs text-slate-500">Advance Released</p><p className="text-2xl font-bold text-blue-700">{inr(totalAdv)}</p></div>
            <div className="rounded-xl bg-white border shadow-sm p-3"><p className="text-xs text-slate-500">Total Submitted</p><p className="text-2xl font-bold text-slate-800">{inr(totalExp)}</p></div>
            <div className="rounded-xl bg-white border shadow-sm p-3"><p className="text-xs text-slate-500">Balance</p><p className={`text-2xl font-bold ${totalAdv-totalExp<0?"text-red-600":"text-green-600"}`}>{inr(totalAdv-totalExp)}</p></div>
          </div>
          {clusterExps.length === 0 && <div className="text-center py-12 text-slate-400">No finance submissions for this cluster yet.</div>}
          <div className="space-y-3">
            {clusterExps.map(exp => {
              const t = { travel: (exp.travelEntries as any[])?.reduce((s:number,e:any)=>s+e.volunteers*e.amountPerPerson,0)??0, food: (exp.foodEntries as any[])?.reduce((s:number,e:any)=>s+e.count*e.amount,0)??0, st: (exp.stationeryEntries as any[])?.reduce((s:number,e:any)=>s+e.quantity*e.amount,0)??0, other: (exp.otherEntries as any[])?.reduce((s:number,e:any)=>s+e.amount,0)??0 };
              return (
                <button key={exp.id} onClick={() => goToDay(exp.id)}
                  className="w-full rounded-xl border bg-white shadow-sm px-4 py-3 flex items-center justify-between hover:bg-blue-50 hover:border-blue-200 transition-colors group text-left">
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-colors">{exp.sessionDay}</span>
                    <div>
                      <div className="font-semibold text-slate-800">{exp.sessionName || `Day ${exp.sessionDay}`} · <span className="text-sm font-normal text-slate-500">{fmtDate(exp.date)}</span></div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-2 mt-0.5">
                        {t.travel>0&&<span>Travel: <strong>{inr(t.travel)}</strong></span>}
                        {t.food>0&&<span>Food: <strong>{inr(t.food)}</strong></span>}
                        {t.st>0&&<span>Stationery: <strong>{inr(t.st)}</strong></span>}
                        {t.other>0&&<span>Other: <strong>{inr(t.other)}</strong></span>}
                        <span>Total: <strong className="text-blue-700">{inr(exp.grandTotal||exp.amount||0)}</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${exp.status==="Submitted"?"bg-blue-100 text-blue-700":exp.status==="Approved"?"bg-green-100 text-green-700":exp.status==="Rejected"?"bg-red-100 text-red-600":"bg-yellow-100 text-yellow-700"}`}>{exp.status}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Super Admin: Finance Audit View ──────────────────────────────────────
  if (isSuper && saView === "day" && saExpenseId) {
    const exp = s.expenses.find(e => e.id === saExpenseId);
    if (!exp) return <AppShell><div className="p-8 text-center text-muted-foreground">Expense not found.</div></AppShell>;
    const cluster = s.clusters.find(c => c.id === exp.clusterId);
    const tEntries = (exp.travelEntries as TravelEntry[]) ?? [];
    const fEntries = (exp.foodEntries as FoodEntry[]) ?? [];
    const stEntries = (exp as any).stationeryEntries as StationeryEntry[] ?? [];
    const oEntries = (exp.otherEntries as OtherEntry[]) ?? [];
    const tTotal = tEntries.reduce((s,e)=>s+e.volunteers*e.amountPerPerson,0);
    const fTotal = fEntries.reduce((s,e)=>s+e.count*e.amount,0);
    const stTotal = stEntries.reduce((s,e)=>s+e.quantity*e.amount,0);
    const oTotal = oEntries.reduce((s,e)=>s+e.amount,0);
    const grand = tTotal+fTotal+stTotal+oTotal;
    const advs = s.advances.filter(a=>a.clusterId===exp.clusterId).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
    const adv = advs[0]?.amount ?? 0;
    const bal = adv - grand;
    const clusterVols = s.volunteers.filter(v=>v.clusterId===exp.clusterId);
    const formData: FinanceForm = { clusterName: exp.clusterName??"", collegeName: exp.collegeName??"", sessionName: exp.sessionName??exp.description??"", sessionDay: exp.sessionDay??1, date: exp.date, spocName: exp.spocName??exp.submittedBy??"", financerName: exp.financerName??"", volunteersCount: exp.volunteerCount??0, travelEntries: tEntries, foodEntries: fEntries, stationeryEntries: stEntries, stationeryBills: exp.stationeryBills??[], otherEntries: oEntries };

    const handleStatusChange = async (status: string) => {
      await s.patch("expenses", exp.id, { status } as any);
      toast.success(`Finance ${status}`);
    };

    return (
      <AppShell>
        <div className="px-4 sm:px-6 py-6">
          <nav className="flex items-center gap-1.5 text-sm mb-4 flex-wrap">
            <button onClick={backToDashboard} className="text-blue-600 hover:underline font-medium">Finance</button>
            <span className="text-slate-400">/</span>
            <button onClick={backToCluster} className="text-blue-600 hover:underline font-medium">{cluster?.name}</button>
            <span className="text-slate-400">/</span>
            <span className="text-slate-600 font-semibold">Day {exp.sessionDay}</span>
          </nav>
          <button onClick={backToCluster} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mb-4 font-medium">
            <ChevronLeft className="h-4 w-4" /> Back to {cluster?.name}
          </button>
          {/* Header Info */}
          <div className="rounded-xl bg-white border shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-lg font-bold">{exp.sessionName || `Day ${exp.sessionDay}`} — Finance Audit</h2>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => printFinancePdf(formData, clusterVols, savedSettings, adv, bal)}><Download className="h-4 w-4 mr-1" />Export PDF</Button>
                <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export Excel</Button>
                {exp.status==="Submitted" && <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={()=>handleStatusChange("Approved")}><CheckCircle className="h-4 w-4 mr-1"/>Approve</Button>}
                {exp.status==="Submitted" && <Button size="sm" variant="destructive" onClick={()=>handleStatusChange("Rejected")}><XCircle className="h-4 w-4 mr-1"/>Reject</Button>}
                {(exp.status==="Submitted"||exp.status==="Approved") && <Button size="sm" variant="outline" onClick={()=>handleStatusChange("Locked")}><Lock className="h-4 w-4 mr-1"/>Lock</Button>}
                {exp.status==="Locked" && <Button size="sm" variant="outline" onClick={()=>handleStatusChange("Submitted")}><Unlock className="h-4 w-4 mr-1"/>Unlock</Button>}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[["College",exp.collegeName],["Cluster",exp.clusterName],["Session",exp.sessionName||`Day ${exp.sessionDay}`],["Day",`Day ${exp.sessionDay}`],["Date",fmtDate(exp.date)],["Volunteers",String(exp.volunteerCount??0)],["SPOC",exp.spocName||exp.submittedBy],["Financer",exp.financerName]].map(([l,v])=>(
                <div key={l}><p className="text-slate-400">{l}</p><p className="font-medium text-slate-800">{v||"—"}</p></div>
              ))}
              <div><p className="text-slate-400">Advance Released</p><p className="font-bold text-blue-700">{inr(adv)}</p></div>
              <div><p className="text-slate-400">Balance</p><p className={`font-bold ${bal<0?"text-red-600":"text-green-600"}`}>{inr(bal)}</p></div>
            </div>
          </div>
          {/* Expense Table */}
          <div className="rounded-xl bg-white border shadow-sm overflow-hidden mb-4">
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 border-b text-slate-500">{["S.No","Category","Description","Volunteers","Count×Amount","Total","Bills","Remarks"].map(h=><th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {tEntries.map((e,i)=><tr key={e.id} className="border-b hover:bg-slate-50"><td className="px-3 py-2">{i+1}</td><td className="px-3 py-2">Travel</td><td className="px-3 py-2 font-medium">{e.from} → {e.to}</td><td className="px-3 py-2 text-center">{e.volunteers}</td><td className="px-3 py-2">{e.volunteers}×₹{e.amountPerPerson}</td><td className="px-3 py-2 font-semibold text-right">{inr(e.volunteers*e.amountPerPerson)}</td><td className="px-3 py-2">{e.bills.map(b=>b.url?<img key={b.id} src={b.url} alt="" className="h-8 w-8 object-contain rounded border inline-block mr-1"/>:null)}</td><td className="px-3 py-2 text-slate-500">{e.remarks||"—"}</td></tr>)}
                {fEntries.filter(e=>e.count>0&&e.amount>0).map((e,i)=><tr key={e.id} className="border-b hover:bg-slate-50"><td className="px-3 py-2">{tEntries.length+i+1}</td><td className="px-3 py-2">Food</td><td className="px-3 py-2 font-medium">{e.category}</td><td className="px-3 py-2 text-center">{e.count}</td><td className="px-3 py-2">{e.count}×₹{e.amount}</td><td className="px-3 py-2 font-semibold text-right">{inr(e.count*e.amount)}</td><td className="px-3 py-2">{e.bills.map(b=>b.url?<img key={b.id} src={b.url} alt="" className="h-8 w-8 object-contain rounded border inline-block mr-1"/>:null)}</td><td className="px-3 py-2">—</td></tr>)}
                {stEntries.filter(e=>e.quantity>0&&e.amount>0).map((e,i)=><tr key={e.id} className="border-b hover:bg-slate-50"><td className="px-3 py-2">{tEntries.length+fEntries.filter(f=>f.count>0).length+i+1}</td><td className="px-3 py-2">Stationery</td><td className="px-3 py-2 font-medium">{e.itemName}</td><td className="px-3 py-2 text-center">{e.quantity}</td><td className="px-3 py-2">{e.quantity}×₹{e.amount}</td><td className="px-3 py-2 font-semibold text-right">{inr(e.quantity*e.amount)}</td><td className="px-3 py-2">—</td><td className="px-3 py-2">—</td></tr>)}
                {oEntries.filter(e=>e.amount>0).map((e,i)=><tr key={e.id} className="border-b hover:bg-slate-50"><td className="px-3 py-2">{tEntries.length+fEntries.filter(f=>f.count>0).length+stEntries.filter(s=>s.quantity>0).length+i+1}</td><td className="px-3 py-2">Other</td><td className="px-3 py-2 font-medium">{e.description||"Misc"}</td><td className="px-3 py-2 text-center">—</td><td className="px-3 py-2">—</td><td className="px-3 py-2 font-semibold text-right">{inr(e.amount)}</td><td className="px-3 py-2">{e.bills.map(b=>b.url?<img key={b.id} src={b.url} alt="" className="h-8 w-8 object-contain rounded border inline-block mr-1"/>:null)}</td><td className="px-3 py-2 text-slate-500">{e.remarks||"—"}</td></tr>)}
              </tbody>
              <tfoot>
                {tTotal>0&&<tr className="bg-slate-50 font-semibold border-t"><td colSpan={4} className="px-3 py-1.5"/><td className="px-3 py-1.5 text-right text-slate-600">Travel Total</td><td className="px-3 py-1.5 text-right">{inr(tTotal)}</td><td colSpan={2}/></tr>}
                {fTotal>0&&<tr className="bg-slate-50 font-semibold border-t"><td colSpan={4}/><td className="px-3 py-1.5 text-right text-slate-600">Food Total</td><td className="px-3 py-1.5 text-right">{inr(fTotal)}</td><td colSpan={2}/></tr>}
                {stTotal>0&&<tr className="bg-slate-50 font-semibold border-t"><td colSpan={4}/><td className="px-3 py-1.5 text-right text-slate-600">Stationery Total</td><td className="px-3 py-1.5 text-right">{inr(stTotal)}</td><td colSpan={2}/></tr>}
                {oTotal>0&&<tr className="bg-slate-50 font-semibold border-t"><td colSpan={4}/><td className="px-3 py-1.5 text-right text-slate-600">Other Total</td><td className="px-3 py-1.5 text-right">{inr(oTotal)}</td><td colSpan={2}/></tr>}
                <tr className="bg-blue-50 border-t font-bold text-blue-700"><td colSpan={4}/><td className="px-3 py-2 text-right text-sm">Grand Total</td><td className="px-3 py-2 text-right text-sm">{inr(grand)}</td><td colSpan={2}/></tr>
                <tr className="bg-green-50 border-t font-bold text-green-700"><td colSpan={4}/><td className="px-3 py-2 text-right text-sm">Advance Released</td><td className="px-3 py-2 text-right text-sm">{inr(adv)}</td><td colSpan={2}/></tr>
                <tr className={`border-t font-bold ${bal<0?"bg-red-50 text-red-600":"bg-emerald-50 text-emerald-700"}`}><td colSpan={4}/><td className="px-3 py-2 text-right text-sm">Balance</td><td className="px-3 py-2 text-right text-sm">{inr(bal)}</td><td colSpan={2}/></tr>
              </tfoot>
            </table>
          </div>
          {/* Volunteer List */}
          {clusterVols.length>0&&(
            <div className="rounded-xl bg-white border shadow-sm overflow-hidden mb-4">
              <div className="px-4 py-2 bg-slate-50 border-b text-sm font-semibold text-slate-600">Volunteer List</div>
              <table className="w-full text-xs"><thead><tr className="border-b text-slate-400 bg-slate-50/50">{["S.No","Volunteer Name","College","Year"].map(h=><th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
              <tbody>{clusterVols.map((v,i)=><tr key={v.id} className="border-b hover:bg-slate-50"><td className="px-3 py-2 text-slate-400">{i+1}</td><td className="px-3 py-2 font-medium">{v.name}</td><td className="px-3 py-2 text-slate-500">{v.college||"—"}</td><td className="px-3 py-2 text-slate-500">{v.year?`${v.year}${["1","2","3"].includes(v.year)?"st/nd/rd":"th"} Year`:"—"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  // ── Cluster Admin — not allowed ───────────────────────────────────────────
  if (!isCluster && !isSuper) {
    return <AppShell><div className="p-8 text-center text-muted-foreground">Access restricted to Cluster Admin and Super Admin.</div></AppShell>;
  }

  // ── Cluster Admin Main View ───────────────────────────────────────────────
  const clusterAdv = s.advances.filter(a=>a.clusterId===myClusterId).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime())[0];

  return (
    <AppShell>
      <div className="px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div><h2 className="text-xl font-bold">Finance</h2><p className="text-sm text-muted-foreground">Track session-wise expenses for your cluster</p></div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2"/>New Finance Entry</Button>
        </div>

        {/* Advance Info */}
        {clusterAdv && (
          <div className="mb-5 rounded-xl bg-blue-50 border border-blue-200 p-4 flex items-center justify-between flex-wrap gap-3">
            <div><p className="text-xs text-blue-600 font-semibold">Advance Released</p><p className="text-2xl font-bold text-blue-700">{inr(clusterAdv.amount)}</p><p className="text-xs text-blue-500 mt-0.5">Released on {fmtDate(clusterAdv.date)} by {clusterAdv.releasedBy||"Super Admin"}</p></div>
            <div className="text-right"><p className="text-xs text-slate-500">Submitted so far</p><p className="text-xl font-bold text-slate-800">{inr(myExpenses.filter(e=>e.status!=="Pending").reduce((s,e)=>s+(e.grandTotal||e.amount||0),0))}</p></div>
          </div>
        )}

        {/* Expense Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-xs text-slate-500">
              <tr>{["Session","Date","Grand Total","Advance","Balance","Status","Actions"].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {myExpenses.length===0&&<tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">No finance entries yet. Click "New Finance Entry" to start.</td></tr>}
              {myExpenses.map(exp=>{
                const adv = s.advances.filter(a=>a.clusterId===exp.clusterId).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime())[0]?.amount??0;
                const bal = adv-(exp.grandTotal||exp.amount||0);
                return(
                  <tr key={exp.id} className="border-t hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2">Day {exp.sessionDay}{exp.sessionName?` — ${exp.sessionName}`:""}</td>
                    <td className="px-3 py-2">{fmtDate(exp.date)}</td>
                    <td className="px-3 py-2 font-semibold">{inr(exp.grandTotal||exp.amount||0)}</td>
                    <td className="px-3 py-2 text-blue-700 font-semibold">{inr(adv)}</td>
                    <td className={`px-3 py-2 font-semibold ${bal<0?"text-red-600":"text-green-600"}`}>{inr(bal)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${exp.status==="Submitted"?"bg-blue-100 text-blue-700":exp.status==="Approved"?"bg-green-100 text-green-700":exp.status==="Rejected"?"bg-red-100 text-red-600":exp.status==="Locked"?"bg-slate-200 text-slate-600":"bg-yellow-100 text-yellow-700"}`}>{exp.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {exp.status==="Pending"&&<Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={()=>openEdit(exp)}><Pencil className="h-3.5 w-3.5"/></Button>}
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Export PDF" onClick={() => {
                          const advAmt = s.advances.filter(a=>a.clusterId===exp.clusterId).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime())[0]?.amount??0;
                          const formData: FinanceForm = {
                            clusterName: exp.clusterName??"", collegeName: exp.collegeName??"",
                            sessionName: exp.sessionName??exp.description??"", sessionDay: exp.sessionDay??1,
                            date: exp.date, spocName: exp.spocName??exp.submittedBy??"",
                            financerName: exp.financerName??"", volunteersCount: exp.volunteerCount??0,
                            travelEntries: (exp.travelEntries as TravelEntry[])??[],
                            foodEntries: (exp.foodEntries as FoodEntry[])??FOOD_CATEGORIES.map(c=>({id:newId(),category:c,count:0,amount:0,bills:[]})),
                            stationeryEntries: (exp.stationeryEntries as StationeryEntry[])??[],
                            stationeryBills: exp.stationeryBills??[],
                            otherEntries: (exp.otherEntries as OtherEntry[])??[],
                          };
                          const vols = s.volunteers.filter(v=>v.clusterId===myClusterId);
                          const settings = s.financeSettingsDb?.[0]??null;
                          const bal = advAmt - (exp.grandTotal||exp.amount||0);
                          printFinancePdf(formData, vols, settings, advAmt, bal);
                        }}><Download className="h-3.5 w-3.5"/></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId?"Edit":"New"} Finance Entry — {form.clusterName}</DialogTitle>
          </DialogHeader>

          {/* Auto-fill info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-slate-50 p-3 text-xs">
            {[["Cluster",form.clusterName],["College",form.collegeName],["SPOC",form.spocName],["Financer",form.financerName]].map(([l,v])=>(
              <div key={l}><div className="text-slate-400 uppercase text-[10px]">{l}</div><div className="font-semibold">{v||"—"}</div></div>
            ))}
          </div>

          {/* Session / Date / Volunteers */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Session Day *</Label>
              <Select value={String(form.sessionDay)} onValueChange={v=>{
                const sess=s.sessions.find(ss=>ss.day===+v&&ss.clusterId===myClusterId);
                setForm(p=>({...p,sessionDay:+v,sessionName:sess?.title??"",date:sess?.date??p.date}));
              }}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7,8].map(d=>{
                    const sess=s.sessions.find(ss=>ss.day===d&&ss.clusterId===myClusterId);
                    return <SelectItem key={d} value={String(d)}>Day {d}{sess?` — ${sess.title}`:""}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Date *</Label><Input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
            <div><Label className="text-xs">No. of Volunteers</Label><Input type="number" min="0" value={form.volunteersCount||""} placeholder="0" onChange={e=>setForm(p=>({...p,volunteersCount:+e.target.value||0}))}/></div>
          </div>

          {/* Expense Tabs */}
          <div className="flex gap-1 border-b">
            {(["travel","food","stationery","other"] as const).map(tab=>(
              <button key={tab} onClick={()=>setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${activeTab===tab?"border-blue-600 text-blue-700":"border-transparent text-slate-500 hover:text-slate-700"}`}>{tab}</button>
            ))}
          </div>

          {/* Travel */}
          {activeTab==="travel"&&(
            <div className="space-y-3">
              <div className="flex justify-between items-center"><span className="font-semibold flex items-center gap-1.5"><Plane className="h-4 w-4"/>Travel</span>
                <Button size="sm" variant="outline" onClick={()=>setForm(p=>({...p,travelEntries:[...p.travelEntries,{id:newId(),from:"",to:"",volunteers:0,amountPerPerson:0,remarks:"",bills:[]}]}))}><Plus className="h-3.5 w-3.5 mr-1"/>Add Route</Button>
              </div>
              {form.travelEntries.map((e,i)=>(
                <Card key={e.id} className="shadow-sm"><CardContent className="pt-4 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-5">
                    <div><Label className="text-xs">From</Label><Input value={e.from} placeholder="e.g. KSR" onChange={ev=>setForm(p=>({...p,travelEntries:p.travelEntries.map((t,j)=>j===i?{...t,from:ev.target.value}:t)}))}/></div>
                    <div><Label className="text-xs">To</Label><Input value={e.to} placeholder="e.g. Salem" onChange={ev=>setForm(p=>({...p,travelEntries:p.travelEntries.map((t,j)=>j===i?{...t,to:ev.target.value}:t)}))}/></div>
                    <div><Label className="text-xs">Volunteers</Label><Input type="number" min="0" value={e.volunteers||""} placeholder="0" onChange={ev=>setForm(p=>({...p,travelEntries:p.travelEntries.map((t,j)=>j===i?{...t,volunteers:+ev.target.value||0}:t)}))}/></div>
                    <div><Label className="text-xs">Per Person (₹)</Label><Input type="number" min="0" value={e.amountPerPerson||""} placeholder="0" onChange={ev=>setForm(p=>({...p,travelEntries:p.travelEntries.map((t,j)=>j===i?{...t,amountPerPerson:+ev.target.value||0}:t)}))}/></div>
                    <div><Label className="text-xs">Total</Label><div className="h-9 flex items-center px-3 bg-blue-50 rounded-md text-sm font-bold text-blue-700">{inr(e.volunteers*e.amountPerPerson)}</div></div>
                  </div>
                  <div><Label className="text-xs">Remarks</Label><Input value={e.remarks} placeholder="Optional" onChange={ev=>setForm(p=>({...p,travelEntries:p.travelEntries.map((t,j)=>j===i?{...t,remarks:ev.target.value}:t)}))}/></div>
                  <BillManager bills={e.bills} onChange={bills=>setForm(p=>({...p,travelEntries:p.travelEntries.map((t,j)=>j===i?{...t,bills}:t)}))} />
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={()=>setForm(p=>({...p,travelEntries:p.travelEntries.filter((_,j)=>j!==i)}))}><Trash2 className="h-3.5 w-3.5 mr-1"/>Remove</Button>
                </CardContent></Card>
              ))}
              {form.travelEntries.length===0&&<p className="text-sm text-slate-400 text-center py-4">No travel entries. Click "Add Route" to start.</p>}
            </div>
          )}

          {/* Food */}
          {activeTab==="food"&&(
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-1.5"><Utensils className="h-4 w-4"/>Food</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {FOOD_CATEGORIES.map(cat=>{
                  const entry=form.foodEntries.find(f=>f.category===cat)?? { id: newId(), category: cat, count:0, amount:0, bills:[] };
                  const update=(field:string,val:any)=>setForm(p=>({...p,foodEntries:p.foodEntries.some(f=>f.category===cat)?p.foodEntries.map(f=>f.category===cat?{...f,[field]:val}:f):[...p.foodEntries,{...entry,[field]:val}]}));
                  return(
                    <Card key={cat} className="shadow-sm"><CardHeader className="py-2 px-4"><CardTitle className="text-sm">{cat}</CardTitle></CardHeader>
                      <CardContent className="pb-4 px-4 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label className="text-xs">Count</Label><Input type="number" min="0" value={entry.count||""} placeholder="0" onChange={e=>update("count",+e.target.value||0)}/></div>
                          <div><Label className="text-xs">Amount/Person (₹)</Label><Input type="number" min="0" value={entry.amount||""} placeholder="0" onChange={e=>update("amount",+e.target.value||0)}/></div>
                        </div>
                        {entry.count>0&&entry.amount>0&&<div className="text-sm font-bold text-blue-700">{entry.count} × ₹{entry.amount} = {inr(entry.count*entry.amount)}</div>}
                        <BillManager bills={entry.bills??[]} onChange={bills=>update("bills",bills)}/>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stationery */}
          {activeTab==="stationery"&&(
            <div className="space-y-3">
              <div className="flex justify-between items-center"><span className="font-semibold flex items-center gap-1.5"><PenLine className="h-4 w-4"/>Stationery</span>
                <Button size="sm" variant="outline" onClick={()=>setForm(p=>({...p,stationeryEntries:[...p.stationeryEntries,{id:newId(),itemName:"",quantity:0,amount:0}]}))}><Plus className="h-3.5 w-3.5 mr-1"/>Add Item</Button>
              </div>
              {form.stationeryEntries.map((e,i)=>(
                <div key={e.id} className="grid gap-2 sm:grid-cols-4 items-end rounded-lg border p-3">
                  <div><Label className="text-xs">Item Name</Label><Input value={e.itemName} placeholder="e.g. Marker" onChange={ev=>setForm(p=>({...p,stationeryEntries:p.stationeryEntries.map((s,j)=>j===i?{...s,itemName:ev.target.value}:s)}))}/></div>
                  <div><Label className="text-xs">Quantity</Label><Input type="number" min="0" value={e.quantity||""} placeholder="0" onChange={ev=>setForm(p=>({...p,stationeryEntries:p.stationeryEntries.map((s,j)=>j===i?{...s,quantity:+ev.target.value||0}:s)}))}/></div>
                  <div><Label className="text-xs">Amount (₹)</Label><Input type="number" min="0" value={e.amount||""} placeholder="0" onChange={ev=>setForm(p=>({...p,stationeryEntries:p.stationeryEntries.map((s,j)=>j===i?{...s,amount:+ev.target.value||0}:s)}))}/></div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-blue-700">{inr(e.quantity*e.amount)}</div>
                    <Button size="sm" variant="ghost" className="text-destructive p-1" onClick={()=>setForm(p=>({...p,stationeryEntries:p.stationeryEntries.filter((_,j)=>j!==i)}))}><Trash2 className="h-4 w-4"/></Button>
                  </div>
                </div>
              ))}
              {form.stationeryEntries.length===0&&<p className="text-sm text-slate-400 text-center py-4">No stationery items. Click "Add Item" to start.</p>}
              <div className="mt-2"><BillManager bills={form.stationeryBills} onChange={bills=>setForm(p=>({...p,stationeryBills:bills}))}/></div>
            </div>
          )}

          {/* Other */}
          {activeTab==="other"&&(
            <div className="space-y-3">
              <div className="flex justify-between items-center"><span className="font-semibold flex items-center gap-1.5"><Boxes className="h-4 w-4"/>Other</span>
                <Button size="sm" variant="outline" onClick={()=>setForm(p=>({...p,otherEntries:[...p.otherEntries,{id:newId(),description:"",amount:0,remarks:"",bills:[]}]}))}><Plus className="h-3.5 w-3.5 mr-1"/>Add Other</Button>
              </div>
              {form.otherEntries.map((e,i)=>(
                <Card key={e.id} className="shadow-sm"><CardContent className="pt-4 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div><Label className="text-xs">Description</Label><Input value={e.description} placeholder="e.g. Banner" onChange={ev=>setForm(p=>({...p,otherEntries:p.otherEntries.map((o,j)=>j===i?{...o,description:ev.target.value}:o)}))}/></div>
                    <div><Label className="text-xs">Amount (₹)</Label><Input type="number" min="0" value={e.amount||""} placeholder="0" onChange={ev=>setForm(p=>({...p,otherEntries:p.otherEntries.map((o,j)=>j===i?{...o,amount:+ev.target.value||0}:o)}))}/></div>
                  </div>
                  <div><Label className="text-xs">Remarks</Label><Input value={e.remarks} placeholder="Optional" onChange={ev=>setForm(p=>({...p,otherEntries:p.otherEntries.map((o,j)=>j===i?{...o,remarks:ev.target.value}:o)}))}/></div>
                  <BillManager bills={e.bills} onChange={bills=>setForm(p=>({...p,otherEntries:p.otherEntries.map((o,j)=>j===i?{...o,bills}:o)}))} />
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={()=>setForm(p=>({...p,otherEntries:p.otherEntries.filter((_,j)=>j!==i)}))}><Trash2 className="h-3.5 w-3.5 mr-1"/>Remove</Button>
                </CardContent></Card>
              ))}
              {form.otherEntries.length===0&&<p className="text-sm text-slate-400 text-center py-4">Optional. Add miscellaneous expenses here.</p>}
            </div>
          )}

          {/* Totals */}
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 space-y-1.5 text-sm">
            {totals.travel>0&&<div className="flex justify-between"><span>Travel Total</span><b>{inr(totals.travel)}</b></div>}
            {totals.food>0&&<div className="flex justify-between"><span>Food Total</span><b>{inr(totals.food)}</b></div>}
            {totals.st>0&&<div className="flex justify-between"><span>Stationery Total</span><b>{inr(totals.st)}</b></div>}
            {totals.other>0&&<div className="flex justify-between"><span>Other Total</span><b>{inr(totals.other)}</b></div>}
            <div className="flex justify-between border-t pt-2 font-bold text-base text-blue-700"><span>Grand Total</span><span>{inr(totals.grand)}</span></div>
            <div className="flex justify-between text-xs text-slate-500"><span>Advance Released</span><span>{inr(clusterAdvance)}</span></div>
            <div className={`flex justify-between font-semibold ${balance<0?"text-red-600":"text-green-600"}`}><span>Balance</span><span>{inr(balance)}</span></div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={()=>setFormOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={()=>handleSave("Pending")}><Save className="h-4 w-4 mr-1"/>Save Draft</Button>
            <Button onClick={()=>handleSave("Submitted")}><Send className="h-4 w-4 mr-1"/>Submit Finance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
