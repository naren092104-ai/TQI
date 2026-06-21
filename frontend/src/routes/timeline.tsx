import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/layout/kpi-card";
import { Plus, Activity, Lock, Unlock, CheckCircle2, Calendar, Columns3 } from "lucide-react";
import { useStore, newId, type TimelineTask } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/timeline")({
  head: () => ({ meta: [{ title: "Timeline — TQI Admin" }] }),
  component: Page,
});

const statusTone: Record<TimelineTask["status"], string> = {
  "Not Started": "bg-muted text-foreground",
  Pending: "bg-warning/15 text-warning-foreground",
  Completed: "bg-success/15 text-success",
  Locked: "bg-info/15 text-info",
  "Extension Requested": "bg-secondary/15 text-secondary",
};
const allStatuses: TimelineTask["status"][] = ["Not Started","Pending","Completed","Locked","Extension Requested"];

function Page() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", due: "", owner: "", status: "Not Started" as TimelineTask["status"] });

  const save = () => {
    if (!form.title) return toast.error("Title required");
    s.upsert("timeline", { id: newId(), ...form });
    toast.success("Created"); setOpen(false);
  };

  return (
    <AppShell>
      <PageHeader title="Timeline" description="Program milestones — calendar, kanban or timeline view." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create Task</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {allStatuses.map(st => (
          <KpiCard key={st} label={st} value={s.timeline.filter(t => t.status === st).length} icon={Activity} tone={st === "Completed" ? "success" : st === "Locked" ? "info" : "warning"} />
        ))}
      </div>
      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar"><Calendar className="h-4 w-4" /> Calendar</TabsTrigger>
          <TabsTrigger value="kanban"><Columns3 className="h-4 w-4" /> Kanban</TabsTrigger>
          <TabsTrigger value="timeline"><Activity className="h-4 w-4" /> Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="mt-4">
          <Card><CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1 text-xs">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <div key={d} className="p-2 text-center font-semibold text-muted-foreground">{d}</div>)}
              {Array.from({ length: 35 }).map((_, i) => {
                const t = s.timeline[i % s.timeline.length];
                return (
                  <div key={i} className="min-h-20 rounded-md border border-border p-1.5">
                    <div className="text-[10px] text-muted-foreground">{i + 1}</div>
                    {i % 5 === 0 && <div className={`mt-1 rounded px-1.5 py-0.5 text-[10px] ${statusTone[t.status]}`}>{t.title.slice(0,18)}</div>}
                  </div>
                );
              })}
            </div>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="kanban" className="mt-4">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {allStatuses.map(st => (
              <div key={st} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between text-sm font-semibold">{st}<Badge variant="outline">{s.timeline.filter(t=>t.status===st).length}</Badge></div>
                {s.timeline.filter(t=>t.status===st).map(t => (
                  <Card key={t.id} className="mb-2 shadow-none"><CardContent className="p-3">
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-[11px] text-muted-foreground">Due {t.due} · {t.owner}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => s.patch("timeline", t.id, { status: "Completed" })}><CheckCircle2 className="h-3 w-3" /> Done</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => s.patch("timeline", t.id, { status: t.status === "Locked" ? "Pending" : "Locked" })}>
                        {t.status === "Locked" ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />} {t.status === "Locked" ? "Unlock" : "Lock"}
                      </Button>
                    </div>
                  </CardContent></Card>
                ))}
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <Card><CardContent className="p-4">
            <div className="relative space-y-3 border-l-2 border-border pl-6">
              {s.timeline.map(t => (
                <div key={t.id} className="relative">
                  <div className="absolute -left-[27px] grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">·</div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2"><div className="font-medium">{t.title}</div><Badge className={statusTone[t.status]}>{t.status}</Badge></div>
                    <div className="mt-1 text-xs text-muted-foreground">{t.due} · {t.owner}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Timeline Task</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Due</Label><Input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></div>
            <div><Label>Owner</Label><Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TimelineTask["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{allStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
