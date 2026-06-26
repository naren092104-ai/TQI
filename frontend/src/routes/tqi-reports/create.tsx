import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Save, Send, Upload, X, Eye, ArrowUpDown,
  ImagePlus, Trash2, Download, CheckCircle2, Clock,
  AlertCircle,
} from "lucide-react";
import { useStore, newId, type TqiReport, type ReportPhoto } from "@/lib/store";
import { useAuth, isClusterAdmin } from "@/lib/auth";
import {
  createTqiReport, updateTqiReport, uploadReportPhotos,
  deleteReportPhoto, reorderReportPhotos,
} from "@/lib/tqi-reports-api";
import { printTqiReport } from "@/lib/tqi-report-pdf";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tqi-reports/create")({
  validateSearch: (s: Record<string, unknown>) => ({ editId: s.editId as string | undefined }),
  head: () => ({ meta: [{ title: "Create Report — TQI" }] }),
  component: Page,
});

// ─── Blank form ──────────────────────────────────────────────────────────────
function blankReport(overrides?: Partial<TqiReport>): Omit<TqiReport, "id"> {
  return {
    clusterId: "",
    clusterName: "",
    collegeName: "",
    spocName: "",
    sessionId: "",
    sessionName: "",
    day: 1,
    date: new Date().toISOString().slice(0, 10),
    academicYear: "",
    sessionObjective: "",
    activitiesConducted: "",
    keyLearningOutcomes: "",
    studentsPresent: 0,
    studentsAbsent: 0,
    totalVolunteers: 0,
    beneficiaries: 0,
    studentParticipation: "",
    volunteerParticipation: "",
    challengesFaced: "",
    solutionsProvided: "",
    futureActionPlan: "",
    remarks: "",
    photos: [],
    status: "Draft",
    ...overrides,
  };
}

