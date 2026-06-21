import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/layout/kpi-card";
import { Plus, BookOpen, Calendar, Columns3 } from "lucide-react";
import { useStore, newId, type Session } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/sessions")({
  head: () => ({ meta: [{ title: "Sessions — TQI Admin" }] }),
  component: Page,
});

const statuses: Session["status"][] = ["Planned", "Ongoing", "Completed", "Cancelled"];
const statusTone: Record<Session["status"], string> = {
  Planned: "bg-info/15 text-info",
  Ongoing: "bg-secondary/15 text-secondary",
  Completed: "bg-success/15 text-success",
  Cancelled: "bg-destructive/15 text-destructive",
};

function Page() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ day: 1, title: "", date: "", clusterId: "", trainer: "" });

  const save = () => {
    if (!form.title || !form.clusterId) return toast.error("Required");
    s.upsert("sessions", { id: newId(), status: "Planned", ...form });
    toast.success("Session created"); setOpen(false);
  };
  const cName = (id: string) => s.clusters.find(c => c.id === id)?.name ?? "—";

  return (
    <AppShell>
      <PageHeader title="Sessions" description="8-day program sessions across clusters." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create Session</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Sessions" value={s.sessions.length} icon={BookOpen} tone="primary" />
        <KpiCard label="Completed" value={s.sessions.filter(x=>x.status==="Completed").length} icon={BookOpen} tone="success" />
        <KpiCard label="Ongoing" value={s.sessions.filter(x=>x.status==="Ongoing").length} icon={BookOpen} tone="secondary" />
        <KpiCard label="Planned" value={s.sessions.filter(x=>x.status==="Planned").length} icon={BookOpen} tone="info" />
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban"><Columns3 className="h-4 w-4" /> Kanban</TabsTrigger>
          <TabsTrigger value="calendar"><Calendar className="h-4 w-4" /> Calendar</TabsTrigger>
          <TabsTrigger value="timeline"><BookOpen className="h-4 w-4" /> Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="kanban" className="mt-4">
          <div className="grid gap-3 md:grid-cols-4">
            {statuses.map(st => (
              <div key={st} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                  <span>{st}</span>
                  <Badge variant="outline">{s.sessions.filter(x=>x.status===st).length}</Badge>
                </div>
                <div className="space-y-2">
                  {s.sessions.filter(x=>x.status===st).slice(0, 10).map(sess => (
                    <Card key={sess.id} className="shadow-none">
                      <CardContent className="p-3">
                        <div className="text-xs text-muted-foreground">Day {sess.day} · {sess.date}</div>
                        <div className="mt-1 text-sm font-medium">{sess.title}</div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <Badge variant="outline" className="text-[10px]">{cName(sess.clusterId)}</Badge>
                          <span className="text-muted-foreground">{sess.trainer}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-1 text-xs">
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <div key={d} className="p-2 text-center font-semibold text-muted-foreground">{d}</div>)}
                {Array.from({ length: 35 }).map((_, i) => {
                  const sess = s.sessions[i % s.sessions.length];
                  return (
                    <div key={i} className="min-h-20 rounded-md border border-border p-1.5">
                      <div className="text-[10px] text-muted-foreground">{i + 1}</div>
                      {i % 3 === 0 && <div className={`mt-1 rounded px-1.5 py-0.5 text-[10px] ${statusTone[sess.status]}`}>{sess.title.slice(0, 18)}</div>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <Card><CardContent className="p-4">
            <div className="relative space-y-3 border-l-2 border-border pl-6">
              {s.sessions.slice(0, 15).map(sess => (
                <div key={sess.id} className="relative">
                  <div className="absolute -left-[27px] grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">{sess.day}</div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2"><div className="font-medium">{sess.title}</div><Badge className={statusTone[sess.status]}>{sess.status}</Badge></div>
                    <div className="mt-1 text-xs text-muted-foreground">{sess.date} · {cName(sess.clusterId)} · {sess.trainer}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Session</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Day</Label>
              <Select value={String(form.day)} onValueChange={(v) => setForm({ ...form, day: +v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({length:8},(_,i)=>i+1).map(d => <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Cluster</Label>
              <Select value={form.clusterId} onValueChange={(v) => setForm({ ...form, clusterId: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{s.clusters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Trainer</Label><Input value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
