import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DataTable } from "@/components/layout/data-table";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { Plus, Pencil, Archive } from "lucide-react";
import { useStore, newId, type AcademicYear } from "@/lib/store";
import { toast } from "sonner";
import { KpiCard } from "@/components/layout/kpi-card";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/academic-years")({
  head: () => ({ meta: [{ title: "Academic Years — TQI Admin" }] }),
  component: AcademicYears,
});

function AcademicYears() {
  const { academicYears, upsert, remove, patch } = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<AcademicYear | null>(null);
  const [form, setForm] = useState({ name: "", start: "", end: "", active: false });

  const openCreate = () => { setEdit(null); setForm({ name: "", start: "", end: "", active: false }); setOpen(true); };
  const openEdit = (a: AcademicYear) => { setEdit(a); setForm({ name: a.name, start: a.start, end: a.end, active: a.active }); setOpen(true); };
  const save = () => {
    if (!form.name) return toast.error("Name required");
    upsert("academicYears", { id: edit?.id ?? newId(), archived: edit?.archived ?? false, ...form });
    toast.success(edit ? "Year updated" : "Year created");
    setOpen(false);
  };

  return (
    <AppShell>
      <PageHeader title="Academic Years" description="Create, archive and activate academic year sessions."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Create Year</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Years" value={academicYears.length} icon={Calendar} tone="primary" />
        <KpiCard label="Active" value={academicYears.filter(a => a.active).length} icon={Calendar} tone="success" />
        <KpiCard label="Archived" value={academicYears.filter(a => a.archived).length} icon={Calendar} tone="warning" />
        <KpiCard label="Upcoming" value={academicYears.filter(a => new Date(a.start) > new Date()).length} icon={Calendar} tone="info" />
      </div>
      <DataTable
        exportName="academic-years"
        rows={academicYears}
        searchKeys={["name"]}
        columns={[
          { key: "name", header: "Year", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "start", header: "Start" },
          { key: "end", header: "End" },
          { key: "active", header: "Status", render: (r) =>
            r.archived ? <Badge variant="outline">Archived</Badge> :
            r.active ? <Badge className="bg-success text-success-foreground">Active</Badge> :
            <Badge variant="secondary">Inactive</Badge>
          },
          { key: "_act", header: "", render: (r) => (
            <div className="flex justify-end gap-1">
              <Switch checked={r.active} onCheckedChange={(v) => patch("academicYears", r.id, { active: v })} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => patch("academicYears", r.id, { archived: !r.archived })}><Archive className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => { remove("academicYears", r.id); toast.success("Deleted"); }} />
            </div>
          ), className: "text-right" },
        ]}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Create"} Academic Year</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="2025-26" /></div>
            <div><Label>Start date</Label><Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
            <div><Label>End date</Label><Input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
            <label className="flex items-center gap-2 sm:col-span-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Active</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