function PhotoCard({
  photo,
  index,
  total,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  photo: ReportPhoto;
  index: number;
  total: number;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const displayUrl = photo.localUrl || photo.url;

  return (
    <>
      <div className="group relative rounded-lg border border-border bg-card overflow-hidden">
        <div
          className="aspect-square cursor-pointer overflow-hidden bg-muted"
          onClick={() => setPreview(true)}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={photo.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="p-2">
          <p className="truncate text-xs font-medium">{photo.name || `Photo ${index + 1}`}</p>
          <div className="mt-1.5 flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setPreview(true)}
              title="Preview"
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              disabled={index === 0}
              onClick={onMoveUp}
              title="Move up"
            >
              <ArrowUpDown className="h-3 w-3 -rotate-90" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              disabled={index === total - 1}
              onClick={onMoveDown}
              title="Move down"
            >
              <ArrowUpDown className="h-3 w-3 rotate-90" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-destructive hover:bg-destructive/10"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          {index + 1}
        </div>
      </div>

      {/* Preview lightbox */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img
              src={displayUrl}
              alt={photo.name}
              className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg"
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute -right-2 -top-2 bg-white text-black hover:bg-gray-200 rounded-full h-8 w-8"
              onClick={() => setPreview(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">Drop photos here or click to browse</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Supports JPG, PNG, GIF &nbsp;·&nbsp; Min 1, Max 50 photos
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Works on mobile &amp; laptop
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="absolute inset-0 opacity-0 cursor-pointer"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).filter((f) =>
            f.type.startsWith("image/")
          );
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
function Page() {
  const s = useStore();
  const { user } = useAuth();
  const nav = useNavigate();
  const { editId } = Route.useSearch();

  const myClusterId = user?.clusterId ?? "";
  const myCluster = s.clusters.find((c) => c.id === myClusterId);
  const myCollege = s.colleges.find((c) => c.clusterId === myClusterId);
  const activeYear = s.academicYears.find((y) => y.active);
  const myAdmin = s.admins.find((a) => a.id === user?.id);

  // Sessions for this cluster
  const mySessions = s.sessions.filter((sess) => sess.clusterId === myClusterId);

  // Existing report being edited
  const existingReport = editId
    ? (s.tqiReports as TqiReport[]).find((r) => r.id === editId)
    : undefined;

  const [form, setForm] = useState<Omit<TqiReport, "id">>(() =>
    existingReport
      ? { ...existingReport }
      : blankReport({
          clusterId: myClusterId,
          clusterName: myCluster?.name ?? "",
          collegeName: myCollege?.name ?? "",
          spocName: myAdmin?.name ?? "",
          academicYear: activeYear?.name ?? "",
        })
  );

  const [reportId, setReportId] = useState<string>(existingReport?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [localPhotos, setLocalPhotos] = useState<ReportPhoto[]>(
    existingReport?.photos ?? []
  );

  // When editing session changes — prefill session fields
  const selectedSession = mySessions.find((sess) => sess.id === form.sessionId);
  useEffect(() => {
    if (selectedSession) {
      setForm((f) => ({
        ...f,
        sessionName: selectedSession.title,
        day: selectedSession.day,
        date: selectedSession.date ?? f.date,
      }));
    }
  }, [form.sessionId]);

  const set = (field: keyof typeof form, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  // ── Save Draft ──────────────────────────────────────────────────────────
  const handleSave = async (statusOverride?: "Draft" | "Submitted") => {
    const status = statusOverride ?? "Draft";
    setSaving(true);
    try {
      const payload: Partial<TqiReport> = {
        ...form,
        photos: localPhotos,
        status,
        submittedBy: user?.name ?? user?.email ?? "",
        ...(status === "Submitted" ? { submittedAt: new Date().toISOString() } : {}),
      };

      let saved: TqiReport;
      if (reportId) {
        saved = await updateTqiReport(reportId, payload);
      } else {
        saved = await createTqiReport({ id: newId(), ...payload });
        setReportId(saved.id);
      }

      // Update local photos from saved data
      setLocalPhotos(saved.photos ?? []);

      // Update Zustand store
      const current = s.tqiReports as TqiReport[];
      const idx = current.findIndex((r) => r.id === saved.id);
      const updated = [...current];
      if (idx >= 0) updated[idx] = saved; else updated.unshift(saved);
      useStore.setState({ tqiReports: updated as any });

      toast.success(status === "Submitted" ? "Report submitted!" : "Draft saved");
      if (status === "Submitted") {
        nav({ to: "/tqi-reports/submitted" });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save report");
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  // ── Photo Upload ──────────────────────────────────────────────────────────
  const handlePhotoFiles = useCallback(
    async (files: File[]) => {
      const remaining = 50 - localPhotos.length;
      if (remaining <= 0) {
        toast.error("Maximum 50 photos reached");
        return;
      }
      const toUpload = files.slice(0, remaining);

      // Create local preview entries immediately
      const previews: ReportPhoto[] = toUpload.map((f) => ({
        id: `local-${newId()}`,
        name: f.name,
        url: "",
        localUrl: URL.createObjectURL(f),
      }));
      setLocalPhotos((prev) => [...prev, ...previews]);

      if (!reportId) {
        // If report not yet saved, just keep local previews — photos will be uploaded on save
        toast.info("Photos will be uploaded when you save the report");
        return;
      }

      // Upload immediately if report exists
      setUploadingPhotos(true);
      try {
        const base64Items = await Promise.all(
          toUpload.map((file) =>
            new Promise<{ name: string; data: string; mimeType: string }>((resolve) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  name: file.name,
                  data: reader.result as string,
                  mimeType: file.type,
                });
              reader.readAsDataURL(file);
            })
          )
        );

        const result = await uploadReportPhotos(reportId, base64Items);
        // Replace local previews with server photos
        setLocalPhotos((prev) => {
          const withoutPreviews = prev.filter((p) => !p.id.startsWith("local-"));
          return [...withoutPreviews, ...result.photos.slice(-base64Items.length)];
        });

        // Sync store
        const current = s.tqiReports as TqiReport[];
        const idx = current.findIndex((r) => r.id === reportId);
        if (idx >= 0) {
          const updated = [...current];
          updated[idx] = { ...updated[idx], photos: result.photos };
          useStore.setState({ tqiReports: updated as any });
        }

        toast.success(`${result.added} photo(s) uploaded`);
      } catch (err: any) {
        // Remove failed previews
        setLocalPhotos((prev) => prev.filter((p) => !p.id.startsWith("local-")));
        toast.error(err?.message ?? "Photo upload failed");
      } finally {
        setUploadingPhotos(false);
      }
    },
    [reportId, localPhotos, s.tqiReports]
  );

  // ── Delete Photo ──────────────────────────────────────────────────────────
  const handleDeletePhoto = async (photo: ReportPhoto) => {
    // If local-only preview, just remove
    if (photo.id.startsWith("local-")) {
      if (photo.localUrl) URL.revokeObjectURL(photo.localUrl);
      setLocalPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      return;
    }
    if (!reportId) return;
    try {
      const result = await deleteReportPhoto(reportId, photo.id);
      setLocalPhotos(result.photos);
      const current = s.tqiReports as TqiReport[];
      const idx = current.findIndex((r) => r.id === reportId);
      if (idx >= 0) {
        const updated = [...current];
        updated[idx] = { ...updated[idx], photos: result.photos };
        useStore.setState({ tqiReports: updated as any });
      }
      toast.success("Photo deleted");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete photo");
    }
  };

  // ── Reorder Photos ────────────────────────────────────────────────────────
  const movePhoto = async (fromIdx: number, toIdx: number) => {
    const reordered = [...localPhotos];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setLocalPhotos(reordered);

    if (reportId) {
      try {
        await reorderReportPhotos(reportId, reordered.map((p) => p.id));
      } catch {
        // revert on failure
        setLocalPhotos(localPhotos);
        toast.error("Failed to reorder photos");
      }
    }
  };

  // ── Generate PDF ──────────────────────────────────────────────────────────
  const handlePdf = () => {
    const reportData: TqiReport = {
      id: reportId || "preview",
      ...form,
      photos: localPhotos,
    };
    const ok = printTqiReport(reportData);
    if (!ok) toast.error("Could not open PDF window. Check your popup blocker.");
    else toast.success("PDF generated");
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.sessionObjective.trim()) {
      toast.error("Session Objective is required");
      return;
    }
    if (!form.activitiesConducted.trim()) {
      toast.error("Activities Conducted is required");
      return;
    }
    if (localPhotos.length === 0) {
      toast.error("At least 1 photo is required before submitting");
      return;
    }
    setSubmitting(true);
    await handleSave("Submitted");
  };

  const isSubmitted = form.status === "Submitted";

  return (
    <AppShell>
      <PageHeader
        title={editId ? "Edit Report" : "Create Report"}
        description="Fill in the session details and upload photos."
        badge={form.status}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handlePdf}>
              <Download className="h-4 w-4" /> Generate PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={saving || isSubmitted}
              onClick={() => handleSave("Draft")}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              size="sm"
              disabled={submitting || isSubmitted}
              onClick={handleSubmit}
            >
              <Send className="h-4 w-4" />
              {submitting ? "Submitting…" : "Submit Report"}
            </Button>
          </div>
        }
      />

      {isSubmitted && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          This report has been submitted. Download the PDF or view submitted reports.
        </div>
      )}

      <div className="space-y-4">
        {/* ── HEADER INFO ─────────────────────────────────────────────────── */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Header Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label>Cluster Name</Label>
              <Input
                value={form.clusterName}
                onChange={(e) => set("clusterName", e.target.value)}
                placeholder="Cluster Name"
                disabled={isSubmitted}
              />
            </div>
            <div className="space-y-1">
              <Label>College Name</Label>
              <Input
                value={form.collegeName}
                onChange={(e) => set("collegeName", e.target.value)}
                placeholder="College Name"
                disabled={isSubmitted}
              />
            </div>
            <div className="space-y-1">
              <Label>SPOC Name</Label>
              <Input
                value={form.spocName}
                onChange={(e) => set("spocName", e.target.value)}
                placeholder="SPOC Name"
                disabled={isSubmitted}
              />
            </div>
            <div className="space-y-1">
              <Label>Session</Label>
              <Select
                value={form.sessionId ?? ""}
                onValueChange={(v) => set("sessionId", v)}
                disabled={isSubmitted}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {mySessions.map((sess) => (
                    <SelectItem key={sess.id} value={sess.id}>
                      Day {sess.day} — {sess.title}
                    </SelectItem>
                  ))}
                  <SelectItem value="manual">Enter manually</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Session Name</Label>
              <Input
                value={form.sessionName}
                onChange={(e) => set("sessionName", e.target.value)}
                placeholder="Session Name"
                disabled={isSubmitted}
              />
            </div>
            <div className="space-y-1">
              <Label>Day</Label>
              <Select
                value={String(form.day)}
                onValueChange={(v) => set("day", Number(v))}
                disabled={isSubmitted}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 8 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      Day {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                disabled={isSubmitted}
              />
            </div>
            <div className="space-y-1">
              <Label>Academic Year</Label>
              <Input
                value={form.academicYear}
                onChange={(e) => set("academicYear", e.target.value)}
                placeholder="e.g. 2025–2026"
                disabled={isSubmitted}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── REPORT CONTENT ───────────────────────────────────────────────── */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Report Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { field: "sessionObjective", label: "Session Objective" },
              { field: "activitiesConducted", label: "Activities Conducted" },
              { field: "keyLearningOutcomes", label: "Key Learning Outcomes" },
              { field: "studentParticipation", label: "Student Participation" },
              { field: "volunteerParticipation", label: "Volunteer Participation" },
              { field: "challengesFaced", label: "Challenges Faced" },
              { field: "solutionsProvided", label: "Solutions Provided" },
              { field: "futureActionPlan", label: "Future Action Plan" },
              { field: "remarks", label: "Remarks" },
            ].map(({ field, label }) => (
              <div key={field} className="space-y-1">
                <Label>{label}</Label>
                <Textarea
                  value={(form as any)[field] ?? ""}
                  onChange={(e) => set(field as any, e.target.value)}
                  placeholder={`Enter ${label.toLowerCase()}…`}
                  rows={3}
                  className="resize-none"
                  disabled={isSubmitted}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── PARTICIPATION STATS ──────────────────────────────────────────── */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Participation Statistics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { field: "studentsPresent", label: "Students Present" },
              { field: "studentsAbsent", label: "Students Absent" },
              { field: "totalVolunteers", label: "Total Volunteers" },
              { field: "beneficiaries", label: "Beneficiaries" },
            ].map(({ field, label }) => (
              <div key={field} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  type="number"
                  min={0}
                  value={(form as any)[field] ?? 0}
                  onChange={(e) => set(field as any, Number(e.target.value) || 0)}
                  disabled={isSubmitted}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── PHOTO SECTION ───────────────────────────────────────────────── */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" /> Photo Gallery
              </span>
              <Badge variant="outline">
                {localPhotos.length} / 50 photos
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSubmitted && localPhotos.length < 50 && (
              <DropZone onFiles={handlePhotoFiles} />
            )}

            {uploadingPhotos && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 animate-spin" />
                Uploading photos…
              </div>
            )}

            {localPhotos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {localPhotos.map((photo, idx) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    index={idx}
                    total={localPhotos.length}
                    onDelete={() => !isSubmitted && handleDeletePhoto(photo)}
                    onMoveUp={() => idx > 0 && movePhoto(idx, idx - 1)}
                    onMoveDown={() =>
                      idx < localPhotos.length - 1 && movePhoto(idx, idx + 1)
                    }
                  />
                ))}
              </div>
            )}

            {localPhotos.length === 0 && isSubmitted && (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No photos attached to this report.
              </div>
            )}

            {localPhotos.length === 0 && !isSubmitted && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertCircle className="h-3 w-3 shrink-0" />
                At least 1 photo is required to submit the report.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── ACTION ROW ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap justify-end gap-3 pb-6">
          <Button variant="outline" onClick={handlePdf}>
            <Download className="h-4 w-4" /> Generate PDF
          </Button>
          <Button
            variant="outline"
            disabled={saving || isSubmitted}
            onClick={() => handleSave("Draft")}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Draft"}
          </Button>
          <Button disabled={submitting || isSubmitted} onClick={handleSubmit}>
            <Send className="h-4 w-4" />
            {submitting ? "Submitting…" : "Submit Report"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
