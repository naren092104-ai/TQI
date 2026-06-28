import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/layout/kpi-card";
import { ConfirmDelete } from "@/components/layout/confirm-delete";
import { Plus, BookOpen, Pencil, CalendarDays, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useStore, newId, type Session } from "@/lib/store";
import { useAuth, isSuperAdmin, isClusterAdmin } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/sessions")({
  head: () => ({ meta: [{ title: "Sessions — TQI Admin" }] }),
  component: Page,
});

const STATUS_STYLES: Record<Session["status"], { cls: string; icon: any }> = {
  Planned:   { cls: "bg-blue-100 text-blue-700 border-blue-200",      icon: Clock },
  Ongoing:   { cls: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  Completed: { cls: "bg-green-100 text-green-700 border-green-200",   icon: CheckCircle2 },
  Cancelled: { cls: "bg-red-100 text-red-700 border-red-200",         icon: XCircle },
  Locked:    { cls: "bg-slate-100 text-slate-600 border-slate-200",   icon: Clock },
};

function Page() {
  const s = useStore();
  const { user } = useAuth();
  const isSuper = isSuperAdmin(user?.role);
  const isCluster = isClusterAdmin(user?.role);
  const myClusterId = user?.clusterId ?? "";

  // Super Admin — create/edit full session
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [form, setForm] = useState({ day: 1, title: "", date: "", clusterId: "", trainer: "", status: "Planned" as Session["status"] });

  // Cluster Admin — edit date only
  const [dateEditOpen, setDateEditOpen] = useState(false);
  const [dateEditSession, setDateEditSession] = useState<Session | null>(null);
  const [newDate, setNewDate] = useState("");

  const cName = (id: string) => s.clusters.find(c => c.id === id)?.name ?? "—";

  // Sessions visible to current user
  const visibleSessions = useMemo(() =>
    isCluster ? s.sessions.filter(sess => sess.clusterId === myClusterId) : s.sessions,
    [s.sessions, isCluster, myClusterId]);

  // For cluster admin: 8 day slots
  const daySlots = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => {
      const day = i + 1;
      const existing = visibleSessions.find(sess => sess.day === day);
      return { day, session: existing ?? null };
    }),
    [visibleSessions]);

  const openCreate = () => {
    setForm({ day: 1, title: "", date: "", clusterId: s.clusters[0]?.id ?? "", trainer: "", status: "Planned" });
    setCreateOpen(true);
  };

  const openEdit = (sess: Session) => {
    setEditSession(sess);
    setForm({ day: sess.day, title: sess.title, date: sess.date, clusterId: sess.clusterId, trainer: sess.trainer, status: sess.status });
    setEditOpen(true);
  };

  const saveCreate = () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.clusterId) return toast.error("Cluster is required");
    if (!form.date) return toast.error("Date is required");
    // Check if day already exists for this cluster
    const existing = s.sessions.find(sess => sess.day === form.day && sess.clusterId === form.clusterId);
    if (existing) return toast.error(`Day ${form.day} already exists for this cluster`);
    s.upsert("sessions", { id: newId(), ...form });
    toast.success("Session created");
    setCreateOpen(false);
  };

  const saveEdit = () => {
    if (!editSession) return;
    if (!form.title.trim()) return toast.error("Title is required");
    s.upsert("sessions", { ...editSession, ...form });
    toast.success("Session updated");
    setEditOpen(false);
  };

  const openDateEdit = (sess: Session) => {
    setDateEditSession(sess);
    setNewDate(sess.date);
    setDateEditOpen(true);
  };

  const saveDateEdit = () => {
    if (!dateEditSession) return;
    if (!newDate) return toast.error("Please select a date");
    s.upsert("sessions", { ...dateEditSession, date: newDate });
    toast.success("Date updated");
    setDateEditOpen(false);
  };

  return (
    <AppShell>
      <PageHeader
        title="Sessions"
        description={isCluster ? "View your cluster's 8 sessions. You can update session dates." : "Manage 8-day program sessions. Super Admin creates sessions per cluster."}
        actions={isSuper ? (
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Create Session</Button>
        ) : undefined}
      />

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Sessions" value={visibleSessions.length} icon={BookOpen} tone="primary" />
        <KpiCard label="Completed" value={visibleSessions.filter(x => x.status === "Completed").length} icon={CheckCircle2} tone="success" />
        <KpiCard label="Ongoing" value={visibleSessions.filter(x => x.status === "Ongoing").length} icon={Clock} tone="secondary" />
        <KpiCard label="Planned" value={visibleSessions.filter(x => x.status === "Planned").length} icon={CalendarDays} tone="info" />
      </div>

      {/* CLUSTER ADMIN VIEW — 8 day slots grid */}
      {isCluster && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {daySlots.map(({ day, session }) => (
            <Card key={day} className={`shadow-card border-2 ${session ? "border-primary/20" : "border-dashed border-muted-foreground/20"}`}>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                      {day}
                    </div>
                    <CardTitle className="text-sm font-semibold">Day {day}</CardTitle>
                  </div>
                  {session && (
                    <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[session.status].cls}`}>
                      {session.status}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {session ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{session.title}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      <span>{session.date || "No date set"}</span>
                    </div>
                    {session.trainer && (
                      <p className="text-xs text-muted-foreground">Trainer: {session.trainer}</p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2 h-7 text-xs"
                      onClick={() => openDateEdit(session)}
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Edit Date
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-3 text-xs text-muted-foreground">
                    <CalendarDays className="h-6 w-6 mx-auto mb-1 opacity-30" />
                    Not scheduled yet
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* SUPER ADMIN VIEW — all sessions list per cluster */}
      {isSuper && (
        <div className="space-y-6">
          {s.clusters.map(cluster => {
            const clusterSessions = s.sessions.filter(sess => sess.clusterId === cluster.id);
            const slots = Array.from({ length: 8 }, (_, i) => {
              const day = i + 1;
              return { day, session: clusterSessions.find(sess => sess.day === day) ?? null };
            });
            return (
              <Card key={cluster.id} className="shadow-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{cluster.name}</CardTitle>
                    <Badge variant="outline">{clusterSessions.length}/8 sessions</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
                    {slots.map(({ day, session }) => (
                      <div
                        key={day}
                        className={`rounded-lg border p-2 text-xs ${session ? "border-primary/30 bg-primary/5" : "border-dashed border-muted-foreground/20 bg-muted/20"}`}
                      >
                        <div className="font-semibold mb-1 flex items-center justify-between">
                          <span>Day {day}</span>
                          {session && (
                            <div className="flex gap-0.5">
                              <button onClick={() => openEdit(session)} className="text-muted-foreground hover:text-primary">
                                <Pencil className="h-3 w-3" />
                              </button>
                              <ConfirmDelete onConfirm={() => { s.remove("sessions", session.id); toast.success("Deleted"); }} />
                            </div>
                          )}
                        </div>
                        {session ? (
                          <>
                            <p className="text-muted-foreground truncate">{session.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{session.date || "—"}</p>
                            <Badge variant="outline" className={`mt-1 text-[9px] px-1 py-0 ${STATUS_STYLES[session.status].cls}`}>{session.status}</Badge>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setForm({ day, title: "", date: "", clusterId: cluster.id, trainer: "", status: "Planned" });
                              setCreateOpen(true);
                            }}
                            className="w-full mt-1 text-center text-muted-foreground hover:text-primary text-[10px]"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {s.clusters.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No clusters found. Create clusters first.</p>
          )}
        </div>
      )}

      {/* Super Admin: Create Session Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Session</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Cluster</Label>
              <Select value={form.clusterId} onValueChange={(v) => setForm({ ...form, clusterId: v })}>
                <SelectTrigger><SelectValue placeholder="Select cluster" /></SelectTrigger>
                <SelectContent>{s.clusters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Day</Label>
              <Select value={String(form.day)} onValueChange={(v) => setForm({ ...form, day: +v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 8 }, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Session 1 — Career Awareness" /></div>
            <div><Label>Date <span className="text-destructive">*</span></Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label>Trainer</Label><Input value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} placeholder="Trainer name" /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Session["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(["Planned","Ongoing","Completed","Cancelled"] as Session["status"][]).map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={saveCreate}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Super Admin: Edit Session Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Session — Day {editSession?.day}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label>Trainer</Label><Input value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Session["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(["Planned","Ongoing","Completed","Cancelled"] as Session["status"][]).map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={saveEdit}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cluster Admin: Edit Date Only Dialog */}
      <Dialog open={dateEditOpen} onOpenChange={setDateEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Date — Day {dateEditSession?.day}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{dateEditSession?.title}</p>
            <div>
              <Label>Session Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDateEditOpen(false)}>Cancel</Button>
            <Button onClick={saveDateEdit}>Save Date</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
