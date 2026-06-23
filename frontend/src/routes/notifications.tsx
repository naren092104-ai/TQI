import { createFileRoute } from "@tanstack/react-router";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, CheckCheck, Wallet, Undo2, Activity, UserCog, AlertTriangle } from "lucide-react";
import { useStore, type Notif } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — TQI Admin" }] }),
  component: Page,
});

const iconFor = { Finance: Wallet, Refund: Undo2, Timeline: Activity, Admin: UserCog, Alert: AlertTriangle };

function Page() {
  const s = useStore();
  const unread = s.notifications.filter(n => !n.read).length;
  const filter = (t?: Notif["type"]) => t ? s.notifications.filter(n => n.type === t) : s.notifications;

  const list = (rows: Notif[]) => (
    <div className="space-y-2">
      {rows.length === 0 && <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No notifications</div>}
      {rows.map(n => {
        const Icon = iconFor[n.type];
        return (
          <Card key={n.id} className={`shadow-card ${!n.read ? "border-primary/40 bg-primary-soft/30" : ""}`}>
            <CardContent className="flex items-start gap-3 p-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><b className="truncate">{n.title}</b>{!n.read && <Badge className="h-4 px-1.5 text-[10px]">New</Badge>}</div>
                <div className="text-sm text-muted-foreground">{n.body}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{new Date(n.at).toLocaleString()}</div>
              </div>
              <Badge variant="outline">{n.type}</Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <AppShell>
      <PageHeader title="Notifications" description={`${unread} unread`} badge={unread > 0 ? `${unread}` : undefined}
        actions={<Button variant="outline" onClick={() => { s.markAllRead(); toast.success("All marked read"); }}><CheckCheck className="h-4 w-4" /> Mark all read</Button>} />
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all"><Bell className="h-4 w-4" /> All</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="refund">Refund</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">{list(filter())}</TabsContent>
        <TabsContent value="alerts" className="mt-4">{list(filter("Alert"))}</TabsContent>
        <TabsContent value="finance" className="mt-4">{list(filter("Finance"))}</TabsContent>
        <TabsContent value="refund" className="mt-4">{list(filter("Refund"))}</TabsContent>
        <TabsContent value="timeline" className="mt-4">{list(filter("Timeline"))}</TabsContent>
        <TabsContent value="admin" className="mt-4">{list(filter("Admin"))}</TabsContent>
      </Tabs>
    </AppShell>
  );
}
