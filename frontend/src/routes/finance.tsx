import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { SmartShell as AppShell } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/layout/kpi-card";
import {
  Wallet, Plus, Save, Download, FileText,
  Plane, Utensils, PenLine, Fuel, Boxes, Camera,
  ChevronDown, Trash2, Eye, X,
} from "lucide-react";
import { useStore, newId, type Expense, type Bill, type FoodBill } from "@/lib/store";
import { useAuth, isSuperAdmin, isClusterAdmin } from "@/lib/auth";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance — TQI" }] }),
  component: FinancePage,
});

type ExpenseCategory = "Travel" | "Food" | "Stationery" | "Fuel" | "Other";
type FoodCategory = "Breakfast" | "Lunch" | "Dinner" | "Refreshments";

const FOOD_CATEGORIES: FoodCategory[] = ["Breakfast", "Lunch", "Dinner", "Refreshments"];

interface TravelEntry {
  id: string;
  from: string;
  to: string;
  volunteers: number;
  amountPerPerson: number;
  bills: Bill[];
}

interface FoodEntry {
  id: string;
  category: FoodCategory;
  amount: number;
  bills: Bill[];
}

interface FinanceFormState {
  // Header - auto-filled
  zone: string;
  team: string;
  clusterName: string;
  sessionName: string;
  sessionDay: number;
  date: string;
  spocName: string;
  financerName: string;

  // Manual entries
  volunteersCount: number;

  // Expenses
  travelEntries: TravelEntry[];
  foodEntries: FoodEntry[];
  stationeryAmount: number;
  stationeryBills: Bill[];
  fuelAmount: number;
  fuelBills: Bill[];
  otherAmount: number;
  otherBills: Bill[];
}

function blankForm(): FinanceFormState {
  return {
    zone: "", team: "", clusterName: "", sessionName: "", sessionDay: 1,
    date: new Date().toISOString().slice(0, 10), spocName: "", financerName: "",
    volunteersCount: 0,
    travelEntries: [], foodEntries: [], stationeryAmount: 0, stationeryBills: [],
    fuelAmount: 0, fuelBills: [], otherAmount: 0, otherBills: [],
  };
}

