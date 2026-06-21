import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
import { Plus, Pencil, MapPin } from "lucide-react";
import { useStore, newId, type Panchayat } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/panchayats")({
  head: () => ({ meta: [{ title: "Panchayats — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Panchayat | null>(null);
  const [form, setForm] = useState({ name: "", head: "" });
  const [filter, setFilter] = useState<string>("all");

  const openCreate = () => { setEdit(null); setForm({ name: "", head: "" }); setOpen(true); };
  const openEdit = (p: Panchayat) => { setEdit(p); setForm({ name: p.name, head: p.head }); setOpen(true); };
  const save = () => {
    if (!form.name) return toast.error("All fields required");
    s.upsert("panchayats", {
      id: edit?.id ?? newId(),
      createdAt: edit?.createdAt ?? new Date().toISOString(),
      ...form,
      clusterId: edit?.clusterId ?? s.clusters[0]?.id ?? "",
    });
    toast.success(edit ? "Updated" : "Created");
    setOpen(false);
  };

  const rows = useMemo(() => filter === "all" ? s.panchayats : s.panchayats.filter(p => p.clusterId === filter), [s.panchayats, filter]);
  const clusterName = (id: string) => s.clusters.find(c => c.id === id)?.name ?? "—";

  return (
    <AppShell>
      <PageHeader title="Panchayats" description="Panchayats belong to a Cluster." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Panchayats" value={s.panchayats.length} icon={MapPin} tone="primary" />
        <KpiCard label="Clusters" value={s.clusters.length} icon={MapPin} tone="info" />
        <KpiCard label="Villages" value={s.villages.length} icon={MapPin} tone="success" />
        <KpiCard label="Avg per Cluster" value={(s.panchayats.length / Math.max(1, s.clusters.length)).toFixed(1)} icon={MapPin} tone="secondary" />
      </div>
      <DataTable
        exportName="panchayats"
        rows={rows}
        searchKeys={["name", "head"]}
        filterBar={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clusters</SelectItem>
              {s.clusters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        columns={[
          { key: "name", header: "Panchayat", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "cluster", header: "Cluster", render: (r) => <Badge variant="outline">{clusterName(r.clusterId)}</Badge> },
          { key: "head", header: "Head" },
          { key: "_act", header: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => { s.remove("panchayats", r.id); toast.success("Deleted"); }} />
            </div>
          ) },
        ]}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Create"} Panchayat</DialogTitle></DialogHeader>
          <div className="grid gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Head</Label><Input value={form.head} onChange={(e) => setForm({ ...form, head: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
