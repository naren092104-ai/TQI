import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/layout/data-table";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { KpiCard } from "@/components/layout/kpi-card";
import { Plus, Pencil, Eye, HeartHandshake, Upload, Download } from "lucide-react";
import { useStore, newId, type Volunteer } from "@/lib/store";
import { useAuth, isClusterAdmin } from "@/lib/auth";
import { toast } from "sonner";
import { downloadMock, toCSV } from "@/lib/format";

export const Route = createFileRoute("/volunteers")({
  head: () => ({ meta: [{ title: "Volunteers — TQI Admin" }] }),
  component: Page,
});

// Year field: dropdown only, no manual typing
const YEAR_OPTIONS = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
] as const;

function yearLabel(val?: string) {
  return YEAR_OPTIONS.find(y => y.value === val)?.label ?? val ?? "—";
}

const blankForm = () => ({
  name: "",
  email: "",
  phone: "",
  clusterId: "",
  skill: "",
  college: "",
  department: "",
  year: "" as string,
  address: "",
  sessions: 0,
});

function Page() {
  const s = useStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Volunteer | null>(null);
  const [form, setForm] = useState(blankForm());
  const [view, setView] = useState<Volunteer | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [filterCluster, setFilterCluster] = useState("all");
  const [filterYear, setFilterYear] = useState("all");

  const openCreate = () => {
    setEdit(null);
    setForm({ ...blankForm(), clusterId: isClusterAdmin(user?.role) ? (user?.clusterId ?? s.clusters[0]?.id ?? "") : (s.clusters[0]?.id ?? "") });
    setOpen(true);
  };

  const openEdit = (v: Volunteer) => {
    setEdit(v);
    setForm({
      name: v.name,
      email: v.email,
      phone: v.phone,
      clusterId: v.clusterId,
      skill: v.skill,
      college: v.college ?? "",
      department: v.department ?? "",
      year: v.year ?? "",
      address: v.address ?? "",
      sessions: v.sessions,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Volunteer name is required");
    if (!form.phone.trim()) return toast.error("Mobile number is required");
    if (!form.college.trim()) return toast.error("College is required");
    if (!form.department.trim()) return toast.error("Department is required");
    if (!form.year) return toast.error("Year is required");
    if (!["1","2","3","4"].includes(form.year)) return toast.error("Invalid year value");
    try {
      await s.upsert("volunteers", { id: edit?.id ?? newId(), ...form } as Volunteer);
      toast.success("Saved");
      setOpen(false);
    } catch {
      toast.error("Failed to save");
    }
  };

  const cName = (id: string) => s.clusters.find(c => c.id === id)?.name ?? "—";

  const rows = useMemo(() => {
    let r = s.volunteers;
    if (filterCluster !== "all") r = r.filter(v => v.clusterId === filterCluster);
    if (filterYear !== "all") r = r.filter(v => v.year === filterYear);
    return r;
  }, [s.volunteers, filterCluster, filterYear]);

  return (
    <AppShell>
      <PageHeader
        title="Volunteers"
        description="Trained volunteers running sessions. Year field is dropdown only."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Bulk Import</Button>
            <Button variant="outline" onClick={() => downloadMock("volunteers.csv", toCSV(s.volunteers as any), "text/csv")}><Download className="h-4 w-4" /> Export</Button>
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Create Volunteer</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Volunteers" value={s.volunteers.length} icon={HeartHandshake} tone="secondary" />
        <KpiCard label="Colleges" value={new Set(s.volunteers.map(v => v.college).filter(Boolean)).size} icon={HeartHandshake} tone="info" />
        <KpiCard label="Total Sessions" value={s.volunteers.reduce((a, b) => a + b.sessions, 0)} icon={HeartHandshake} tone="primary" />
        <KpiCard label="Avg Sessions" value={(s.volunteers.reduce((a, b) => a + b.sessions, 0) / Math.max(1, s.volunteers.length)).toFixed(1)} icon={HeartHandshake} tone="success" />
      </div>

      <DataTable
        exportName="volunteers"
        rows={rows}
        searchKeys={["name", "email", "college", "department"]}
        filterBar={
          <div className="flex gap-2">
            <Select value={filterCluster} onValueChange={setFilterCluster}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clusters</SelectItem>
                {s.clusters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {YEAR_OPTIONS.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
        columns={[
          { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "college", header: "College", render: (r) => r.college || "—" },
          { key: "department", header: "Department", render: (r) => r.department || "—" },
          { key: "year", header: "Year", render: (r) => r.year ? <Badge variant="outline">{yearLabel(r.year)}</Badge> : "—" },
          { key: "phone", header: "Mobile" },
          { key: "email", header: "Email" },
          { key: "cluster", header: "Cluster", render: (r) => cName(r.clusterId) },
          { key: "sessions", header: "Sessions", render: (r) => <Badge>{r.sessions}</Badge> },          {
            key: "_act", header: "", className: "text-right", render: (r) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView(r)}><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                <ConfirmDelete onConfirm={() => { s.remove("volunteers", r.id); toast.success("Deleted"); }} />
              </div>
            ),
          },
        ]}
      />

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{edit ? "Edit" : "Create"} Volunteer</DialogTitle>
            <DialogDescription>Year must be selected from dropdown. No manual typing allowed.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="sm:col-span-2">
              <Label>Volunteer Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
            </div>
            <div>
              <Label>College <span className="text-destructive">*</span></Label>
              <Input value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} placeholder="College name" />
            </div>
            <div>
              <Label>Department <span className="text-destructive">*</span></Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Computer Science" />
            </div>
            <div>
              <Label>Year <span className="text-destructive">*</span></Label>
              <Select value={form.year} onValueChange={(v) => setForm({ ...form, year: v })}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mobile Number <span className="text-destructive">*</span></Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" />
            </div>
            <div>
              <Label>Email ID</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
            </div>
            {!isClusterAdmin(user?.role) && (
            <div>
              <Label>Cluster</Label>
              <Select value={form.clusterId} onValueChange={(v) => setForm({ ...form, clusterId: v })}>
                <SelectTrigger><SelectValue placeholder="Select cluster" /></SelectTrigger>
                <SelectContent>
                  {s.clusters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            )}
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Import Volunteers</DialogTitle>
            <DialogDescription>
              Upload CSV: name, college, department, year, phone, email, address, clusterId, skill
              <br />
              <span className="text-destructive font-medium">Allowed Years: 1, 2, 3, 4 only. Other values will be rejected.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <div className="mt-2 text-sm font-medium">Drop CSV file here or click to browse</div>
            <Input
              type="file"
              accept=".csv"
              className="mt-3"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const text = ev.target?.result as string;
                  const lines = text.split("\n").filter(Boolean);
                  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
                  const yearIdx = headers.indexOf("year");
                  let invalid = 0;
                  const validRows = lines.slice(1).filter(line => {
                    const cols = line.split(",");
                    const year = cols[yearIdx]?.trim();
                    if (!["1","2","3","4"].includes(year)) { invalid++; return false; }
                    return true;
                  });
                  if (invalid > 0) toast.error(`${invalid} rows rejected: invalid Year values (only 1, 2, 3, 4 allowed)`);
                  if (validRows.length > 0) toast.success(`${validRows.length} volunteers imported successfully`);
                  setImportOpen(false);
                };
                reader.readAsText(file);
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => downloadMock(
                "volunteers_template.csv",
                "name,college,department,year,phone,email,address,clusterId,skill\nRavi Kumar,ABC College,Computer Science,2,9876543210,ravi@example.com,Chennai,cluster-id,Math\n",
                "text/csv"
              )}
            >
              Download Template
            </Button>
            <Button onClick={() => setImportOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Sheet */}
      <Sheet open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {view && (
            <>
              <SheetHeader>
                <SheetTitle>{view.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <div className="text-xs text-muted-foreground mb-1">College</div>
                    <div className="font-medium">{view.college || "—"}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <div className="text-xs text-muted-foreground mb-1">Department</div>
                    <div className="font-medium">{view.department || "—"}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <div className="text-xs text-muted-foreground mb-1">Year</div>
                    <div className="font-medium">{yearLabel(view.year)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <div className="text-xs text-muted-foreground mb-1">Mobile</div>
                    <div className="font-medium">{view.phone}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <div className="text-xs text-muted-foreground mb-1">Email</div>
                    <div className="font-medium truncate">{view.email || "—"}</div>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted p-3">
                  <div className="text-xs text-muted-foreground mb-1">Cluster</div>
                  <div className="font-medium">{cName(view.clusterId)}</div>
                </div>
                {view.address && (
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <div className="text-xs text-muted-foreground mb-1">Address</div>
                    <div className="font-medium">{view.address}</div>
                  </div>
                )}
                <div className="rounded-lg border border-border bg-muted p-3">
                  <div className="text-xs text-muted-foreground mb-2">Performance</div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium">Attendance %</span>
                        <span className="text-xs font-bold">75%</span>
                      </div>
                      <Progress value={75} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium">Sessions Taken</span>
                        <span className="text-xs font-bold">{view.sessions}</span>
                      </div>
                      <Progress value={Math.min(100, (view.sessions / 8) * 100)} className="h-1.5" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
