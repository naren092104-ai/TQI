import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/layout/data-table";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { KpiCard } from "@/components/layout/kpi-card";
import { Plus, Pencil, Eye, Users, Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, MapPin, Trees, School as SchoolIcon, ChevronRight } from "lucide-react";
import { useStore, newId, type Student } from "@/lib/store";
import { useAuth, isAdmin } from "@/lib/auth";
import { toast } from "sonner";
import { downloadMock, toCSV } from "@/lib/format";

export const Route = createFileRoute("/students")({
  head: () => ({ meta: [{ title: "Students — TQI Admin" }] }),
  component: Page,
});

const STANDARDS = ["9", "10", "11", "12"] as const;

// Excel export helper (CSV with .xlsx extension for Excel compatibility)
function exportToExcel(rows: Student[], getChain: (id: string) => any) {
  const data = rows.map((st) => {
    const { sc, v, p, c } = getChain(st.schoolId);
    return {
      "Student Name": st.name,
      "Mobile Number": st.phone,
      "Standard": st.grade,
      "School": sc?.name ?? "—",
      "Village": v?.name ?? "—",
      "Panchayat": p?.name ?? "—",
      "Cluster": c?.name ?? "—",
      "Gender": st.gender === "M" ? "Male" : "Female",
      "Roll No": st.rollNo,
      "Status": st.status ?? "Active",
    };
  });
  downloadMock("students_export.csv", toCSV(data), "text/csv");
  toast.success(`Exported ${data.length} students to Excel`);
}

// Download blank template (only 3 columns needed)
function downloadTemplate() {
  const content = [
    "Student Name,Mobile Number,Standard",
    "Arun Kumar,9876543210,9",
    "Priya Devi,9876543211,10",
    "Ravi Shankar,9876543212,11",
    "Meena Kumari,9876543213,12",
  ].join("\n");
  downloadMock("students_template.csv", content, "text/csv");
  toast.success("Template downloaded — fill Student Name, Mobile Number, Standard only");
}

interface PreviewRow {
  name: string;
  phone: string;
  grade: string;
  valid: boolean;
  error?: string;
}

