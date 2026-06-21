import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/layout/data-table";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { KpiCard } from "@/components/layout/kpi-card";
import { Plus, Pencil, Eye, Users, Upload, Download, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useStore, newId, type Student } from "@/lib/store";
import { useAuth, isAdmin, isVolunteer } from "@/lib/auth";
import { toast } from "sonner";
import { downloadMock, toCSV } from "@/lib/format";

export const Route = createFileRoute("/students")({
  head: () => ({ meta: [{ title: "Students — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const s = useStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Student | null>(null);
  const [form, setForm] = useState({ 
    name: "", 
    rollNo: "", 
    schoolId: "", 
    grade: "5", 
    gender: "M" as Student["gender"], 
    guardian: "", 
    phone: "",
    dob: "",
    parentName: "",
    parentPhone: "",
    address: "",
    status: "Active"
  });
  const [view, setView] = useState<Student | null>(null);
  const [filterSchool, setFilterSchool] = useState("all");
  const [importOpen, setImportOpen] = useState(false);

  const canManageStudents = user && isAdmin(user.role);
  const isVolunteerRole = user && isVolunteer(user.role);

  const openCreate = () => { 
    if (!canManageStudents) {
      toast.error("Only admins can create students");
      return;
    }
    setEdit(null); 
    setForm({ name: "", rollNo: "", schoolId: "", grade: "5", gender: "M", guardian: "", phone: "", dob: "", parentName: "", parentPhone: "", address: "", status: "Active" }); 
    setOpen(true); 
  };
  
  const openEdit = (st: Student) => { 
    if (!canManageStudents) {
      toast.error("Only admins can edit students");
      return;
    }
    setEdit(st); 
    setForm(st); 
    setOpen(true); 
  };
  
  const save = () => {
    if (!form.name || !form.schoolId) return toast.error("Required");
    s.upsert("students", { id: edit?.id ?? newId(), ...form } as any);
    toast.success("Saved"); 
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!canManageStudents) {
      toast.error("Only admins can delete students");
      return;
    }
    s.remove("students", id);
    toast.success("Deleted");
  };

  const rows = useMemo(() => filterSchool === "all" ? s.students : s.students.filter(x => x.schoolId === filterSchool), [s.students, filterSchool]);
  const schoolName = (id: string) => s.schools.find(x => x.id === id)?.name ?? "—";
  const chain = (id: string) => {
    const sc = s.schools.find(x => x.id === id);
    const v = s.villages.find(x => x.id === sc?.villageId);
    const p = s.panchayats.find(x => x.id === v?.panchayatId);
    const c = s.clusters.find(x => x.id === p?.clusterId);
    return { sc, v, p, c };
  };

  return (
    <AppShell>
      <PageHeader title="Students" description="Auto-fills village → panchayat → cluster from the selected school." actions={
        <>
          {isVolunteerRole && (
            <Alert className="mb-4 border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Volunteers can view students and mark attendance only. You cannot create, edit, or delete students.
              </AlertDescription>
            </Alert>
          )}
          {canManageStudents && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Bulk Import</Button>
              <Button variant="outline" onClick={() => downloadMock("students.csv", toCSV(s.students as any), "text/csv")}><Download className="h-4 w-4" /> Bulk Export</Button>
            </>
          )}
          {canManageStudents && <Button onClick={openCreate}><Plus className="h-4 w-4" /> Create Student</Button>}
        </>
      } />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Students" value={s.students.length} icon={Users} tone="primary" />
        <KpiCard label="Boys" value={s.students.filter(x=>x.gender==="M").length} icon={Users} tone="info" />
        <KpiCard label="Girls" value={s.students.filter(x=>x.gender==="F").length} icon={Users} tone="secondary" />
        <KpiCard label="Schools" value={new Set(s.students.map(x=>x.schoolId)).size} icon={Users} tone="success" />
      </div>
      <DataTable
        exportName="students" rows={rows} searchKeys={["name","rollNo","guardian"]}
        filterBar={
          <Select value={filterSchool} onValueChange={setFilterSchool}>
            <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All schools</SelectItem>
              {s.schools.map(sc => <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        columns={[
          { key: "rollNo", header: "Roll" },
          { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "grade", header: "Grade", render: (r) => <Badge variant="outline">{r.grade}</Badge> },
          { key: "gender", header: "Gender" },
          { key: "school", header: "School", render: (r) => <span className="truncate">{schoolName(r.schoolId)}</span> },
          { key: "_act", header: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView(r)}><Eye className="h-4 w-4" /></Button>
              {canManageStudents && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <ConfirmDelete onConfirm={() => handleDelete(r.id)} />
                </>
              )}
            </div>
          ) },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Create"} Student</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 max-h-96 overflow-y-auto">
            <div className="sm:col-span-2">
              <Label>School (auto-fills hierarchy)</Label>
              <Select value={form.schoolId} onValueChange={(v) => setForm({ ...form, schoolId: v })}>
                <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>{s.schools.map(sc => <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>)}</SelectContent>
              </Select>
              {form.schoolId && (() => {
                const { v, p, c } = chain(form.schoolId);
                return <div className="mt-2 flex flex-wrap gap-1 text-xs"><Badge variant="outline">{c?.name}</Badge><Badge variant="outline">{p?.name}</Badge><Badge variant="outline">{v?.name}</Badge></div>;
              })()}
            </div>
            <div><Label>Roll No</Label><Input value={form.rollNo} onChange={(e) => setForm({ ...form, rollNo: e.target.value })} /></div>
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Grade</Label><Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></div>
            <div><Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as Student["gender"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="M">Male</SelectItem><SelectItem value="F">Female</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Date of Birth</Label><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
            <div><Label>Parent Name</Label><Input value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} /></div>
            <div><Label>Parent Phone</Label><Input value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} /></div>
            <div><Label>Guardian</Label><Input value={form.guardian} onChange={(e) => setForm({ ...form, guardian: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Status</Label>
              <Select value={form.status || "Active"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Transferred">Transferred</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Import Students</DialogTitle><DialogDescription>Upload a CSV with columns: name, rollNo, grade, gender, guardian, phone, schoolId, parentName, parentPhone, dob, address, status</DialogDescription></DialogHeader>
          <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <div className="mt-2 text-sm">Drop CSV or click to browse</div>
            <Input type="file" accept=".csv" className="mt-3" onChange={() => { toast.success("Imported 12 students"); setImportOpen(false); }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => downloadMock("template.csv", "name,rollNo,grade,gender,guardian,phone,schoolId,parentName,parentPhone,dob,address,status\n", "text/csv")}>Download template</Button>
            <Button onClick={() => setImportOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {view && (() => {
            const { sc, v, p, c } = chain(view.schoolId);
            return (
              <>
                <SheetHeader><SheetTitle>{view.name}</SheetTitle></SheetHeader>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><div className="text-xs text-muted-foreground">Roll</div><b>{view.rollNo}</b></div>
                    <div><div className="text-xs text-muted-foreground">Grade</div><b>{view.grade}</b></div>
                    <div><div className="text-xs text-muted-foreground">Gender</div><b>{view.gender}</b></div>
                    <div><div className="text-xs text-muted-foreground">Status</div><b>{view.status || "—"}</b></div>
                  </div>
                  {view.dob && <div><span className="text-xs text-muted-foreground">Date of Birth: </span><b>{view.dob}</b></div>}
                  <div className="rounded-lg border border-border p-3 text-xs">
                    <div className="mb-2 font-semibold">Hierarchy</div>
                    <div className="text-muted-foreground">Cluster:</div><div className="font-medium">{c?.name}</div>
                    <div className="mt-1 text-muted-foreground">Panchayat:</div><div className="font-medium">{p?.name}</div>
                    <div className="mt-1 text-muted-foreground">Village:</div><div className="font-medium">{v?.name}</div>
                    <div className="mt-1 text-muted-foreground">School:</div><div className="font-medium">{sc?.name}</div>
                  </div>
                  <div><span className="text-xs text-muted-foreground">Parent: </span>{view.parentName || "—"}</div>
                  <div><span className="text-xs text-muted-foreground">Parent Phone: </span>{view.parentPhone || "—"}</div>
                  <div><span className="text-xs text-muted-foreground">Guardian: </span>{view.guardian}</div>
                  <div><span className="text-xs text-muted-foreground">Phone: </span>{view.phone}</div>
                  {view.address && <div><span className="text-xs text-muted-foreground">Address: </span>{view.address}</div>}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
