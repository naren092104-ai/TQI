import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
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
import { Plus, Pencil, KeyRound, UserCog, Eye, EyeOff } from "lucide-react";
import { useStore, newId, type Admin } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/admins")({
  head: () => ({ meta: [{ title: "User Management — TQI Admin" }] }),
  component: Page,
});

// Only these two roles are valid
const ROLES: Admin["role"][] = ["Super Admin", "Cluster Admin"];

function Page() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Admin | null>(null);
  const [clusterSearch, setClusterSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Admin | null>(null);
  const [resetForm, setResetForm] = useState({ password: "", confirm: "", showPw: false });
  const [view, setView] = useState<Admin | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    college: "",
    phone: "",
    role: "" as Admin["role"] | "",
    active: true,
    password: "",
    confirm: "",
    clusterId: "",
    spocName: "",
    forcePasswordChange: true,
  });

  const isClusterAdmin = form.role === "Cluster Admin";

  const clusterOptions = useMemo(
    () => s.clusters.filter((c) => c.name.toLowerCase().includes(clusterSearch.toLowerCase())),
    [s.clusters, clusterSearch],
  );

  const openCreate = () => {
    setEdit(null);
    setClusterSearch("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForm({ name: "", email: "", college: "", phone: "", role: "", active: true, password: "", confirm: "", clusterId: "", spocName: "", forcePasswordChange: true });
    setOpen(true);
  };

  const openEdit = (a: Admin) => {
    setEdit(a);
    setClusterSearch("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForm({ name: a.name, email: a.email, college: a.college ?? "", phone: a.phone ?? "", role: a.role ?? "", active: a.active, password: "", confirm: "", clusterId: a.clusterId ?? "", spocName: (a as any).spocName ?? a.name, forcePasswordChange: a.forcePasswordChange ?? false });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.email.trim()) return toast.error("Email ID is required");
    if (!form.role) return toast.error("Role is required");
    if (!edit && !form.password) return toast.error("Password is required");
    if (form.password && form.password !== form.confirm) return toast.error("Passwords do not match");
    if (form.role === "Cluster Admin") {
      if (!form.clusterId) return toast.error("Cluster assignment is required for Cluster Admin");
      if (!form.phone.trim()) return toast.error("Mobile number is required for Cluster Admin");
      if (!form.college.trim()) return toast.error("College name is required for Cluster Admin");
    }

    const payload: any = {
      id: edit?.id ?? newId(),
      createdAt: edit?.createdAt ?? new Date().toISOString(),
      lastLogin: edit?.lastLogin ?? new Date().toISOString(),
      name: form.name,
      email: form.email,
      // keep username = email for backward compat with existing DB
      username: form.email,
      college: form.role === "Cluster Admin" ? form.college || null : null,
      role: form.role as Admin["role"],
      active: form.active,
      phone: form.role === "Cluster Admin" ? form.phone || null : null,
      clusterId: form.role === "Cluster Admin" ? form.clusterId || null : null,
      forcePasswordChange: form.forcePasswordChange,
    };
    if (form.password) payload.password = form.password;

    try {
      await s.upsert("admins", payload);
      toast.success("Saved");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="User Management"
        description="Manage Super Admins and Cluster Admins."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Create User</Button>}
      />

      {/* KPI Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Users" value={s.admins.length} icon={UserCog} tone="primary" />
        <KpiCard label="Active" value={s.admins.filter((a) => a.active).length} icon={UserCog} tone="success" />
        <KpiCard label="Super Admins" value={s.admins.filter((a) => a.role === "Super Admin").length} icon={UserCog} tone="secondary" />
        <KpiCard label="Cluster Admins" value={s.admins.filter((a) => a.role === "Cluster Admin").length} icon={UserCog} tone="info" />
      </div>

      {/* User Table */}
      <DataTable
        exportName="users"
        rows={s.admins}
        searchKeys={["name", "email", "role", "college", "phone"]}
        columns={[
          { key: "name",      header: "Name",         render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "role",      header: "Role",         render: (r) => (
            <Badge variant={r.role === "Super Admin" ? "default" : "outline"} className={r.role === "Super Admin" ? "bg-indigo-600 text-white" : ""}>
              {r.role}
            </Badge>
          )},
          { key: "email",     header: "Email ID" },
          { key: "clusterId", header: "Cluster",      render: (r) => s.clusters.find((c) => c.id === r.clusterId)?.name || "—" },
          { key: "college",   header: "College",      render: (r) => r.college || "—" },
          { key: "phone",     header: "Mobile",       render: (r) => r.phone || "—" },
          { key: "active",    header: "Status",       render: (r) => r.active ? <Badge className="bg-success text-success-foreground">Active</Badge> : <Badge variant="secondary">Inactive</Badge> },
          { key: "lastLogin", header: "Last Login",   render: (r) => r.lastLogin?.slice(0, 10) || "—" },
          { key: "_act",      header: "Actions",      className: "text-right", render: (r) => (
            <div className="flex flex-wrap justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView(r)} title="View"><Eye className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setResetTarget(r); setResetPasswordOpen(true); }} title="Reset Password"><KeyRound className="h-4 w-4" /></Button>
              <Switch checked={r.active} onCheckedChange={(v) => s.patch("admins", r.id, { active: v })} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} title="Edit"><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => { s.remove("admins", r.id); toast.success("Deleted"); }} />
            </div>
          )},
        ]}
      />

      {/* ── Reset Password Dialog ── */}
      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password — {resetTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>New Password</Label>
              <div className="relative mt-1">
                <Input type={resetForm.showPw ? "text" : "password"} value={resetForm.password}
                  onChange={(e) => setResetForm(p => ({ ...p, password: e.target.value }))} placeholder="Enter new password" />
                <button type="button" onClick={() => setResetForm(p => ({ ...p, showPw: !p.showPw }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {resetForm.showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirm Password</Label>
              <Input className="mt-1" type="password" value={resetForm.confirm}
                onChange={(e) => setResetForm(p => ({ ...p, confirm: e.target.value }))} placeholder="Confirm password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetPasswordOpen(false); setResetForm({ password: "", confirm: "", showPw: false }); }}>Cancel</Button>
            <Button onClick={async () => {
              if (!resetTarget) return;
              if (!resetForm.password) return toast.error("Password is required");
              if (resetForm.password !== resetForm.confirm) return toast.error("Passwords do not match");
              await s.patch("admins", resetTarget.id, { password: resetForm.password, forcePasswordChange: false });
              toast.success("Password reset successfully");
              setResetPasswordOpen(false);
              setResetTarget(null);
              setResetForm({ password: "", confirm: "", showPw: false });
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit ? "Edit" : "Create"} User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Basic Info */}
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</p>

              <div>
                <Label>Role <span className="text-destructive">*</span></Label>
                <Select value={form.role} onValueChange={(v) => setForm(p => ({ ...p, role: v as Admin["role"] | "", clusterId: v === "Cluster Admin" ? p.clusterId : "" }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input className="mt-1" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" />
              </div>

              <div>
                <Label>Email ID <span className="text-destructive">*</span></Label>
                <Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
                <p className="text-xs text-muted-foreground mt-1">Used as Login ID</p>
              </div>
            </div>

            {/* Password */}
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {edit ? "Change Password (leave blank to keep current)" : "Set Password"}
              </p>

              <div>
                <Label>{edit ? "New Password" : "Password"} {!edit && <span className="text-destructive">*</span>}</Label>
                <div className="relative mt-1">
                  <Input type={showPassword ? "text" : "password"} value={form.password}
                    onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder={edit ? "Leave blank to keep current" : "Enter password"} className="pr-10" />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label>Confirm Password {!edit && <span className="text-destructive">*</span>}</Label>
                <div className="relative mt-1">
                  <Input type={showConfirmPassword ? "text" : "password"} value={form.confirm}
                    onChange={(e) => setForm(p => ({ ...p, confirm: e.target.value }))}
                    placeholder="Confirm password" className="pr-10" />
                  <button type="button" onClick={() => setShowConfirmPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={form.forcePasswordChange} onCheckedChange={(v) => setForm(p => ({ ...p, forcePasswordChange: v }))} />
                <span className="text-sm">Force password change on first login</span>
              </div>
            </div>

            {/* Cluster Admin fields */}
            {isClusterAdmin && (
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cluster Admin Details</p>

                <div>
                  <Label>Cluster Assignment <span className="text-destructive">*</span></Label>
                  <Input className="mt-1 mb-2" placeholder="Search clusters..." value={clusterSearch} onChange={(e) => setClusterSearch(e.target.value)} />
                  <Select value={form.clusterId} onValueChange={(v) => setForm(p => ({ ...p, clusterId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select cluster" /></SelectTrigger>
                    <SelectContent>
                      {clusterOptions.length === 0
                        ? <SelectItem value="">No matching clusters</SelectItem>
                        : clusterOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>SPOC Name <span className="text-destructive">*</span></Label>
                  <Input className="mt-1" value={form.spocName} onChange={(e) => setForm(p => ({ ...p, spocName: e.target.value }))} placeholder="Single Point of Contact name" />
                </div>

                <div>
                  <Label>College Name <span className="text-destructive">*</span></Label>
                  <Input className="mt-1" value={form.college} onChange={(e) => setForm(p => ({ ...p, college: e.target.value }))} placeholder="Associated college" />
                </div>

                <div>
                  <Label>Mobile Number <span className="text-destructive">*</span></Label>
                  <Input className="mt-1" type="tel" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit mobile number" />
                </div>
              </div>
            )}

            {/* Active status */}
            <div className="flex items-center gap-2 px-1">
              <Switch checked={form.active} onCheckedChange={(v) => setForm(p => ({ ...p, active: v }))} />
              <span className="text-sm">Account Active</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View User Sheet ── */}
      <Sheet open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {view && (
            <>
              <SheetHeader><SheetTitle>{view.name}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Account Info</p>
                  <div className="flex justify-between"><span className="text-muted-foreground">Role</span><Badge variant={view.role === "Super Admin" ? "default" : "outline"}>{view.role}</Badge></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Email ID</span><span className="font-medium">{view.email || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span>{view.active ? <Badge className="bg-success text-success-foreground">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Force Pw Change</span><span>{view.forcePasswordChange ? "Yes" : "No"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Last Login</span><span>{view.lastLogin?.slice(0,10) || "—"}</span></div>
                </div>
                {view.role === "Cluster Admin" && (
                  <div className="rounded-lg border p-4 space-y-2 text-sm">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Cluster Admin Details</p>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cluster</span><span className="font-medium">{s.clusters.find(c => c.id === view.clusterId)?.name || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">College</span><span>{view.college || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Mobile</span><span>{view.phone || "—"}</span></div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
