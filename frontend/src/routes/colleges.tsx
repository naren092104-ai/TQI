import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DataTable } from "@/components/layout/data-table";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { KpiCard } from "@/components/layout/kpi-card";
import { Plus, Pencil, GraduationCap } from "lucide-react";
import { useStore, newId, type College } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/colleges")({
  head: () => ({ meta: [{ title: "Colleges — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<College | null>(null);
  const [form, setForm] = useState({ name: "", city: "", affiliated: "" });

  const openCreate = () => { setEdit(null); setForm({ name: "", city: "", affiliated: "" }); setOpen(true); };
  const openEdit = (c: College) => { setEdit(c); setForm({ name: c.name, city: c.city, affiliated: c.affiliated }); setOpen(true); };
  const save = () => {
    if (!form.name) return toast.error("Name required");
    s.upsert("colleges", { id: edit?.id ?? newId(), createdAt: edit?.createdAt ?? new Date().toISOString(), ...form });
    toast.success("Saved"); setOpen(false);
  };

  return (
    <AppShell>
      <PageHeader title="Colleges" description="Partner colleges supplying volunteers." actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Create College</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Colleges" value={s.colleges.length} icon={GraduationCap} tone="primary" />
        <KpiCard label="Cities" value={new Set(s.colleges.map(c=>c.city)).size} icon={GraduationCap} tone="info" />
        <KpiCard label="Affiliations" value={new Set(s.colleges.map(c=>c.affiliated)).size} icon={GraduationCap} tone="success" />
        <KpiCard label="Volunteers" value={s.volunteers.length} icon={GraduationCap} tone="secondary" />
      </div>
      <DataTable
        exportName="colleges" rows={s.colleges} searchKeys={["name","city","affiliated"]}
        columns={[
          { key: "name", header: "College", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "city", header: "City" },
          { key: "affiliated", header: "Affiliation" },
          { key: "_act", header: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => { s.remove("colleges", r.id); toast.success("Deleted"); }} />
            </div>
          )},
        ]}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Create"} College</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Affiliation</Label><Input value={form.affiliated} onChange={(e) => setForm({ ...form, affiliated: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
