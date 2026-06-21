import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Plus, Pencil, HeartHandshake, Upload, Download } from "lucide-react";
import { useStore, newId, type Volunteer } from "@/lib/store";
import { toast } from "sonner";
import { downloadMock, toCSV } from "@/lib/format";

export const Route = createFileRoute("/volunteers")({
  head: () => ({ meta: [{ title: "Volunteers — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Volunteer | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", clusterId: "", skill: "Math", sessions: 0 });

  const openCreate = () => { setEdit(null); setForm({ name: "", email: "", phone: "", clusterId: s.clusters[0]?.id ?? "", skill: "Math", sessions: 0 }); setOpen(true); };
  const openEdit = (v: Volunteer) => { setEdit(v); setForm(v); setOpen(true); };
  const save = () => {
    if (!form.name || !form.email) return toast.error("Required");
    s.upsert("volunteers", { id: edit?.id ?? newId(), ...form });
    toast.success("Saved"); setOpen(false);
  };
  const cName = (id: string) => s.clusters.find(c => c.id === id)?.name ?? "—";

  return (
    <AppShell>
      <PageHeader title="Volunteers" description="Trained volunteers running sessions." actions={
        <>
          <Button variant="outline" onClick={() => toast.success("Import flow opened")}><Upload className="h-4 w-4" /> Import</Button>
          <Button variant="outline" onClick={() => downloadMock("volunteers.csv", toCSV(s.volunteers as any), "text/csv")}><Download className="h-4 w-4" /> Export</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Create Volunteer</Button>
        </>
      } />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Volunteers" value={s.volunteers.length} icon={HeartHandshake} tone="secondary" />
        <KpiCard label="Skills" value={new Set(s.volunteers.map(v=>v.skill)).size} icon={HeartHandshake} tone="info" />
        <KpiCard label="Total Sessions" value={s.volunteers.reduce((a,b)=>a+b.sessions,0)} icon={HeartHandshake} tone="primary" />
        <KpiCard label="Avg Sessions" value={(s.volunteers.reduce((a,b)=>a+b.sessions,0)/Math.max(1,s.volunteers.length)).toFixed(1)} icon={HeartHandshake} tone="success" />
      </div>
      <DataTable
        exportName="volunteers" rows={s.volunteers} searchKeys={["name","email","skill"]}
        columns={[
          { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "email", header: "Email" },
          { key: "phone", header: "Phone" },
          { key: "skill", header: "Skill", render: (r) => <Badge variant="outline">{r.skill}</Badge> },
          { key: "cluster", header: "Cluster", render: (r) => cName(r.clusterId) },
          { key: "sessions", header: "Sessions", render: (r) => <Badge>{r.sessions}</Badge> },
          { key: "_act", header: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => { s.remove("volunteers", r.id); toast.success("Deleted"); }} />
            </div>
          ) },
        ]}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Create"} Volunteer</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Skill</Label>
              <Select value={form.skill} onValueChange={(v) => setForm({ ...form, skill: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Math","Science","English","Arts","Sports","Computing"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Cluster</Label>
              <Select value={form.clusterId} onValueChange={(v) => setForm({ ...form, clusterId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{s.clusters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
