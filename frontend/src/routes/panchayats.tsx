import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/layout/data-table";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { KpiCard } from "@/components/layout/kpi-card";
import { Plus, Pencil, MapPin, Trees, ChevronDown, ChevronRight } from "lucide-react";
import { useStore, newId, type Panchayat, type Village } from "@/lib/store";
import { useAuth, isClusterAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/panchayats")({
  head: () => ({ meta: [{ title: "Panchayats — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const { user } = useAuth();
  const clusterAdmin = isClusterAdmin(user?.role);
  const myClusterId = user?.clusterId ?? "";

  // ── Panchayat dialog ──
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Panchayat | null>(null);
  const [form, setForm] = useState({ name: "", head: "", clusterId: "" });

  // ── Village dialog ──
  const [vOpen, setVOpen] = useState(false);
  const [vEdit, setVEdit] = useState<Village | null>(null);
  const [vForm, setVForm] = useState({ name: "", panchayatId: "", population: 1000 });

  // ── Cluster filter (super admin only) ──
  const [filter, setFilter] = useState<string>("all");

  // ── Expanded panchayat rows showing their villages ──
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Panchayat CRUD ──
  const openCreate = () => {
    setEdit(null);
    setForm({ name: "", head: "", clusterId: clusterAdmin ? myClusterId : s.clusters[0]?.id ?? "" });
    setOpen(true);
  };
  const openEdit = (p: Panchayat) => {
    setEdit(p);
    setForm({ name: p.name, head: p.head, clusterId: p.clusterId });
    setOpen(true);
  };
  const save = () => {
    if (!form.name) return toast.error("Panchayat name is required");
    if (!form.clusterId) return toast.error("Cluster is required");
    s.upsert("panchayats", {
      id: edit?.id ?? newId(),
      createdAt: edit?.createdAt ?? new Date().toISOString(),
      name: form.name,
      head: form.head,
      clusterId: form.clusterId,
    });
    toast.success(edit ? "Panchayat updated" : "Panchayat created");
    setOpen(false);
  };

  // ── Village CRUD ──
  const openAddVillage = (panchayatId: string) => {
    setVEdit(null);
    setVForm({ name: "", panchayatId, population: 1000 });
    setVOpen(true);
  };
  const openEditVillage = (v: Village) => {
    setVEdit(v);
    setVForm({ name: v.name, panchayatId: v.panchayatId, population: v.population });
    setVOpen(true);
  };
  const saveVillage = () => {
    if (!vForm.name || !vForm.panchayatId) return toast.error("Village name is required");
    s.upsert("villages", {
      id: vEdit?.id ?? newId(),
      createdAt: vEdit?.createdAt ?? new Date().toISOString(),
      name: vForm.name,
      panchayatId: vForm.panchayatId,
      population: vForm.population,
    });
    toast.success(vEdit ? "Village updated" : "Village added");
    setVOpen(false);
  };

  // ── Filtered rows ──
  const rows = useMemo(() => {
    if (clusterAdmin) return s.panchayats.filter((p) => p.clusterId === myClusterId);
    if (filter === "all") return s.panchayats;
    return s.panchayats.filter((p) => p.clusterId === filter);
  }, [s.panchayats, filter, clusterAdmin, myClusterId]);

  const clusterName = (id: string) => s.clusters.find((c) => c.id === id)?.name ?? "—";
  const villagesFor = (pId: string) => s.villages.filter((v) => v.panchayatId === pId);

  // KPI values
  const myPanchayats = clusterAdmin ? rows : s.panchayats;
  const myVillages = useMemo(
    () => s.villages.filter((v) => myPanchayats.some((p) => p.id === v.panchayatId)),
    [s.villages, myPanchayats],
  );

  return (
    <AppShell>
      <PageHeader
        title="Panchayats"
        description={clusterAdmin ? "Manage your cluster's panchayats and their villages." : "Panchayats belong to a Cluster."}
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Panchayat</Button>}
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Panchayats" value={rows.length} icon={MapPin} tone="primary" />
        <KpiCard label="Total Villages" value={myVillages.length} icon={Trees} tone="success" />
        {!clusterAdmin && <KpiCard label="Clusters" value={s.clusters.length} icon={MapPin} tone="info" />}
        <KpiCard
          label="Avg Villages / Panchayat"
          value={(myVillages.length / Math.max(1, rows.length)).toFixed(1)}
          icon={MapPin}
          tone="secondary"
        />
      </div>

      {/* Super admin cluster filter */}
      {!clusterAdmin && (
        <div className="mb-4 flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clusters</SelectItem>
              {s.clusters.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{rows.length} panchayat(s)</span>
        </div>
      )}

      {/* Panchayat cards with expandable villages */}
      <div className="space-y-3">
        {rows.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MapPin className="mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">No panchayats yet.</p>
              <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4" /> Add Panchayat</Button>
            </CardContent>
          </Card>
        )}

        {rows.map((p) => {
          const villages = villagesFor(p.id);
          const isExpanded = !!expanded[p.id];
          return (
            <Card key={p.id} className="overflow-hidden shadow-card">
              {/* Panchayat row */}
              <CardHeader className="p-0">
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(p.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted hover:bg-muted/80 transition-colors"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {/* Panchayat info */}
                  <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                    <span className="font-semibold text-sm truncate">{p.name}</span>
                    {!clusterAdmin && (
                      <Badge variant="outline" className="shrink-0 text-xs">{clusterName(p.clusterId)}</Badge>
                    )}
                    {p.head && (
                      <span className="text-xs text-muted-foreground truncate">Head: {p.head}</span>
                    )}
                  </div>

                  {/* Village count badge */}
                  <button
                    onClick={() => toggleExpand(p.id)}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
                      isExpanded
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-primary/10",
                    )}
                  >
                    {villages.length} village{villages.length !== 1 ? "s" : ""}
                  </button>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => { openAddVillage(p.id); if (!isExpanded) toggleExpand(p.id); }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Village
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDelete onConfirm={() => { s.remove("panchayats", p.id); toast.success("Deleted"); }} />
                  </div>
                </div>
              </CardHeader>

              {/* Villages expansion */}
              {isExpanded && (
                <CardContent className="border-t border-border bg-muted/30 p-0">
                  {villages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                      <Trees className="mb-2 h-7 w-7 opacity-30" />
                      <p className="text-xs">No villages in this panchayat yet.</p>
                      <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs" onClick={() => openAddVillage(p.id)}>
                        <Plus className="h-3.5 w-3.5" /> Add First Village
                      </Button>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/60">
                          <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Village</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Population</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {villages.map((v, i) => (
                          <tr
                            key={v.id}
                            className={cn(
                              "border-b border-border/50 last:border-0 transition-colors hover:bg-muted/40",
                            )}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <Trees className="h-3.5 w-3.5 shrink-0 text-success" style={{ color: "var(--color-success, #22c55e)" }} />
                                <span className="font-medium">{v.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {v.population.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEditVillage(v)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <ConfirmDelete
                                  onConfirm={() => { s.remove("villages", v.id); toast.success("Village deleted"); }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} className="px-4 py-2.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1.5 text-xs text-primary hover:text-primary"
                              onClick={() => openAddVillage(p.id)}
                            >
                              <Plus className="h-3.5 w-3.5" /> Add Another Village
                            </Button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* ── Panchayat Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Add"} Panchayat</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {/* Cluster selector — hidden for cluster admins, locked to their cluster */}
            {!clusterAdmin && (
              <div>
                <Label>Cluster <span className="text-destructive">*</span></Label>
                <Select value={form.clusterId} onValueChange={(v) => setForm({ ...form, clusterId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select cluster" /></SelectTrigger>
                  <SelectContent>
                    {s.clusters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {clusterAdmin && form.clusterId && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Cluster: </span>
                <span className="font-semibold">{clusterName(form.clusterId)}</span>
              </div>
            )}
            <div>
              <Label>Panchayat Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sittling"
              />
            </div>
            <div>
              <Label>Head / Panchayat President</Label>
              <Input
                value={form.head}
                onChange={(e) => setForm({ ...form, head: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Village Dialog ── */}
      <Dialog open={vOpen} onOpenChange={setVOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{vEdit ? "Edit" : "Add"} Village</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {vForm.panchayatId && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Panchayat: </span>
                <span className="font-semibold">
                  {s.panchayats.find((p) => p.id === vForm.panchayatId)?.name ?? "—"}
                </span>
              </div>
            )}
            <div>
              <Label>Village Name <span className="text-destructive">*</span></Label>
              <Input
                value={vForm.name}
                onChange={(e) => setVForm({ ...vForm, name: e.target.value })}
                placeholder="e.g. Vedakattamaduvu"
              />
            </div>
            <div>
              <Label>Population</Label>
              <Input
                type="number"
                min={0}
                value={vForm.population}
                onChange={(e) => setVForm({ ...vForm, population: +e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVOpen(false)}>Cancel</Button>
            <Button onClick={saveVillage}>Save Village</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
