import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/layout/data-table";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { KpiCard } from "@/components/layout/kpi-card";
import { Plus, Pencil, Trees } from "lucide-react";
import { useStore, newId, type Village } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/villages")({
  head: () => ({ meta: [{ title: "Villages — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Village | null>(null);
  const [form, setForm] = useState({ name: "", panchayatId: "", population: 1000 });
  const [filterCluster, setFilterCluster] = useState("all");

  const openCreate = () => { setEdit(null); setForm({ name: "", panchayatId: s.panchayats[0]?.id ?? "", population: 1000 }); setOpen(true); };
  const openEdit = (v: Village) => {
    setEdit(v);
    setForm({ name: v.name, panchayatId: v.panchayatId, population: v.population });
    setOpen(true);
  };
  const save = () => {
    if (!form.name || !form.panchayatId) return toast.error("All fields required");
    s.upsert("villages", { id: edit?.id ?? newId(), createdAt: edit?.createdAt ?? new Date().toISOString(), name: form.name, panchayatId: form.panchayatId, population: form.population });
    toast.success(edit ? "Updated" : "Created");
    setOpen(false);
  };

  const availablePanchayats = useMemo(() => s.panchayats, [s.panchayats]);
  const rows = useMemo(() => {
    if (filterCluster === "all") return s.villages;
    const pIds = s.panchayats.filter(p => p.clusterId === filterCluster).map(p => p.id);
    return s.villages.filter(v => pIds.includes(v.panchayatId));
  }, [s.villages, s.panchayats, filterCluster]);

  const pName = (id: string) => s.panchayats.find(p => p.id === id)?.name ?? "—";
  const cName = (pid: string) => {
    const p = s.panchayats.find(x => x.id === pid);
    return s.clusters.find(c => c.id === p?.clusterId)?.name ?? "—";
  };

  return (
    <AppShell>
      <PageHeader title="Villages" description="Village belongs to a Panchayat → Cluster." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Villages" value={s.villages.length} icon={Trees} tone="success" />
        <KpiCard label="Panchayats" value={s.panchayats.length} icon={Trees} tone="info" />
        <KpiCard label="Clusters" value={s.clusters.length} icon={Trees} tone="primary" />
        <KpiCard label="Avg Population" value={Math.round(s.villages.reduce((a,b)=>a+b.population,0)/Math.max(1,s.villages.length)).toLocaleString()} icon={Trees} tone="secondary" />
      </div>
      <DataTable
        exportName="villages"
        rows={rows}
        searchKeys={["name"]}
        filterBar={
          <Select value={filterCluster} onValueChange={setFilterCluster}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clusters</SelectItem>
              {s.clusters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        columns={[
          { key: "name", header: "Village", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "panchayat", header: "Panchayat", render: (r) => pName(r.panchayatId) },
          { key: "cluster", header: "Cluster", render: (r) => <Badge variant="outline">{cName(r.panchayatId)}</Badge> },
          { key: "population", header: "Population", render: (r) => r.population.toLocaleString() },
          { key: "_act", header: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => { s.remove("villages", r.id); toast.success("Deleted"); }} />
            </div>
          ) },
        ]}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Create"} Village</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Select Panchayat</Label>
              <Select value={form.panchayatId} onValueChange={(v) => setForm({ ...form, panchayatId: v })}>
                <SelectTrigger><SelectValue placeholder="Select Panchayat" /></SelectTrigger>
                <SelectContent>{availablePanchayats.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Village name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Population</Label><Input type="number" value={form.population} onChange={(e) => setForm({ ...form, population: +e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
