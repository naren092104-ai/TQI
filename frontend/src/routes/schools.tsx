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
import { Plus, Pencil, School as SchoolIcon } from "lucide-react";
import { useStore, newId, type School } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/schools")({
  head: () => ({ meta: [{ title: "Schools — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<School | null>(null);
  const [form, setForm] = useState({ name: "", clusterId: "", panchayatId: "", villageId: "", type: "Primary" as School["type"] });
  const [filterCluster, setFilterCluster] = useState("all");

  const openCreate = () => { setEdit(null); setForm({ name: "", clusterId: "", panchayatId: "", villageId: "", type: "Primary" }); setOpen(true); };
  const openEdit = (sc: School) => {
    setEdit(sc);
    const v = s.villages.find(v => v.id === sc.villageId);
    const p = s.panchayats.find(p => p.id === v?.panchayatId);
    setForm({ name: sc.name, villageId: sc.villageId, panchayatId: p?.id ?? "", clusterId: p?.clusterId ?? "", type: sc.type });
    setOpen(true);
  };
  const save = () => {
    if (!form.name || !form.villageId) return toast.error("All required");
    s.upsert("schools", { id: edit?.id ?? newId(), createdAt: edit?.createdAt ?? new Date().toISOString(), name: form.name, villageId: form.villageId, type: form.type, principal: "" });
    toast.success(edit ? "Updated" : "Created");
    setOpen(false);
  };

  const ps = useMemo(() => s.panchayats.filter(p => !form.clusterId || p.clusterId === form.clusterId), [s.panchayats, form.clusterId]);
  const vs = useMemo(() => s.villages.filter(v => !form.panchayatId || v.panchayatId === form.panchayatId), [s.villages, form.panchayatId]);

  const rows = useMemo(() => {
    if (filterCluster === "all") return s.schools;
    const pIds = s.panchayats.filter(p => p.clusterId === filterCluster).map(p => p.id);
    const vIds = s.villages.filter(v => pIds.includes(v.panchayatId)).map(v => v.id);
    return s.schools.filter(sc => vIds.includes(sc.villageId));
  }, [s.schools, s.villages, s.panchayats, filterCluster]);

  const villageName = (id: string) => s.villages.find(v => v.id === id)?.name ?? "—";
  const panchayatName = (villageId: string) => {
    const v = s.villages.find(v => v.id === villageId);
    return v ? s.panchayats.find(p => p.id === v.panchayatId)?.name ?? "—" : "—";
  };
  const clusterName = (villageId: string) => {
    const v = s.villages.find(v => v.id === villageId);
    const p = v ? s.panchayats.find(p => p.id === v.panchayatId) : null;
    return p ? s.clusters.find(c => c.id === p.clusterId)?.name ?? "—" : "—";
  };

  return (
    <AppShell>
      <PageHeader title="Schools" description="Hierarchy: Cluster → Panchayat → Village → School" actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Create School</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Schools" value={s.schools.length} icon={SchoolIcon} tone="primary" />
        <KpiCard label="Primary" value={s.schools.filter(x=>x.type==="Primary").length} icon={SchoolIcon} tone="info" />
        <KpiCard label="High" value={s.schools.filter(x=>x.type==="High").length} icon={SchoolIcon} tone="success" />
        <KpiCard label="Higher Sec" value={s.schools.filter(x=>x.type==="Higher Secondary").length} icon={SchoolIcon} tone="secondary" />
      </div>
      <DataTable
        exportName="schools"
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
          { key: "name", header: "School", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "type", header: "Type", render: (r) => <Badge variant="outline">{r.type}</Badge> },
          { key: "cluster", header: "Cluster", render: (r) => clusterName(r.villageId) },
          { key: "panchayat", header: "Panchayat", render: (r) => panchayatName(r.villageId) },
          { key: "village", header: "Village", render: (r) => villageName(r.villageId) },
          { key: "_act", header: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => { s.remove("schools", r.id); toast.success("Deleted"); }} />
            </div>
          ) },
        ]}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Create"} School</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>1. Cluster</Label>
              <Select value={form.clusterId} onValueChange={(v) => setForm({ ...form, clusterId: v, panchayatId: "", villageId: "" })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{s.clusters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>2. Panchayat</Label>
              <Select value={form.panchayatId} onValueChange={(v) => setForm({ ...form, panchayatId: v, villageId: "" })} disabled={!form.clusterId}>
                <SelectTrigger><SelectValue placeholder={form.clusterId ? "Select" : "Pick cluster"} /></SelectTrigger>
                <SelectContent>{ps.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>3. Village</Label>
              <Select value={form.villageId} onValueChange={(v) => setForm({ ...form, villageId: v })} disabled={!form.panchayatId}>
                <SelectTrigger><SelectValue placeholder={form.panchayatId ? "Select" : "Pick panchayat"} /></SelectTrigger>
                <SelectContent>{vs.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>4. Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as School["type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Primary","Middle","High","Higher Secondary"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>School name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
