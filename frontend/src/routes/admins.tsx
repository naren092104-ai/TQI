import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DataTable } from "@/components/layout/data-table";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { KpiCard } from "@/components/layout/kpi-card";
import { Plus, Pencil, KeyRound, Activity, UserCog } from "lucide-react";
import { useStore, newId, type Admin } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/admins")({
  head: () => ({ meta: [{ title: "Admins — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Admin | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "Admin" as Admin["role"], active: true, password: "", confirm: "" });
  const [view, setView] = useState<Admin | null>(null);

  const openCreate = () => { setEdit(null); setForm({ name: "", email: "", role: "Super Admin", active: true, password: "", confirm: "" }); setOpen(true); };
  const openEdit = (a: Admin) => { setEdit(a); setForm({ name: a.name, email: a.email, role: a.role, active: a.active, password: "", confirm: "" }); setOpen(true); };
  const save = async () => {
    if (!form.name || !form.email) return toast.error("Required");
    if (!edit && !form.password) return toast.error("Password is required for new admins");
    if (form.password && form.password !== form.confirm) return toast.error("Passwords do not match");
    const payload: any = {
      id: edit?.id ?? newId(),
      createdAt: edit?.createdAt ?? new Date().toISOString(),
      lastLogin: edit?.lastLogin ?? new Date().toISOString(),
      name: form.name,
      email: form.email,
      username: edit?.username ?? form.email,
      role: form.role,
      active: form.active,
      phone: edit?.phone ?? null,
      clusterId: edit?.clusterId ?? null,
    };
    if (form.password) payload.password = form.password;
    try {
      await s.upsert("admins", payload);
      toast.success("Saved");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save admin");
    }
  };

  return (
    <AppShell>
      <PageHeader title="Admins" description="Manage administrative users and roles." actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Create Admin</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Admins" value={s.admins.length} icon={UserCog} tone="primary" />
        <KpiCard label="Active" value={s.admins.filter(a=>a.active).length} icon={UserCog} tone="success" />
        <KpiCard label="Super Admins" value={s.admins.filter(a=>a.role==="Super Admin").length} icon={UserCog} tone="secondary" />
        <KpiCard label="Finance" value={s.admins.filter(a=>a.role==="Finance").length} icon={UserCog} tone="info" />
      </div>
      <DataTable
        exportName="admins"
        rows={s.admins}
        searchKeys={["name","email","role"]}
        columns={[
          { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "email", header: "Email" },
          { key: "role", header: "Role", render: (r) => <Badge variant="outline">{r.role}</Badge> },
          { key: "active", header: "Status", render: (r) => r.active ? <Badge className="bg-success text-success-foreground">Active</Badge> : <Badge variant="secondary">Inactive</Badge> },
          { key: "lastLogin", header: "Last login", render: (r) => r.lastLogin?.slice(0,10) },
          { key: "_act", header: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView(r)}><Activity className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { toast.success("Password reset link sent"); }}><KeyRound className="h-4 w-4" /></Button>
              <Switch checked={r.active} onCheckedChange={(v) => s.patch("admins", r.id, { active: v })} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => { s.remove("admins", r.id); toast.success("Deleted"); }} />
            </div>
          ) },
        ]}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Create"} Admin</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Login uses email and password; username is not required.</p>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div><Label>Confirm password</Label><Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Admin["role"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Super Admin","Admin","Cluster Admin","Finance"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Active</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {view && (
            <>
              <SheetHeader><SheetTitle>{view.name} — Activity</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-2 text-sm">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="font-medium">{["Logged in","Approved expense","Created cluster","Reset password","Edited admin","Generated report"][i]}</div>
                    <div className="text-xs text-muted-foreground">{new Date(Date.now() - i * 3600_000).toLocaleString()} · IP 192.168.0.{i}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
