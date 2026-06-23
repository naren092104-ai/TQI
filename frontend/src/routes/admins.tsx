import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { Plus, Pencil, KeyRound, Activity, UserCog, Eye } from "lucide-react";
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
  const [clusterSearch, setClusterSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Admin | null>(null);
  const [resetForm, setResetForm] = useState({ password: "", confirm: "" });
  const [form, setForm] = useState({ name: "", email: "", username: "", college: "", phone: "", role: "" as Admin["role"] | "", active: true, password: "", confirm: "", clusterId: "", forcePasswordChange: true });
  const [view, setView] = useState<Admin | null>(null);

  const clusterOptions = useMemo(
    () => s.clusters.filter((cluster) => cluster.name.toLowerCase().includes(clusterSearch.toLowerCase())),
    [s.clusters, clusterSearch],
  );

  const openCreate = () => {
    setEdit(null);
    setClusterSearch("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForm({ name: "", email: "", username: "", college: "", phone: "", role: "", active: true, password: "", confirm: "", clusterId: "", forcePasswordChange: true });
    setOpen(true);
  };
  const openEdit = (a: Admin) => {
    setEdit(a);
    setClusterSearch("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForm({ name: a.name, email: a.email, username: a.username, college: a.college ?? "", phone: a.phone ?? "", role: a.role ?? "", active: a.active, password: "", confirm: "", clusterId: a.clusterId ?? "", forcePasswordChange: a.forcePasswordChange ?? false });
    setOpen(true);
  };
  const getPasswordStrength = (value: string) => {
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    return score;
  };

  const passwordStrengthLabel = (value: string) => {
    const score = getPasswordStrength(value);
    return score <= 1 ? "Weak" : score === 2 ? "Medium" : "Strong";
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    const password = Array.from({ length: 14 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("");
    setForm((prev) => ({ ...prev, password, confirm: password }));
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(form.password);
      toast.success("Password copied");
    } catch {
      toast.error("Unable to copy password");
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.username.trim()) return toast.error("Name and username are required");
    if (!edit && !form.password) return toast.error("Password is required for new admins");
    if (form.password && form.password !== form.confirm) return toast.error("Passwords do not match");
    if (form.role === "Cluster Admin" && !form.clusterId) return toast.error("Assign a cluster for cluster admins");
    const payload: any = {
      id: edit?.id ?? newId(),
      createdAt: edit?.createdAt ?? new Date().toISOString(),
      lastLogin: edit?.lastLogin ?? new Date().toISOString(),
      name: form.name,
      email: form.email || null,
      username: form.username,
      college: form.college || null,
      role: (form.role || "Admin") as Admin["role"],
      active: form.active,
      phone: form.phone || null,
      clusterId: form.role === "Cluster Admin" ? form.clusterId || null : null,
      forcePasswordChange: form.forcePasswordChange,
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
      <PageHeader title="User Management" description="Manage administrative users and roles." actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Create Admin</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Admins" value={s.admins.length} icon={UserCog} tone="primary" />
        <KpiCard label="Active" value={s.admins.filter((a) => a.active).length} icon={UserCog} tone="success" />
        <KpiCard label="Super Admins" value={s.admins.filter((a) => a.role === "Super Admin").length} icon={UserCog} tone="secondary" />
        <KpiCard label="Cluster Admins" value={s.admins.filter((a) => a.role === "Cluster Admin").length} icon={UserCog} tone="info" />
      </div>
      <DataTable
        exportName="admins"
        rows={s.admins}
        searchKeys={["name", "email", "role", "username", "college"]}
        columns={[
          { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "college", header: "College", render: (r) => r.college || "—" },
          { key: "email", header: "Email ID" },
          { key: "username", header: "Username" },
          { key: "clusterId", header: "Assigned Cluster", render: (r) => s.clusters.find((c) => c.id === r.clusterId)?.name || "—" },
          { key: "active", header: "Status", render: (r) => r.active ? <Badge className="bg-success text-success-foreground">Active</Badge> : <Badge variant="secondary">Inactive</Badge> },
          { key: "lastLogin", header: "Last Login", render: (r) => r.lastLogin?.slice(0,10) },
          { key: "forcePasswordChange", header: "Password Change Required", render: (r) => r.forcePasswordChange ? <Badge variant="outline">Yes</Badge> : <Badge variant="secondary">No</Badge> },
          { key: "_act", header: "Actions", className: "text-right", render: (r) => (
            <div className="flex flex-wrap justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView(r)}><Eye className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setResetTarget(r); setResetPasswordOpen(true); }}><KeyRound className="h-4 w-4" /></Button>
              <Switch checked={r.active} onCheckedChange={(v) => s.patch("admins", r.id, { active: v })} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => { s.remove("admins", r.id); toast.success("Deleted"); }} />
            </div>
          ) },
        ]}
      />
      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>New Password</Label><Input type="password" value={resetForm.password} onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })} /></div>
            <div><Label>Confirm Password</Label><Input type="password" value={resetForm.confirm} onChange={(e) => setResetForm({ ...resetForm, confirm: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!resetTarget) return;
              if (!resetForm.password) return toast.error("Password is required");
              if (resetForm.password !== resetForm.confirm) return toast.error("Passwords do not match");
              await s.patch("admins", resetTarget.id, { password: resetForm.password, forcePasswordChange: false });
              toast.success("Password reset");
              setResetPasswordOpen(false);
              setResetTarget(null);
              setResetForm({ password: "", confirm: "" });
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Create"} Admin</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs uppercase text-muted-foreground">Login Information</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Admin full name" /></div>
                <div><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Login username" /></div>
                <div><Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Admin["role"] | "", clusterId: v === "Cluster Admin" ? form.clusterId : "" })}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No role</SelectItem>
                      {['Super Admin', 'Admin', 'Cluster Admin', 'Finance'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Password</Label>
                  <div className="flex items-center gap-2">
                    <Input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowPassword((prev) => !prev)}>{showPassword ? "Hide" : "Show"}</Button>
                  </div>
                </div>
                <div><Label>Confirm Password</Label>
                  <div className="flex items-center gap-2">
                    <Input type={showConfirmPassword ? "text" : "password"} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowConfirmPassword((prev) => !prev)}>{showConfirmPassword ? "Hide" : "Show"}</Button>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm"><span className="font-medium">Strength:</span> {passwordStrengthLabel(form.password)}</div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${form.password ? (getPasswordStrength(form.password) >= 3 ? "bg-success" : getPasswordStrength(form.password) === 2 ? "bg-warning" : "bg-destructive") : "bg-border"}`} style={{ width: `${(getPasswordStrength(form.password) / 4) * 100}%` }} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={generatePassword}>Generate Strong Password</Button>
                  <Button variant="outline" size="sm" onClick={copyPassword} disabled={!form.password}>Copy Password</Button>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-3">
                <Switch checked={form.forcePasswordChange} onCheckedChange={(v) => setForm({ ...form, forcePasswordChange: v })} />
                <span className="text-sm">Force Password Change On First Login</span>
              </div>
            </div>
            {form.role === "Cluster Admin" && (
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs uppercase text-muted-foreground">Cluster Assignment</div>
                <div className="mt-3 space-y-2">
                  <Input placeholder="Search clusters" value={clusterSearch} onChange={(e) => setClusterSearch(e.target.value)} />
                  <Select value={form.clusterId} onValueChange={(value) => setForm({ ...form, clusterId: value })}>
                    <SelectTrigger><SelectValue placeholder="Select cluster" /></SelectTrigger>
                    <SelectContent>
                      {clusterOptions.length === 0 ? (
                        <SelectItem value="">No matching clusters</SelectItem>
                      ) : (
                        clusterOptions.map((cluster) => (
                          <SelectItem key={cluster.id} value={cluster.id}>{cluster.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {view && (
            <>
              <SheetHeader><SheetTitle>{view.name}</SheetTitle></SheetHeader>
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4">
                  <div className="text-xs uppercase text-muted-foreground">Login Information</div>
                  <div><span className="text-muted-foreground">Password Change Required:</span> {view.forcePasswordChange ? "Yes" : "No"}</div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
