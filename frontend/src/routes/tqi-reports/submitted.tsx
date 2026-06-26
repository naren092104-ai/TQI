import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Eye, Download, ImageIcon, Search, ChevronRight,
  FileText, Calendar, User, CheckCircle2, Clock, Filter,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore, type TqiReport } from "@/lib/store";
import { useAuth, isClusterAdmin, isSuperAdmin } from "@/lib/auth";
import { printTqiReport } from "@/lib/tqi-report-pdf";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tqi-reports/submitted")({
  head: () => ({ meta: [{ title: "Submitted Reports — TQI" }] }),
  component: Page,
});

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium",
        status === "Submitted"
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      )}
    >
      {status === "Submitted" ? (
        <CheckCircle2 className="mr-1 h-3 w-3" />
      ) : (
        <Clock className="mr-1 h-3 w-3" />
      )}
      {status}
    </Badge>
  );
}

function ReportCard({ report, onView, onDownload }: {
  report: TqiReport;
  onView: () => void;
  onDownload: () => void;
}) {
  return (
    <Card className="shadow-card hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">Day {report.day}</span>
              <StatusBadge status={report.status} />
              {(report.photos?.length ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ImageIcon className="h-3 w-3" />
                  {report.photos.length}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-sm font-medium">{report.sessionName || "—"}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {report.date ? new Date(report.date).toLocaleDateString("en-IN") : "—"}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {report.submittedBy || "—"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
              <span>Students: {(report.studentsPresent ?? 0) + (report.studentsAbsent ?? 0)}</span>
              <span>Present: {report.studentsPresent ?? 0}</span>
              <span>Volunteers: {report.totalVolunteers ?? 0}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onView} title="View report">
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDownload} title="Download PDF">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Cluster group panel (Super Admin view) ──────────────────────────────────
function ClusterGroup({
  clusterName,
  reports,
  onView,
  onDownload,
}: {
  clusterName: string;
  reports: TqiReport[];
  onView: (r: TqiReport) => void;
  onDownload: (r: TqiReport) => void;
}) {
  const [open, setOpen] = useState(false);
  const dayGroups = useMemo(() => {
    const map = new Map<number, TqiReport[]>();
    for (const r of reports) {
      const day = r.day ?? 0;
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [reports]);

  return (
    <Card className="shadow-card">
      <CardHeader
        className="cursor-pointer select-none p-4"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">{clusterName}</CardTitle>
            <Badge variant="secondary" className="text-xs">{reports.length} reports</Badge>
          </div>
          <ChevronRight
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")}
          />
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 pb-4 px-4 space-y-3">
          {dayGroups.map(([day, dayReports]) => (
            <div key={day}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Day {day}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {dayReports.map((r) => (
                  <ReportCard
                    key={r.id}
                    report={r}
                    onView={() => onView(r)}
                    onDownload={() => onDownload(r)}
                  />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function Page() {
  const s = useStore();
  const { user } = useAuth();
  const nav = useNavigate();
  const isCA = isClusterAdmin(user?.role);
  const isSA = isSuperAdmin(user?.role);

  const [search, setSearch] = useState("");
  const [filterCluster, setFilterCluster] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewReport, setViewReport] = useState<TqiReport | null>(null);

  const allReports = (s.tqiReports ?? []) as TqiReport[];

  // Scope to cluster for cluster admins
  const scopedReports = isCA
    ? allReports.filter((r) => r.clusterId === user?.clusterId)
    : allReports;

  // Apply filters
  const filtered = useMemo(() => {
    let result = scopedReports;
    if (filterCluster !== "all") result = result.filter((r) => r.clusterName === filterCluster);
    if (filterStatus !== "all") result = result.filter((r) => r.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.sessionName?.toLowerCase().includes(q) ||
          r.clusterName?.toLowerCase().includes(q) ||
          r.spocName?.toLowerCase().includes(q) ||
          r.submittedBy?.toLowerCase().includes(q) ||
          String(r.day).includes(q)
      );
    }
    return result;
  }, [scopedReports, filterCluster, filterStatus, search]);

  // Cluster names for filter dropdown (super admin)
  const clusterNames = useMemo(() => {
    const names = new Set(allReports.map((r) => r.clusterName).filter(Boolean));
    return Array.from(names).sort();
  }, [allReports]);

  // Group by cluster for super admin view
  const clusterGroups = useMemo(() => {
    if (isCA) return null;
    const map = new Map<string, TqiReport[]>();
    for (const r of filtered) {
      const name = r.clusterName || "Unknown";
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, isCA]);

  const handleDownload = (report: TqiReport) => {
    const ok = printTqiReport(report);
    if (!ok) toast.error("Could not open PDF. Check your popup blocker.");
    else toast.success("PDF generated");
  };

  const handleView = (report: TqiReport) => setViewReport(report);

  return (
    <AppShell>
      <PageHeader
        title="Submitted Reports"
        description={
          isSA
            ? "View reports from all clusters."
            : "Your submitted and draft reports."
        }
        actions={
          isCA ? (
            <Link to="/tqi-reports/create">
              <Button size="sm">
                <FileText className="h-4 w-4" /> Create Report
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* ── FILTERS ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports…"
            className="h-9 pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isSA && (
          <Select value={filterCluster} onValueChange={setFilterCluster}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="All Clusters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clusters</SelectItem>
              {clusterNames.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Submitted">Submitted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── RESULTS COUNT ───────────────────────────────────────────────── */}
      <div className="mb-3 text-xs text-muted-foreground">
        {filtered.length} report{filtered.length !== 1 ? "s" : ""} found
      </div>

      {/* ── EMPTY STATE ─────────────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No reports found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isCA ? "Create your first report to get started." : "No reports have been submitted yet."}
            </p>
            {isCA && (
              <Link to="/tqi-reports/create" className="mt-4">
                <Button size="sm">Create Report</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── SUPER ADMIN VIEW — grouped by cluster ───────────────────────── */}
      {isSA && clusterGroups && clusterGroups.length > 0 && (
        <div className="space-y-3">
          {clusterGroups.map(([clusterName, reports]) => (
            <ClusterGroup
              key={clusterName}
              clusterName={clusterName}
              reports={reports}
              onView={handleView}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* ── CLUSTER ADMIN VIEW — flat list ──────────────────────────────── */}
      {isCA && filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              onView={() => handleView(r)}
              onDownload={() => handleDownload(r)}
            />
          ))}
        </div>
      )}

      {/* ── REPORT VIEWER MODAL ─────────────────────────────────────────── */}
      {viewReport && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setViewReport(null)}
        >
          <div className="relative my-4 w-full max-w-3xl rounded-xl bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h2 className="font-bold">
                  {viewReport.clusterName} — Day {viewReport.day}
                </h2>
                <p className="text-sm text-muted-foreground">{viewReport.sessionName}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleDownload(viewReport)}>
                  <Download className="h-4 w-4" /> PDF
                </Button>
                {isCA && viewReport.status !== "Submitted" && (
                  <Link to="/tqi-reports/create" search={{ editId: viewReport.id }}>
                    <Button size="sm" variant="outline">Edit</Button>
                  </Link>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewReport(null)}>
                  <Search className="h-4 w-4 rotate-45" />
                </Button>
              </div>
            </div>

            <div className="space-y-4 p-5 text-sm">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 text-xs">
                {[
                  ["Cluster", viewReport.clusterName],
                  ["College", viewReport.collegeName],
                  ["SPOC", viewReport.spocName],
                  ["Session", viewReport.sessionName],
                  ["Day", `Day ${viewReport.day}`],
                  ["Date", viewReport.date ? new Date(viewReport.date).toLocaleDateString("en-IN") : "—"],
                  ["Academic Year", viewReport.academicYear],
                  ["Status", viewReport.status],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span className="font-semibold text-muted-foreground">{label}:</span>{" "}
                    {value || "—"}
                  </div>
                ))}
              </div>

              {/* Participation */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  ["Students Present", viewReport.studentsPresent],
                  ["Students Absent", viewReport.studentsAbsent],
                  ["Volunteers", viewReport.totalVolunteers],
                  ["Beneficiaries", viewReport.beneficiaries],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg border border-border p-3 text-center">
                    <div className="text-lg font-bold">{value ?? 0}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>

              {/* Sections */}
              {[
                ["Session Objective", viewReport.sessionObjective],
                ["Activities Conducted", viewReport.activitiesConducted],
                ["Key Learning Outcomes", viewReport.keyLearningOutcomes],
                ["Challenges Faced", viewReport.challengesFaced],
                ["Solutions Provided", viewReport.solutionsProvided],
                ["Future Action Plan", viewReport.futureActionPlan],
                ["Remarks", viewReport.remarks],
              ].map(([label, value]) =>
                value ? (
                  <div key={label as string}>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </div>
                    <div className="rounded border border-border p-3 text-sm whitespace-pre-wrap">
                      {value}
                    </div>
                  </div>
                ) : null
              )}

              {/* Photos */}
              {(viewReport.photos?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Photos ({viewReport.photos.length})
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {viewReport.photos.map((photo, i) => (
                      <div key={photo.id} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                        <img
                          src={photo.localUrl || photo.url}
                          alt={`Photo ${i + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
                          {i + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