function Page() {
  const s = useStore();
  const { user } = useAuth();
  const canManage = !!(user && isAdmin(user.role));

  // ── Individual Add Dialog ──
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<Student | null>(null);
  // Hierarchy selectors for add form
  const [addPanchayat, setAddPanchayat] = useState("");
  const [addVillage, setAddVillage] = useState("");
  const [addSchool, setAddSchool] = useState("");
  const [addForm, setAddForm] = useState({ name: "", phone: "", grade: "" });

  // ── Bulk Upload Dialog (multi-step) ──
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState(1); // 1=hierarchy, 2=upload, 3=preview, 4=result
  const [bulkPanchayat, setBulkPanchayat] = useState("");
  const [bulkVillage, setBulkVillage] = useState("");
  const [bulkSchool, setBulkSchool] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importResult, setImportResult] = useState({ imported: 0, failed: 0, duplicates: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  // ── View Sheet ──
  const [view, setView] = useState<Student | null>(null);

  // ── Filters ──
  const [filterCluster, setFilterCluster] = useState("all");
  const [filterPanchayat, setFilterPanchayat] = useState("all");
  const [filterVillage, setFilterVillage] = useState("all");
  const [filterSchool, setFilterSchool] = useState("all");
  const [filterGrade, setFilterGrade] = useState("all");

  // ── Helpers ──
  const chain = (schoolId: string) => {
    const sc = s.schools.find(x => x.id === schoolId);
    const v = s.villages.find(x => x.id === sc?.villageId);
    const p = s.panchayats.find(x => x.id === v?.panchayatId);
    const c = s.clusters.find(x => x.id === p?.clusterId);
    return { sc, v, p, c };
  };

  // Cascading options for add form
  const addVillages = useMemo(() =>
    addPanchayat ? s.villages.filter(v => v.panchayatId === addPanchayat) : [],
    [s.villages, addPanchayat]);
  const addSchools = useMemo(() =>
    addVillage ? s.schools.filter(sc => sc.villageId === addVillage) : [],
    [s.schools, addVillage]);

  // Cascading options for bulk
  const bulkVillages = useMemo(() =>
    bulkPanchayat ? s.villages.filter(v => v.panchayatId === bulkPanchayat) : [],
    [s.villages, bulkPanchayat]);
  const bulkSchools = useMemo(() =>
    bulkVillage ? s.schools.filter(sc => sc.villageId === bulkVillage) : [],
    [s.schools, bulkVillage]);

  // Filter villages/schools for table filters
  const filteredVillages = useMemo(() =>
    filterPanchayat !== "all" ? s.villages.filter(v => v.panchayatId === filterPanchayat) : s.villages,
    [s.villages, filterPanchayat]);
  const filteredSchoolsForFilter = useMemo(() =>
    filterVillage !== "all" ? s.schools.filter(sc => sc.villageId === filterVillage)
      : filterPanchayat !== "all" ? s.schools.filter(sc => filteredVillages.some(v => v.id === sc.villageId))
      : s.schools,
    [s.schools, filterVillage, filterPanchayat, filteredVillages]);

  // Filtered rows
  const rows = useMemo(() => {
    let r = s.students;
    if (filterCluster !== "all") {
      r = r.filter(st => st.clusterId === filterCluster || chain(st.schoolId).c?.id === filterCluster);
    }
    if (filterPanchayat !== "all") {
      const vIds = s.villages.filter(v => v.panchayatId === filterPanchayat).map(v => v.id);
      const scIds = s.schools.filter(sc => vIds.includes(sc.villageId)).map(sc => sc.id);
      r = r.filter(st => scIds.includes(st.schoolId));
    }
    if (filterVillage !== "all") {
      const scIds = s.schools.filter(sc => sc.villageId === filterVillage).map(sc => sc.id);
      r = r.filter(st => scIds.includes(st.schoolId));
    }
    if (filterSchool !== "all") r = r.filter(st => st.schoolId === filterSchool);
    if (filterGrade !== "all") r = r.filter(st => st.grade === filterGrade);
    return r;
  }, [s.students, s.villages, s.schools, s.panchayats, s.clusters, filterCluster, filterPanchayat, filterVillage, filterSchool, filterGrade]);

  // ── Individual Save ──
  const saveStudent = async () => {
    if (!addForm.name.trim()) return toast.error("Student name is required");
    if (!addForm.phone.trim()) return toast.error("Mobile number is required");
    if (!addSchool) return toast.error("Please select a school");
    if (!addForm.grade) return toast.error("Standard is required");
    const { v, p, c } = chain(addSchool);
    try {
      await s.upsert("students", {
        id: edit?.id ?? newId(),
        name: addForm.name,
        phone: addForm.phone,
        grade: addForm.grade,
        schoolId: addSchool,
        villageId: v?.id ?? "",
        panchayatId: p?.id ?? "",
        clusterId: c?.id ?? "",
        rollNo: edit?.rollNo ?? "",
        gender: edit?.gender ?? "M",
        guardian: edit?.guardian ?? "",
        status: "Active",
      } as any);
      toast.success(edit ? "Student updated" : "Student added");
      setAddOpen(false);
      setEdit(null);
      setAddPanchayat(""); setAddVillage(""); setAddSchool("");
      setAddForm({ name: "", phone: "", grade: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save student");
    }
  };

  const openCreate = () => {
    setEdit(null);
    setAddPanchayat(""); setAddVillage(""); setAddSchool("");
    setAddForm({ name: "", phone: "", grade: "" });
    setAddOpen(true);
  };

  const openEdit = (st: Student) => {
    setEdit(st);
    const { sc, v, p } = chain(st.schoolId);
    setAddPanchayat(p?.id ?? "");
    setAddVillage(v?.id ?? "");
    setAddSchool(sc?.id ?? "");
    setAddForm({ name: st.name, phone: st.phone, grade: st.grade });
    setAddOpen(true);
  };

  // ── Bulk Upload: Parse CSV ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return toast.error("File is empty or has no data rows");
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes("name"));
      const phoneIdx = headers.findIndex(h => h.includes("mobile") || h.includes("phone"));
      const gradeIdx = headers.findIndex(h => h.includes("standard") || h.includes("grade"));
      if (nameIdx === -1 || phoneIdx === -1 || gradeIdx === -1)
        return toast.error("CSV must have columns: Student Name, Mobile Number, Standard");
      const existingPhones = new Set(s.students.map(st => st.phone));
      const parsed: PreviewRow[] = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim());
        const name = cols[nameIdx] ?? "";
        const phone = cols[phoneIdx] ?? "";
        const grade = cols[gradeIdx] ?? "";
        let error = "";
        if (!name) error = "Name missing";
        else if (!phone || !/^\d{10}$/.test(phone)) error = "Invalid mobile (10 digits required)";
        else if (!["9","10","11","12"].includes(grade)) error = "Invalid standard (9/10/11/12 only)";
        else if (existingPhones.has(phone)) error = "Duplicate mobile number";
        return { name, phone, grade, valid: !error, error };
      });
      setPreviewRows(parsed);
      setBulkStep(3);
    };
    reader.readAsText(file);
  };

  // ── Bulk Import: Commit ──
  const commitImport = () => {
    if (!bulkSchool) return toast.error("No school selected");
    const { v, p, c } = chain(bulkSchool);
    const valid = previewRows.filter(r => r.valid);
    const duplicates = previewRows.filter(r => r.error?.includes("Duplicate")).length;
    const failed = previewRows.filter(r => !r.valid && !r.error?.includes("Duplicate")).length;
    valid.forEach(row => {
      s.upsert("students", {
        id: newId(), name: row.name, phone: row.phone, grade: row.grade,
        schoolId: bulkSchool, villageId: v?.id ?? "", panchayatId: p?.id ?? "",
        clusterId: c?.id ?? "", rollNo: "", gender: "M", guardian: "", status: "Active",
      } as any);
    });
    setImportResult({ imported: valid.length, failed, duplicates });
    setBulkStep(4);
  };

  const resetBulk = () => {
    setBulkStep(1); setBulkPanchayat(""); setBulkVillage(""); setBulkSchool("");
    setPreviewRows([]); setImportResult({ imported: 0, failed: 0, duplicates: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  // Resolved names for bulk
  const bulkPanchayatName = s.panchayats.find(p => p.id === bulkPanchayat)?.name ?? "";
  const bulkVillageName = s.villages.find(v => v.id === bulkVillage)?.name ?? "";
  const bulkSchoolName = s.schools.find(sc => sc.id === bulkSchool)?.name ?? "";
  const bulkClusterName = bulkSchool ? chain(bulkSchool).c?.name ?? "" : "";

  return (
    <AppShell>
      <PageHeader
        title="Students"
        description="Hierarchy-first student management — select Panchayat → Village → School, then add or bulk import."
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> Download Template
              </Button>
              <Button variant="outline" onClick={() => exportToExcel(rows, chain)}>
                <FileSpreadsheet className="h-4 w-4" /> Export Excel
              </Button>
              <Button variant="outline" onClick={() => { resetBulk(); setBulkOpen(true); }}>
                <Upload className="h-4 w-4" /> Bulk Upload
              </Button>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add Student
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* KPI Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Students" value={s.students.length} icon={Users} tone="primary" />
        <KpiCard label="Boys" value={s.students.filter(x => x.gender === "M").length} icon={Users} tone="info" />
        <KpiCard label="Girls" value={s.students.filter(x => x.gender === "F").length} icon={Users} tone="secondary" />
        <KpiCard label="Schools" value={new Set(s.students.map(x => x.schoolId)).size} icon={Users} tone="success" />
      </div>

      {/* Cluster summary cards — click to filter */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {s.clusters.map((c) => {
          const count = s.students.filter(st =>
            st.clusterId === c.id || chain(st.schoolId).c?.id === c.id
          ).length;
          const active = filterCluster === c.id;
          return (
            <button
              key={c.id}
              onClick={() => { setFilterCluster(active ? "all" : c.id); setFilterPanchayat("all"); setFilterVillage("all"); setFilterSchool("all"); }}
              className={`group flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              <div className="min-w-0">
                <div className={`truncate text-sm font-semibold ${active ? "text-primary-foreground" : "text-foreground"}`}>{c.name}</div>
                <div className={`text-xs mt-0.5 ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{count} student{count !== 1 ? "s" : ""}</div>
              </div>
              <div className={`ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base font-bold ${
                active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
              }`}>
                {count}
              </div>
            </button>
          );
        })}
      </div>

      {/* Table with cascade filters */}
      <DataTable
        exportName="students" rows={rows} searchKeys={["name", "phone", "rollNo"] as any}
        filterBar={
          <div className="flex flex-wrap gap-2">
            <Select value={filterCluster} onValueChange={(v) => { setFilterCluster(v); setFilterPanchayat("all"); setFilterVillage("all"); setFilterSchool("all"); }}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Cluster" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clusters</SelectItem>
                {s.clusters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPanchayat} onValueChange={(v) => { setFilterPanchayat(v); setFilterVillage("all"); setFilterSchool("all"); }}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Panchayat" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Panchayats</SelectItem>
                {s.panchayats.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterVillage} onValueChange={(v) => { setFilterVillage(v); setFilterSchool("all"); }}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Village" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Villages</SelectItem>
                {filteredVillages.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSchool} onValueChange={setFilterSchool}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder="School" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schools</SelectItem>
                {filteredSchoolsForFilter.map(sc => <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Standard" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Standards</SelectItem>
                {STANDARDS.map(g => <SelectItem key={g} value={g}>Std {g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
        columns={[
          { key: "name", header: "Student Name", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "phone", header: "Mobile Number" },
          { key: "grade", header: "Standard", render: (r) => <Badge variant="outline">Std {r.grade}</Badge> },
          { key: "school", header: "School", render: (r) => <span className="text-sm">{chain(r.schoolId).sc?.name ?? "—"}</span> },
          { key: "village", header: "Village", render: (r) => <span className="text-sm text-muted-foreground">{chain(r.schoolId).v?.name ?? "—"}</span> },
          { key: "panchayat", header: "Panchayat", render: (r) => <span className="text-sm text-muted-foreground">{chain(r.schoolId).p?.name ?? "—"}</span> },
          { key: "cluster", header: "Cluster", render: (r) => {
            const c = chain(r.schoolId).c;
            return c ? (
              <button
                onClick={() => { setFilterCluster(c.id); setFilterPanchayat("all"); setFilterVillage("all"); setFilterSchool("all"); }}
                className="rounded px-1.5 py-0.5 text-sm font-medium text-primary underline-offset-2 hover:underline focus:outline-none"
                title={`Filter by ${c.name}`}
              >
                {c.name}
              </button>
            ) : <span className="text-sm text-muted-foreground">—</span>;
          } },

          {
            key: "_act", header: "", className: "text-right", render: (r) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView(r)}><Eye className="h-4 w-4" /></Button>
                {canManage && (
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <ConfirmDelete onConfirm={() => { s.remove("students", r.id); toast.success("Deleted"); }} />
                  </>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* ── Individual Add / Edit Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{edit ? "Edit Student" : "Add Student"}</DialogTitle>
            <DialogDescription>Select hierarchy first, then enter student details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Step 1: Hierarchy */}
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Step 1 — Select Hierarchy</p>
              <div>
                <Label>Panchayat <span className="text-destructive">*</span></Label>
                <Select value={addPanchayat} onValueChange={(v) => { setAddPanchayat(v); setAddVillage(""); setAddSchool(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select Panchayat" /></SelectTrigger>
                  <SelectContent>{s.panchayats.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Village <span className="text-destructive">*</span></Label>
                <Select value={addVillage} onValueChange={(v) => { setAddVillage(v); setAddSchool(""); }} disabled={!addPanchayat}>
                  <SelectTrigger><SelectValue placeholder="Select Village" /></SelectTrigger>
                  <SelectContent>{addVillages.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>School <span className="text-destructive">*</span></Label>
                <Select value={addSchool} onValueChange={setAddSchool} disabled={!addVillage}>
                  <SelectTrigger><SelectValue placeholder="Select School" /></SelectTrigger>
                  <SelectContent>{addSchools.map(sc => <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {addSchool && (() => {
                const { v, p, c } = chain(addSchool);
                return (
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Badge variant="secondary">📍 {p?.name}</Badge>
                    <Badge variant="secondary">🌳 {v?.name}</Badge>
                    <Badge variant="secondary">🏫 {s.schools.find(sc => sc.id === addSchool)?.name}</Badge>
                    <Badge variant="outline">🗂 {c?.name}</Badge>
                  </div>
                );
              })()}
            </div>
            {/* Step 2: Student Details */}
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Step 2 — Student Details</p>
              <div>
                <Label>Student Name <span className="text-destructive">*</span></Label>
                <Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="Full name" />
              </div>
              <div>
                <Label>Mobile Number <span className="text-destructive">*</span></Label>
                <Input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} placeholder="10-digit mobile" />
              </div>
              <div>
                <Label>Standard <span className="text-destructive">*</span></Label>
                <Select value={addForm.grade} onValueChange={(v) => setAddForm({ ...addForm, grade: v })}>
                  <SelectTrigger><SelectValue placeholder="Select standard" /></SelectTrigger>
                  <SelectContent>{STANDARDS.map(g => <SelectItem key={g} value={g}>Standard {g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={saveStudent} disabled={!addSchool}>Save Student</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Upload Dialog (multi-step) ── */}
      <Dialog open={bulkOpen} onOpenChange={(o) => { if (!o) resetBulk(); setBulkOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Upload Students</DialogTitle>
            <DialogDescription>
              Step {bulkStep} of 4 — {["Select Hierarchy", "Upload Excel", "Preview & Validate", "Import Result"][bulkStep - 1]}
            </DialogDescription>
          </DialogHeader>

          {/* Step progress */}
          <div className="flex items-center gap-1 mb-2">
            {[1,2,3,4].map((n) => (
              <div key={n} className="flex items-center gap-1 flex-1">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${bulkStep >= n ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30 text-muted-foreground"}`}>{n}</div>
                {n < 4 && <div className={`h-0.5 flex-1 ${bulkStep > n ? "bg-primary" : "bg-muted-foreground/20"}`} />}
              </div>
            ))}
          </div>

          {/* STEP 1 — Hierarchy Selection */}
          {bulkStep === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                <p className="text-sm font-semibold">Select the hierarchy for all students in this upload</p>
                <div>
                  <Label>Panchayat <span className="text-destructive">*</span></Label>
                  <Select value={bulkPanchayat} onValueChange={(v) => { setBulkPanchayat(v); setBulkVillage(""); setBulkSchool(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select Panchayat" /></SelectTrigger>
                    <SelectContent>{s.panchayats.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Village <span className="text-destructive">*</span></Label>
                  <Select value={bulkVillage} onValueChange={(v) => { setBulkVillage(v); setBulkSchool(""); }} disabled={!bulkPanchayat}>
                    <SelectTrigger><SelectValue placeholder="Select Village" /></SelectTrigger>
                    <SelectContent>{bulkVillages.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>School <span className="text-destructive">*</span></Label>
                  <Select value={bulkSchool} onValueChange={setBulkSchool} disabled={!bulkVillage}>
                    <SelectTrigger><SelectValue placeholder="Select School" /></SelectTrigger>
                    <SelectContent>{bulkSchools.map(sc => <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {bulkSchool && (
                  <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm space-y-1">
                    <p className="font-semibold text-primary">All uploaded students will be assigned to:</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <span className="text-muted-foreground">Panchayat:</span><span className="font-medium">{bulkPanchayatName}</span>
                      <span className="text-muted-foreground">Village:</span><span className="font-medium">{bulkVillageName}</span>
                      <span className="text-muted-foreground">School:</span><span className="font-medium">{bulkSchoolName}</span>
                      <span className="text-muted-foreground">Cluster:</span><span className="font-medium">{bulkClusterName}</span>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
                <Button onClick={() => setBulkStep(2)} disabled={!bulkSchool}>Next <ChevronRight className="h-4 w-4" /></Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 2 — Upload Excel */}
          {bulkStep === 2 && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/40 border border-border p-3 text-xs space-y-1">
                <p className="font-semibold">Selected Hierarchy:</p>
                <p>Panchayat: <b>{bulkPanchayatName}</b> &nbsp;|&nbsp; Village: <b>{bulkVillageName}</b> &nbsp;|&nbsp; School: <b>{bulkSchoolName}</b></p>
              </div>
              <div className="rounded-lg border-2 border-dashed border-border p-8 text-center space-y-3">
                <FileSpreadsheet className="mx-auto h-10 w-10 text-primary/40" />
                <div>
                  <p className="text-sm font-medium">Upload your Excel / CSV file</p>
                  <p className="text-xs text-muted-foreground mt-1">Only 3 columns needed: Student Name, Mobile Number, Standard</p>
                  <p className="text-xs text-destructive mt-1">Do NOT include Panchayat, Village, School — system auto-assigns</p>
                </div>
                <Input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="max-w-xs mx-auto" onChange={handleFileUpload} />
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs font-semibold mb-2">Excel Template Format:</p>
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-muted-foreground/10">{["Student Name","Mobile Number","Standard"].map(h => <th key={h} className="border border-border px-2 py-1 text-left font-semibold">{h}</th>)}</tr></thead>
                  <tbody>{[["Arun Kumar","9876543210","9"],["Priya Devi","9876543211","10"],["Ravi Shankar","9876543212","11"]].map((row, i) => (
                    <tr key={i}>{row.map((c, j) => <td key={j} className="border border-border px-2 py-1">{c}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkStep(1)}>Back</Button>
                <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4" /> Download Template</Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 3 — Preview */}
          {bulkStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{previewRows.length}</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Valid</p><p className="text-2xl font-bold text-green-600">{previewRows.filter(r => r.valid).length}</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Invalid</p><p className="text-2xl font-bold text-red-600">{previewRows.filter(r => !r.valid && !r.error?.includes("Duplicate")).length}</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Duplicates</p><p className="text-2xl font-bold text-yellow-600">{previewRows.filter(r => r.error?.includes("Duplicate")).length}</p></CardContent></Card>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted"><tr>{["Student Name","Mobile","Standard","School","Status"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className={`border-t border-border ${!row.valid ? "bg-red-50" : "bg-green-50/30"}`}>
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2">{row.phone}</td>
                        <td className="px-3 py-2">{row.grade}</td>
                        <td className="px-3 py-2 text-muted-foreground">{bulkSchoolName}</td>
                        <td className="px-3 py-2">
                          {row.valid
                            ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" /> Valid</span>
                            : <span className="flex items-center gap-1 text-red-600"><XCircle className="h-3 w-3" /> {row.error}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setBulkStep(2); if (fileRef.current) fileRef.current.value = ""; }}>Back</Button>
                <Button onClick={commitImport} disabled={previewRows.filter(r => r.valid).length === 0}>
                  Import {previewRows.filter(r => r.valid).length} Students
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 4 — Result */}
          {bulkStep === 4 && (
            <div className="space-y-4 text-center py-4">
              <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
              <h3 className="text-xl font-bold">Import Complete!</h3>
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Imported</p><p className="text-3xl font-bold text-green-600">{importResult.imported}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Failed</p><p className="text-3xl font-bold text-red-600">{importResult.failed}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Duplicates</p><p className="text-3xl font-bold text-yellow-600">{importResult.duplicates}</p></CardContent></Card>
              </div>
              <p className="text-sm text-muted-foreground">Assigned to: <b>{bulkSchoolName}</b>, <b>{bulkVillageName}</b>, <b>{bulkPanchayatName}</b></p>
              <DialogFooter className="justify-center">
                <Button variant="outline" onClick={resetBulk}>Import More</Button>
                <Button onClick={() => { resetBulk(); setBulkOpen(false); }}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── View Sheet ── */}
      <Sheet open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {view && (() => {
            const { sc, v, p, c } = chain(view.schoolId);
            return (
              <>
                <SheetHeader><SheetTitle>{view.name}</SheetTitle></SheetHeader>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><div className="text-xs text-muted-foreground">Standard</div><b>Std {view.grade}</b></div>
                    <div><div className="text-xs text-muted-foreground">Mobile</div><b>{view.phone}</b></div>
                    <div><div className="text-xs text-muted-foreground">Gender</div><b>{view.gender === "M" ? "Male" : "Female"}</b></div>
                    <div><div className="text-xs text-muted-foreground">Status</div><Badge variant="outline">{view.status || "Active"}</Badge></div>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-xs space-y-1.5">
                    <div className="font-semibold mb-2">Hierarchy</div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cluster</span><span className="font-medium">{c?.name ?? "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Panchayat</span><span className="font-medium">{p?.name ?? "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Village</span><span className="font-medium">{v?.name ?? "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">School</span><span className="font-medium">{sc?.name ?? "—"}</span></div>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-xs space-y-2">
                    <div className="font-semibold mb-1">Performance</div>
                    <div><div className="flex justify-between mb-1"><span>Attendance %</span><span className="font-bold">—</span></div><Progress value={0} className="h-1.5" /></div>
                    <div><div className="flex justify-between mb-1"><span>Homework %</span><span className="font-bold">—</span></div><Progress value={0} className="h-1.5" /></div>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
