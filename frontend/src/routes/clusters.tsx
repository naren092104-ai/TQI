import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/layout/data-table";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { KpiCard } from "@/components/layout/kpi-card";
import { Plus, Pencil, Eye, Network, MapPin, Trees, School as SchoolIcon, Users, ChevronRight, Building2 } from "lucide-react";
import { useStore, newId, type Cluster, type Panchayat, type Village, type Admin } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/clusters")({
  head: () => ({ meta: [{ title: "Clusters — TQI Admin" }] }),
  component: Clusters,
});

type PanchayatSetup = { name: string; villagesCount: number; villageNames: string[]; villageSchools: { [key: number]: string[] } };

type ClusterWizardForm = { name: string; district: string; status: string };

type AdminWizardForm = { name: string; mobile: string; email: string; username: string; password: string; confirm: string };

type PanchayatForm = { name: string; head: string };

type VillageForm = { name: string; panchayatId: string; population: number };

type ClusterEditForm = { name: string; district: string; status: string };

type AdminEditForm = { name: string; email: string; username: string; phone: string };

function Clusters() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [view, setView] = useState<Cluster | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [clusterForm, setClusterForm] = useState<ClusterWizardForm>({ name: "", district: "", status: "Active" });
  const [adminForm, setAdminForm] = useState<AdminWizardForm>({ name: "", mobile: "", email: "", username: "", password: "", confirm: "" });
  const [panchayatCount, setPanchayatCount] = useState(0);
  const [panchayatsSetup, setPanchayatsSetup] = useState<PanchayatSetup[]>([]);

  const [clusterEditOpen, setClusterEditOpen] = useState(false);
  const [clusterEditForm, setClusterEditForm] = useState<ClusterEditForm>({ name: "", district: "", status: "Active" });
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [adminEditForm, setAdminEditForm] = useState<AdminEditForm>({ name: "", email: "", username: "", phone: "" });

  const [panchayatDialogOpen, setPanchayatDialogOpen] = useState(false);
  const [panchayatEdit, setPanchayatEdit] = useState<Panchayat | null>(null);
  const [panchayatForm, setPanchayatForm] = useState<PanchayatForm>({ name: "", head: "" });

  const [villageDialogOpen, setVillageDialogOpen] = useState(false);
  const [villageEdit, setVillageEdit] = useState<Village | null>(null);
  const [villageForm, setVillageForm] = useState<VillageForm>({ name: "", panchayatId: "", population: 1000 });

  const currentClusterAdmin = useMemo(() => view ? s.admins.find((a) => a.clusterId === view.id && a.role === "Cluster Admin") ?? null : null, [s.admins, view]);
  const clusterPanchayats = useMemo(() => view ? s.panchayats.filter((p) => p.clusterId === view.id) : [], [s.panchayats, view]);
  const clusterVillages = useMemo(() => clusterPanchayats.flatMap((p) => s.villages.filter((v) => v.panchayatId === p.id)), [s.villages, clusterPanchayats]);

  const openCreate = () => {
    setStep(1);
    setClusterForm({ name: "", district: "", status: "Active" });
    setAdminForm({ name: "", mobile: "", email: "", username: "", password: "", confirm: "" });
    setPanchayatCount(0);
    setPanchayatsSetup([]);
    setOpen(true);
  };

  const openView = (c: Cluster) => {
    setView(c);
  };

  const countFor = (cid: string) => {
    const p = s.panchayats.filter((x) => x.clusterId === cid);
    const v = s.villages.filter((x) => p.some((y) => y.id === x.panchayatId));
    const sc = s.schools.filter((x) => v.some((y) => y.id === x.villageId));
    const st = s.students.filter((x) => sc.some((y) => y.id === x.schoolId));
    const vl = s.volunteers.filter((x) => x.clusterId === cid);
    return { p: p.length, v: v.length, sc: sc.length, st: st.length, vl: vl.length };
  };

  const clusterAction = (cluster: Cluster) => {
    const isOpen = expanded[cluster.id];
    const ps = s.panchayats.filter((p) => p.clusterId === cluster.id);
    const cnt = countFor(cluster.id);
    return (
      <div key={cluster.id}>
        <button onClick={() => setExpanded({ ...expanded, [cluster.id]: !isOpen })} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
          <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          <Network className="h-4 w-4 text-primary" />
          <span className="font-medium">{cluster.name}</span>
          <Badge variant="outline" className="ml-auto text-[10px]">{cnt.p} pan · {cnt.v} vil · {cnt.sc} sch</Badge>
        </button>
        {isOpen && ps.map((p) => {
          const vs = s.villages.filter((v) => v.panchayatId === p.id);
          return (
            <div key={p.id} className="ml-6 border-l border-border pl-4">
              <div className="flex items-center gap-2 py-1 text-sm"><MapPin className="h-3.5 w-3.5 text-info" /> {p.name}</div>
              {vs.map((v) => {
                const schools = s.schools.filter((sc) => sc.villageId === v.id);
                return (
                  <div key={v.id} className="ml-6 border-l border-border pl-4">
                    <div className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground"><Trees className="h-3 w-3 text-success" /> {v.name}</div>
                    {schools.map((sc) => (
                      <div key={sc.id} className="ml-6 border-l border-border/50 pl-4 text-xs text-muted-foreground/70">
                        <div className="flex items-center gap-2 py-0.5"><Building2 className="h-2.5 w-2.5 text-secondary" /> {sc.name}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const generatePanchayats = (count: number) => {
    setPanchayatCount(count);
    setPanchayatsSetup((prev) => Array.from({ length: count }, (_, i) => {
      const existing = prev[i];
      return existing
        ? { ...existing, name: existing.name || `Panchayat ${i + 1}` }
        : { name: `Panchayat ${i + 1}`, villagesCount: 0, villageNames: [], villageSchools: {} };
    }));
  };

  const updatePanchayatName = (index: number, value: string) => {
    setPanchayatsSetup((prev) => prev.map((p, i) => i === index ? { ...p, name: value } : p));
  };

  const updatePanchayatVillageCount = (index: number, count: number) => {
    setPanchayatsSetup((prev) => prev.map((p, i) => {
      if (i !== index) return p;
      const names = Array.from({ length: count }, (_, j) => p.villageNames[j] ?? `Village ${j + 1}`);
      const schools = { ...p.villageSchools };
      for (let j = 0; j < count; j++) {
        if (!schools[j]) schools[j] = [];
      }
      return { ...p, villagesCount: count, villageNames: names, villageSchools: schools };
    }));
  };

  const updateVillageName = (pIndex: number, vIndex: number, value: string) => {
    setPanchayatsSetup((prev) => prev.map((p, i) => {
      if (i !== pIndex) return p;
      return { ...p, villageNames: p.villageNames.map((vn, j) => j === vIndex ? value : vn) };
    }));
  };

  const updateVillageSchoolCount = (pIndex: number, vIndex: number, count: number) => {
    setPanchayatsSetup((prev) => prev.map((p, i) => {
      if (i !== pIndex) return p;
      const schools = { ...p.villageSchools };
      schools[vIndex] = Array.from({ length: count }, (_, j) => schools[vIndex]?.[j] ?? `School ${j + 1}`);
      return { ...p, villageSchools: schools };
    }));
  };

  const updateVillageSchoolName = (pIndex: number, vIndex: number, sIndex: number, value: string) => {
    setPanchayatsSetup((prev) => prev.map((p, i) => {
      if (i !== pIndex) return p;
      const schools = { ...p.villageSchools };
      schools[vIndex] = schools[vIndex].map((s, j) => j === sIndex ? value : s);
      return { ...p, villageSchools: schools };
    }));
  };

  const openEditCluster = (cluster: Cluster) => {
    setClusterEditForm({ name: cluster.name, district: cluster.district, status: cluster.status });
    setView(cluster);
    setClusterEditOpen(true);
  };

  const saveClusterEdit = () => {
    if (!view) return;
    if (!clusterEditForm.name || !clusterEditForm.district || !clusterEditForm.status) {
      return toast.error("All fields required");
    }
    s.upsert("clusters", { ...view, ...clusterEditForm });
    setView({ ...view, ...clusterEditForm });
    toast.success("Cluster updated");
    setClusterEditOpen(false);
  };

  const openAdminEdit = () => {
    if (!view) return;
    const admin = currentClusterAdmin;
    setAdminEditForm({ name: admin?.name ?? "", email: admin?.email ?? "", username: admin?.username ?? "", phone: admin?.phone ?? "" });
    setAdminEditOpen(true);
  };

  const saveAdminEdit = () => {
    if (!view) return;
    if (!adminEditForm.name || !adminEditForm.email || !adminEditForm.username) {
      return toast.error("All admin fields are required");
    }
    const existingAdmin = currentClusterAdmin;
    if (existingAdmin) {
      s.patch("admins", existingAdmin.id, { ...existingAdmin, ...adminEditForm });
    } else {
      s.upsert("admins", {
        id: newId(),
        name: adminEditForm.name,
        email: adminEditForm.email,
        username: adminEditForm.username,
        phone: adminEditForm.phone,
        role: "Cluster Admin",
        active: true,
        lastLogin: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        clusterId: view.id,
      });
    }
    toast.success("Admin updated");
    setAdminEditOpen(false);
  };

  const openPanchayatDialog = (panchayat?: Panchayat) => {
    setPanchayatEdit(panchayat ?? null);
    setPanchayatForm({ name: panchayat?.name ?? "", head: panchayat?.head ?? "" });
    setPanchayatDialogOpen(true);
  };

  const savePanchayat = () => {
    if (!view) return;
    if (!panchayatForm.name) return toast.error("Name required");
    const payload = {
      id: panchayatEdit?.id ?? newId(),
      createdAt: panchayatEdit?.createdAt ?? new Date().toISOString(),
      name: panchayatForm.name,
      head: panchayatForm.head,
      clusterId: view.id,
    };
    s.upsert("panchayats", payload);
    toast.success(panchayatEdit ? "Panchayat updated" : "Panchayat created");
    setPanchayatDialogOpen(false);
  };

  const deletePanchayat = (panchayat: Panchayat) => {
    s.remove("panchayats", panchayat.id);
    s.villages.filter((v) => v.panchayatId === panchayat.id).forEach((v) => s.remove("villages", v.id));
    toast.success("Panchayat deleted");
  };

  const openVillageDialog = (village?: Village, panchayatId?: string) => {
    setVillageEdit(village ?? null);
    setVillageForm({ name: village?.name ?? "", panchayatId: village?.panchayatId ?? panchayatId ?? clusterPanchayats[0]?.id ?? "", population: village?.population ?? 1000 });
    setVillageDialogOpen(true);
  };

  const saveVillage = () => {
    if (!view) return;
    if (!villageForm.name || !villageForm.panchayatId) return toast.error("Name and Panchayat required");
    s.upsert("villages", {
      id: villageEdit?.id ?? newId(),
      createdAt: villageEdit?.createdAt ?? new Date().toISOString(),
      name: villageForm.name,
      panchayatId: villageForm.panchayatId,
      population: villageForm.population,
    });
    toast.success(villageEdit ? "Village updated" : "Village created");
    setVillageDialogOpen(false);
  };

  const deleteVillage = (village: Village) => {
    s.remove("villages", village.id);
    toast.success("Village deleted");
  };

  const handleWizardNext = () => {
    if (step === 1) {
      if (!clusterForm.name || !clusterForm.district || !clusterForm.status) return toast.error("Cluster information is required");
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!adminForm.name || !adminForm.mobile || !adminForm.email || !adminForm.username || !adminForm.password || !adminForm.confirm) return toast.error("Admin information is required");
      if (adminForm.password !== adminForm.confirm) return toast.error("Passwords do not match");
      setStep(3);
      return;
    }
    if (step === 3) {
      if (panchayatsSetup.length === 0) return toast.error("Add at least one Panchayat");
      if (panchayatsSetup.some((p) => !p.name.trim())) return toast.error("All Panchayat names are required");
      setStep(4);
      return;
    }
    if (step === 4) {
      if (panchayatsSetup.some((p) => p.villagesCount < 1)) return toast.error("Each Panchayat needs at least one Village");
      if (panchayatsSetup.some((p) => p.villageNames.some((vn) => !vn.trim()))) return toast.error("All Village names are required");
      if (panchayatsSetup.some((p) => Object.keys(p.villageSchools).some((v) => (p.villageSchools[Number(v)]?.length ?? 0) === 0))) return toast.error("Each Village needs at least one School");
      if (panchayatsSetup.some((p) => Object.keys(p.villageSchools).some((v) => p.villageSchools[Number(v)].some((sn) => !sn.trim())))) return toast.error("All School names are required");
      setStep(5);
      return;
    }
  };

  const createCluster = () => {
    if (!clusterForm.name || !clusterForm.district || !clusterForm.status) return toast.error("Cluster information is required");
    if (!adminForm.name || !adminForm.mobile || !adminForm.email || !adminForm.username || !adminForm.password || !adminForm.confirm) return toast.error("Admin information is required");
    if (adminForm.password !== adminForm.confirm) return toast.error("Passwords do not match");
    if (panchayatsSetup.length === 0) return toast.error("Add at least one Panchayat");
    if (panchayatsSetup.some((p) => !p.name.trim())) return toast.error("All Panchayat names are required");
    if (panchayatsSetup.some((p) => p.villagesCount < 1)) return toast.error("Each Panchayat needs at least one Village count");
    if (panchayatsSetup.some((p) => p.villageNames.some((vn) => !vn.trim()))) return toast.error("All Village names are required");
    if (panchayatsSetup.some((p) => Object.keys(p.villageSchools).some((v) => (p.villageSchools[Number(v)]?.length ?? 0) === 0))) return toast.error("Each Village needs at least one School");
    if (panchayatsSetup.some((p) => Object.keys(p.villageSchools).some((v) => p.villageSchools[Number(v)].some((sn) => !sn.trim())))) return toast.error("All School names are required");

    const clusterId = newId();
    const cluster = {
      id: clusterId,
      createdAt: new Date().toISOString(),
      name: clusterForm.name,
      code: `CL${(s.clusters.length + 1).toString().padStart(3, "0")}`,
      state: "Karnataka",
      district: clusterForm.district,
      status: clusterForm.status,
      lead: adminForm.name,
    } as Cluster;

    s.upsert("clusters", cluster);
    s.upsert("admins", {
      id: newId(),
      name: adminForm.name,
      email: adminForm.email,
      username: adminForm.username,
      password: adminForm.password,
      phone: adminForm.mobile,
      role: "Cluster Admin",
      active: true,
      lastLogin: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      clusterId,
    });

    panchayatsSetup.forEach((p) => {
      const pId = newId();
      s.upsert("panchayats", { id: pId, createdAt: new Date().toISOString(), name: p.name, clusterId, head: "" });
      p.villageNames.forEach((vName, vIndex) => {
        const vId = newId();
        s.upsert("villages", { id: vId, createdAt: new Date().toISOString(), name: vName, panchayatId: pId, population: 1000 });
        // Save schools for this village
        (p.villageSchools[vIndex] || []).forEach((schoolName) => {
          s.upsert("schools", { id: newId(), createdAt: new Date().toISOString(), name: schoolName, villageId: vId, principal: "", population: 0 });
        });
      });
    });

    toast.success("Cluster created");
    setOpen(false);
    setStep(1);
    setClusterForm({ name: "", district: "", status: "Active" });
    setAdminForm({ name: "", mobile: "", email: "", username: "", password: "", confirm: "" });
    setPanchayatCount(0);
    setPanchayatsSetup([]);
    setView(cluster);
  };

  return (
    <AppShell>
      <PageHeader title="Clusters" description="Top-level geographic groupings. Create a cluster with Panchayats and Villages together." actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Create Cluster</Button>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Total Panchayats" value={s.panchayats.length} icon={MapPin} tone="primary" />
        <KpiCard label="Total Villages" value={s.villages.length} icon={Trees} tone="success" />
        <KpiCard label="Total Schools" value={s.schools.length} icon={SchoolIcon} tone="secondary" />
        <KpiCard label="Total Students" value={s.students.length} icon={Users} tone="info" />
        <KpiCard label="Total Volunteers" value={s.volunteers.length} icon={Users} tone="warning" />
      </div>

      <Card className="mb-6 shadow-card">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Network className="h-4 w-4 text-primary" /> Organization Hierarchy</div>
          <div className="space-y-1">
            {s.clusters.map((cluster) => clusterAction(cluster))}
          </div>
        </CardContent>
      </Card>

      <DataTable
        exportName="clusters"
        rows={s.clusters}
        searchKeys={["name", "code", "lead"]}
        columns={[
          { key: "code", header: "Code", render: (r) => <Badge variant="outline">{r.code}</Badge> },
          { key: "name", header: "Cluster", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "district", header: "District", render: (r) => r.district || "—" },
          { key: "lead", header: "Lead" },
          { key: "_stats", header: "Reach", render: (r) => {
            const c = countFor(r.id);
            return <span className="text-xs text-muted-foreground">{c.p}P · {c.v}V · {c.sc}S · {c.st}St</span>;
          } },
          { key: "_act", header: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openView(r)}><Eye className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCluster(r)}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => { s.remove("clusters", r.id); toast.success("Deleted"); }} />
            </div>
          ) },
        ]}
      />

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {step === 1 && "Cluster Information"}
              {step === 2 && "Cluster Admin Creation"}
              {step === 3 && "Panchayats"}
              {step === 4 && "Villages"}
              {step === 5 && "Review"}
            </DialogTitle>
          </DialogHeader>

          {step === 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Cluster Name</Label><Input value={clusterForm.name} onChange={(e) => setClusterForm({ ...clusterForm, name: e.target.value })} /></div>
              <div><Label>District Name</Label><Input value={clusterForm.district} onChange={(e) => setClusterForm({ ...clusterForm, district: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={clusterForm.status} onValueChange={(value) => setClusterForm({ ...clusterForm, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Admin Name</Label><Input value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} /></div>
              <div><Label>Mobile Number</Label><Input value={adminForm.mobile} onChange={(e) => setAdminForm({ ...adminForm, mobile: e.target.value })} /></div>
              <div><Label>Email ID</Label><Input value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} /></div>
              <div><Label>Username</Label><Input value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} /></div>
              <div><Label>Password</Label><Input type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} /></div>
              <div><Label>Confirm Password</Label><Input type="password" value={adminForm.confirm} onChange={(e) => setAdminForm({ ...adminForm, confirm: e.target.value })} /></div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label>How many Panchayats are there in this Cluster?</Label>
                <Input type="number" min={0} value={panchayatCount || ""} onChange={(e) => generatePanchayats(Number(e.target.value) || 0)} />
              </div>
              {panchayatsSetup.length > 0 && (
                <div className="space-y-3">
                  {panchayatsSetup.map((p, index) => (
                    <div key={index} className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>{`Panchayat ${index + 1}`}</Label>
                        <Input value={p.name} onChange={(e) => updatePanchayatName(index, e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {panchayatsSetup.map((p, pIndex) => (
                <div key={pIndex} className="rounded-lg border border-border p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-sm font-medium">{p.name || `Panchayat ${pIndex + 1}`}</div>
                      <div className="text-xs text-muted-foreground">How many Villages are there?</div>
                    </div>
                    <div className="w-full sm:w-44">
                      <Label>Number of Villages</Label>
                      <Input type="number" min={0} value={p.villagesCount || ""} onChange={(e) => updatePanchayatVillageCount(pIndex, Number(e.target.value) || 0)} />
                    </div>
                  </div>
                  {p.villageNames.length > 0 && (
                    <div className="space-y-4">
                      {p.villageNames.map((name, villageIndex) => (
                        <div key={villageIndex} className="rounded-lg border border-border/50 bg-accent/20 p-3">
                          <Label>{`Village ${villageIndex + 1}`}</Label>
                          <Input value={name} onChange={(e) => updateVillageName(pIndex, villageIndex, e.target.value)} className="mb-3" />
                          
                          <div className="mb-2">
                            <Label className="text-xs">Number of Schools in {name || `Village ${villageIndex + 1}`}</Label>
                            <Input type="number" min={0} value={(p.villageSchools[villageIndex]?.length || 0)} onChange={(e) => updateVillageSchoolCount(pIndex, villageIndex, Number(e.target.value) || 0)} />
                          </div>
                          
                          {(p.villageSchools[villageIndex]?.length ?? 0) > 0 && (
                            <div className="space-y-2 border-t border-border/50 pt-3">
                              {p.villageSchools[villageIndex].map((school, schoolIndex) => (
                                <div key={schoolIndex}>
                                  <Label className="text-xs">{`School ${schoolIndex + 1}`}</Label>
                                  <Input value={school} onChange={(e) => updateVillageSchoolName(pIndex, villageIndex, schoolIndex, e.target.value)} size={35} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted p-4">
                  <div className="text-xs uppercase text-muted-foreground">Cluster</div>
                  <div className="mt-2 text-sm font-semibold">{clusterForm.name}</div>
                  <div className="text-sm text-muted-foreground">{clusterForm.district}</div>
                  <div className="text-sm text-muted-foreground">{clusterForm.status}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted p-4">
                  <div className="text-xs uppercase text-muted-foreground">Admin</div>
                  <div className="mt-2 text-sm font-semibold">{adminForm.name}</div>
                  <div className="text-sm text-muted-foreground">Username: {adminForm.username}</div>
                  <div className="text-sm text-muted-foreground">{adminForm.email}</div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted p-4">
                <div className="text-sm font-semibold">Review hierarchy</div>
                <div className="mt-3 space-y-3">
                  {panchayatsSetup.map((p, index) => (
                    <div key={index}>
                      <div className="font-medium">{p.name}</div>
                      <div className="ml-4 space-y-2">
                        {p.villageNames.map((vn, vi) => (
                          <div key={vi}>
                            <div className="text-sm text-muted-foreground">{vn}</div>
                            {(p.villageSchools[vi]?.length ?? 0) > 0 && (
                              <div className="ml-4 space-y-1">
                                {p.villageSchools[vi].map((sn, si) => (
                                  <div key={si} className="text-xs text-muted-foreground">{sn}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                if (step === 1) { setOpen(false); return; }
                setStep((prev) => Math.max(1, prev - 1));
              }}>
                {step === 1 ? "Cancel" : "Back"}
              </Button>
            </div>
            <div className="flex gap-2">
              {step < 5 ? (
                <Button onClick={handleWizardNext}>{step === 4 ? "Next" : "Next"}</Button>
              ) : (
                <Button onClick={createCluster}>Create Cluster</Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <SheetContent className="w-full sm:max-w-2xl">
          {view && (
            <>
              <SheetHeader>
                <SheetTitle>{view.name}</SheetTitle>
              </SheetHeader>

              <div className="space-y-5 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted p-4">
                    <div className="text-xs uppercase text-muted-foreground">Cluster Information</div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div><span className="text-muted-foreground">Name:</span> {view.name}</div>
                      <div><span className="text-muted-foreground">District:</span> {view.district}</div>
                      <div><span className="text-muted-foreground">Status:</span> {view.status}</div>
                      <div><span className="text-muted-foreground">Lead:</span> {view.lead}</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-4">
                    <div className="text-xs uppercase text-muted-foreground">Admin Information</div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div><span className="text-muted-foreground">Name:</span> {currentClusterAdmin?.name ?? "—"}</div>
                      <div><span className="text-muted-foreground">Username:</span> {currentClusterAdmin?.username ?? "—"}</div>
                      <div><span className="text-muted-foreground">Email:</span> {currentClusterAdmin?.email ?? "—"}</div>
                      <div><span className="text-muted-foreground">Mobile:</span> {currentClusterAdmin?.phone ?? "—"}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <KpiCard label="Total Panchayats" value={clusterPanchayats.length} icon={MapPin} tone="primary" />
                  <KpiCard label="Total Villages" value={clusterVillages.length} icon={Trees} tone="success" />
                  <KpiCard label="Total Schools" value={countFor(view.id).sc} icon={SchoolIcon} tone="secondary" />
                  <KpiCard label="Total Students" value={countFor(view.id).st} icon={Users} tone="info" />
                  <KpiCard label="Total Volunteers" value={countFor(view.id).vl} icon={Users} tone="warning" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => openEditCluster(view)}>Edit Cluster</Button>
                  <Button variant="outline" onClick={openAdminEdit}>Edit Admin</Button>
                  <Button onClick={() => openPanchayatDialog()}>Add Panchayat</Button>
                  <Button variant="outline" onClick={() => openVillageDialog(undefined, clusterPanchayats[0]?.id)} disabled={clusterPanchayats.length === 0}>Add Village</Button>
                </div>

                <div className="rounded-lg border border-border bg-muted p-4">
                  <div className="mb-4 text-sm font-semibold">Expandable Tree View</div>
                  <div className="space-y-3">
                    {clusterPanchayats.map((p) => {
                      const isOpen = expanded[p.id];
                      const villages = s.villages.filter((v) => v.panchayatId === p.id);
                      return (
                        <div key={p.id} className="space-y-2 rounded-md border border-border bg-background p-3">
                          <button onClick={() => setExpanded({ ...expanded, [p.id]: !isOpen })} className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                              {p.name}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openPanchayatDialog(p); }}><Pencil className="h-3.5 w-3.5" /></Button>
                              <ConfirmDelete onConfirm={() => deletePanchayat(p)} />
                            </div>
                          </button>
                          {isOpen && (
                            <div className="space-y-2 pl-6">
                              {villages.map((v) => (
                                <div key={v.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted p-3 text-sm">
                                  <div>{v.name}</div>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openVillageDialog(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                                    <ConfirmDelete onConfirm={() => deleteVillage(v)} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={clusterEditOpen} onOpenChange={setClusterEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Cluster</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Name</Label><Input value={clusterEditForm.name} onChange={(e) => setClusterEditForm({ ...clusterEditForm, name: e.target.value })} /></div>
            <div><Label>District</Label><Input value={clusterEditForm.district} onChange={(e) => setClusterEditForm({ ...clusterEditForm, district: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={clusterEditForm.status} onValueChange={(value) => setClusterEditForm({ ...clusterEditForm, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setClusterEditOpen(false)}>Cancel</Button><Button onClick={saveClusterEdit}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adminEditOpen} onOpenChange={setAdminEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Admin</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Name</Label><Input value={adminEditForm.name} onChange={(e) => setAdminEditForm({ ...adminEditForm, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={adminEditForm.email} onChange={(e) => setAdminEditForm({ ...adminEditForm, email: e.target.value })} /></div>
            <div><Label>Username</Label><Input value={adminEditForm.username} onChange={(e) => setAdminEditForm({ ...adminEditForm, username: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Mobile</Label><Input value={adminEditForm.phone} onChange={(e) => setAdminEditForm({ ...adminEditForm, phone: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdminEditOpen(false)}>Cancel</Button><Button onClick={saveAdminEdit}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={panchayatDialogOpen} onOpenChange={setPanchayatDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{panchayatEdit ? "Edit Panchayat" : "Add Panchayat"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name</Label><Input value={panchayatForm.name} onChange={(e) => setPanchayatForm({ ...panchayatForm, name: e.target.value })} /></div>
            <div><Label>Head</Label><Input value={panchayatForm.head} onChange={(e) => setPanchayatForm({ ...panchayatForm, head: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPanchayatDialogOpen(false)}>Cancel</Button><Button onClick={savePanchayat}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={villageDialogOpen} onOpenChange={setVillageDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{villageEdit ? "Edit Village" : "Add Village"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Panchayat</Label>
              <Select value={villageForm.panchayatId} onValueChange={(value) => setVillageForm({ ...villageForm, panchayatId: value })}>
                <SelectTrigger><SelectValue placeholder="Select Panchayat" /></SelectTrigger>
                <SelectContent>
                  {clusterPanchayats.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Name</Label><Input value={villageForm.name} onChange={(e) => setVillageForm({ ...villageForm, name: e.target.value })} /></div>
            <div><Label>Population</Label><Input type="number" value={villageForm.population} onChange={(e) => setVillageForm({ ...villageForm, population: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setVillageDialogOpen(false)}>Cancel</Button><Button onClick={saveVillage}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