function FinancePage() {
  const s = useStore();
  const { user } = useAuth();
  const isSuper = isSuperAdmin(user?.role);
  const isCluster = isClusterAdmin(user?.role);
  const myClusterId = user?.clusterId ?? "";

  const [form, setForm] = useState<FinanceFormState>(blankForm());
  const [openForm, setOpenForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [billPreview, setBillPreview] = useState<Bill | null>(null);
  const [expandedTravel, setExpandedTravel] = useState<string | null>(null);
  const [expandedFood, setExpandedFood] = useState<string | null>(null);

  // Auto-fill header
  useEffect(() => {
    const cluster = s.clusters.find(c => c.id === myClusterId);
    const admin = s.admins.find(a => a.id === user?.id);
    setForm(prev => ({
      ...prev,
      zone: cluster?.state ?? "",
      team: cluster?.district ?? "",
      clusterName: cluster?.name ?? "",
      spocName: admin?.name ?? user?.name ?? "",
      financerName: s.financeSettings?.[0]?.defaultFinancerName ?? "TQI Finance Team",
    }));
  }, [s.clusters, s.admins, s.financeSettings, myClusterId, user?.id, user?.name]);

  // Session list
  const sessions = useMemo(() =>
    isCluster ? s.sessions.filter(ss => ss.clusterId === myClusterId) : s.sessions,
    [s.sessions, isCluster, myClusterId]
  );

  // Visible expenses
  const expenses = useMemo(() =>
    isCluster ? s.expenses.filter(e => e.clusterId === myClusterId) : s.expenses,
    [s.expenses, isCluster, myClusterId]
  );

  // Calculations
  const calculateTravelTotal = (entries: TravelEntry[]) =>
    entries.reduce((sum, e) => sum + (e.volunteers * e.amountPerPerson), 0);

  const calculateFoodTotal = (entries: FoodEntry[]) =>
    entries.reduce((sum, e) => sum + e.amount, 0);

  const totals = useMemo(() => {
    const travel = calculateTravelTotal(form.travelEntries);
    const food = calculateFoodTotal(form.foodEntries);
    const stationery = form.stationeryAmount || 0;
    const fuel = form.fuelAmount || 0;
    const other = form.otherAmount || 0;
    const grandTotal = travel + food + stationery + fuel + other;
    return { travel, food, stationery, fuel, other, grandTotal };
  }, [form.travelEntries, form.foodEntries, form.stationeryAmount, form.fuelAmount, form.otherAmount]);

  // Super Admin: view-only summary
  if (isSuper) {
    const allExpenses = s.expenses.reduce((sum, e) => sum + e.amount, 0);
    const byCluster = s.clusters.map(c => ({
      name: c.name,
      total: s.expenses.filter(e => e.clusterId === c.id).reduce((sum, e) => sum + e.amount, 0),
      count: s.expenses.filter(e => e.clusterId === c.id).length,
    }));

    return (
      <AppShell>
        <div className="px-6 py-6">
          <h1 className="text-2xl font-bold mb-4">Finance — Summary (Super Admin View Only)</h1>
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <KpiCard label="Total Finance" value={inr(allExpenses)} icon={Wallet} tone="primary" />
            <KpiCard label="Clusters Submitted" value={byCluster.filter(c => c.total > 0).length} icon={Plane} tone="success" />
            <KpiCard label="Total Entries" value={s.expenses.length} icon={FileText} tone="info" />
          </div>

          <div className="grid gap-4">
            {byCluster.map(cluster => (
              <Card key={cluster.name}>
                <CardHeader>
                  <CardTitle className="text-base">{cluster.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Expenses</span>
                    <span className="font-semibold">{inr(cluster.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Entries</span>
                    <span>{cluster.count}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  // Cluster Admin: Edit form
  if (!isCluster) {
    return (
      <AppShell>
        <div className="px-6 py-6 text-center text-muted-foreground">
          <p>Only Cluster Admin can manage finance entries.</p>
        </div>
      </AppShell>
    );
  }

  const handleAddTravelEntry = () => {
    setForm(prev => ({
      ...prev,
      travelEntries: [...prev.travelEntries, { id: newId(), from: "", to: "", volunteers: 0, amountPerPerson: 0, bills: [] }],
    }));
  };

  const handleRemoveTravelEntry = (id: string) => {
    setForm(prev => ({
      ...prev,
      travelEntries: prev.travelEntries.filter(e => e.id !== id),
    }));
  };

  const handleAddFoodEntry = (category: FoodCategory) => {
    setForm(prev => ({
      ...prev,
      foodEntries: [...prev.foodEntries, { id: newId(), category, amount: 0, bills: [] }],
    }));
  };

  const handleRemoveFoodEntry = (id: string) => {
    setForm(prev => ({
      ...prev,
      foodEntries: prev.foodEntries.filter(e => e.id !== id),
    }));
  };

  const handleSave = async () => {
    if (!form.sessionDay || !form.date) return toast.error("Session and date required");
    if (totals.grandTotal === 0) return toast.error("Add at least one expense");

    const expense: Expense = {
      id: editingExpenseId || newId(),
      sessionDay: form.sessionDay,
      date: form.date,
      clusterId: myClusterId,
      clusterName: form.clusterName,
      collegeName: "",
      financerName: form.financerName,
      submittedBy: form.spocName,
      category: "Travel", // aggregate
      amount: totals.grandTotal,
      status: "Pending",
      bills: [],
      volunteerCount: form.volunteersCount,
    };

    await s.upsert("expenses", expense);
    toast.success(editingExpenseId ? "Finance entry updated" : "Finance entry saved");
    setOpenForm(false);
    setEditingExpenseId(null);
    setForm(blankForm());
  };

  const handleExportPDF = () => {
    toast.success("PDF export coming soon");
  };

  return (
    <AppShell>
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Finance — Day {form.sessionDay}</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" /> Export PDF
            </Button>
            <Button size="sm" onClick={() => setOpenForm(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Entry
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-5 mb-6">
          <KpiCard label="Travel" value={inr(totals.travel)} icon={Plane} tone="primary" />
          <KpiCard label="Food" value={inr(totals.food)} icon={Utensils} tone="success" />
          <KpiCard label="Stationery" value={inr(totals.stationery)} icon={PenLine} tone="info" />
          <KpiCard label="Fuel" value={inr(totals.fuel)} icon={Fuel} tone="warning" />
          <KpiCard label="Grand Total" value={inr(totals.grandTotal)} icon={Wallet} tone="primary" />
        </div>

        {/* Form Dialog */}
        <Dialog open={openForm} onOpenChange={setOpenForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Finance Entry — {form.clusterName}</DialogTitle>
            </DialogHeader>

            {/* Header Section */}
            <div className="grid gap-4 bg-slate-50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Zone</Label>
                  <div className="text-sm font-medium mt-1">{form.zone}</div>
                </div>
                <div>
                  <Label className="text-xs">Team</Label>
                  <div className="text-sm font-medium mt-1">{form.team}</div>
                </div>
                <div>
                  <Label className="text-xs">Cluster</Label>
                  <div className="text-sm font-medium mt-1">{form.clusterName}</div>
                </div>
                <div>
                  <Label className="text-xs">Session Day</Label>
                  <Input
                    type="number"
                    min="1"
                    max="8"
                    value={form.sessionDay}
                    onChange={(e) => setForm(prev => ({ ...prev, sessionDay: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">SPOC Name</Label>
                  <div className="text-sm font-medium mt-1">{form.spocName}</div>
                </div>
                <div>
                  <Label className="text-xs">Financer Name</Label>
                  <div className="text-sm font-medium mt-1">{form.financerName}</div>
                </div>
                <div>
                  <Label className="text-xs">No Of Volunteers</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.volunteersCount}
                    onChange={(e) => setForm(prev => ({ ...prev, volunteersCount: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </div>

            {/* Expense Sections */}
            <Tabs defaultValue="travel" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="travel">Travel</TabsTrigger>
                <TabsTrigger value="food">Food</TabsTrigger>
                <TabsTrigger value="stationery">Stationery</TabsTrigger>
                <TabsTrigger value="fuel">Fuel</TabsTrigger>
                <TabsTrigger value="other">Other</TabsTrigger>
              </TabsList>

              {/* TRAVEL */}
              <TabsContent value="travel" className="space-y-4">
                {form.travelEntries.map(entry => (
                  <Card key={entry.id}>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-sm">{entry.from} → {entry.to || "..."}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTravelEntry(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">From</Label>
                          <Input
                            placeholder="e.g. KSR"
                            value={entry.from}
                            onChange={(e) => setForm(prev => ({
                              ...prev,
                              travelEntries: prev.travelEntries.map(t =>
                                t.id === entry.id ? { ...t, from: e.target.value } : t
                              ),
                            }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">To</Label>
                          <Input
                            placeholder="e.g. Salem"
                            value={entry.to}
                            onChange={(e) => setForm(prev => ({
                              ...prev,
                              travelEntries: prev.travelEntries.map(t =>
                                t.id === entry.id ? { ...t, to: e.target.value } : t
                              ),
                            }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Volunteers</Label>
                          <Input
                            type="number"
                            min="0"
                            value={entry.volunteers}
                            onChange={(e) => setForm(prev => ({
                              ...prev,
                              travelEntries: prev.travelEntries.map(t =>
                                t.id === entry.id ? { ...t, volunteers: parseInt(e.target.value) || 0 } : t
                              ),
                            }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Amount Per Person</Label>
                          <Input
                            type="number"
                            min="0"
                            value={entry.amountPerPerson}
                            onChange={(e) => setForm(prev => ({
                              ...prev,
                              travelEntries: prev.travelEntries.map(t =>
                                t.id === entry.id ? { ...t, amountPerPerson: parseInt(e.target.value) || 0 } : t
                              ),
                            }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Auto Calc</Label>
                          <div className="text-sm font-semibold bg-blue-50 p-2 rounded">
                            {entry.volunteers} × {entry.amountPerPerson} = {entry.volunteers * entry.amountPerPerson}
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        <Camera className="h-4 w-4 mr-2" /> Scan Bill
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" className="w-full" onClick={handleAddTravelEntry}>
                  <Plus className="h-4 w-4 mr-2" /> Add Travel Entry
                </Button>
              </TabsContent>

              {/* FOOD */}
              <TabsContent value="food" className="space-y-4">
                {FOOD_CATEGORIES.map(cat => (
                  <Card key={cat}>
                    <CardHeader>
                      <CardTitle className="text-sm">{cat}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="0"
                          placeholder="Amount"
                          value={form.foodEntries.find(f => f.category === cat)?.amount || 0}
                          onChange={(e) => setForm(prev => {
                            const existing = prev.foodEntries.find(f => f.category === cat);
                            if (existing) {
                              return {
                                ...prev,
                                foodEntries: prev.foodEntries.map(f =>
                                  f.id === existing.id ? { ...f, amount: parseInt(e.target.value) || 0 } : f
                                ),
                              };
                            } else {
                              return {
                                ...prev,
                                foodEntries: [...prev.foodEntries, { id: newId(), category: cat, amount: parseInt(e.target.value) || 0, bills: [] }],
                              };
                            }
                          })}
                        />
                        <Button variant="outline" size="sm">
                          <Camera className="h-4 w-4 mr-2" /> Scan Bill
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* STATIONERY */}
              <TabsContent value="stationery">
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.stationeryAmount}
                        onChange={(e) => setForm(prev => ({ ...prev, stationeryAmount: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <Button variant="outline" className="w-full">
                      <Camera className="h-4 w-4 mr-2" /> Scan Bill
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* FUEL */}
              <TabsContent value="fuel">
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.fuelAmount}
                        onChange={(e) => setForm(prev => ({ ...prev, fuelAmount: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <Button variant="outline" className="w-full">
                      <Camera className="h-4 w-4 mr-2" /> Scan Bill
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* OTHER */}
              <TabsContent value="other">
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.otherAmount}
                        onChange={(e) => setForm(prev => ({ ...prev, otherAmount: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <Button variant="outline" className="w-full">
                      <Camera className="h-4 w-4 mr-2" /> Scan Bill
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Totals */}
            <div className="bg-blue-50 p-4 rounded-lg space-y-2 border-2 border-blue-200">
              <div className="flex justify-between text-sm">
                <span>Travel Expenses</span>
                <span className="font-semibold">{inr(totals.travel)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Food Expenses</span>
                <span className="font-semibold">{inr(totals.food)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Stationery Expenses</span>
                <span className="font-semibold">{inr(totals.stationery)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Fuel Expenses</span>
                <span className="font-semibold">{inr(totals.fuel)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Other Expenses</span>
                <span className="font-semibold">{inr(totals.other)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-base">
                <span>Grand Total</span>
                <span className="text-blue-600">{inr(totals.grandTotal)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenForm(false)}>Cancel</Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" /> Save Finance Entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Entries List */}
        <Card>
          <CardHeader>
            <CardTitle>Submitted Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No entries yet</div>
            ) : (
              <div className="space-y-2">
                {expenses.map(exp => (
                  <div key={exp.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Day {exp.sessionDay} — {exp.date}</div>
                      <div className="text-sm text-muted-foreground">{inr(exp.amount)}</div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
