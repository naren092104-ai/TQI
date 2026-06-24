import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — TQI Admin" }] }),
  component: Page,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card className="shadow-card"><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-4">{children}</CardContent></Card>;
}
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="min-w-0"><div className="text-sm font-medium">{label}</div>{hint && <div className="text-xs text-muted-foreground">{hint}</div>}</div>
      <div>{children}</div>
    </div>
  );
}
function Page() {
  const s = useStore();
  const financeSettings = s.financeSettings?.[0];
  const [financerName, setFinancerName] = useState(financeSettings?.defaultFinancerName ?? "TQI Finance Team");
  const [lockHours, setLockHours] = useState(String(financeSettings?.lockAfterHours ?? 48));

  const save = () => toast.success("Settings saved");

  const saveFinance = () => {
    if (financeSettings) {
      s.upsert("financeSettings", { ...financeSettings, defaultFinancerName: financerName, lockAfterHours: Number(lockHours) });
    }
    toast.success("Finance settings saved");
  };
  return (
    <AppShell>
      <PageHeader title="Settings" description="System, profile, security and module configuration." />
      <Tabs defaultValue="system">
        <TabsList className="flex-wrap">
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="system" className="mt-4">
          <Section title="System">
            <Row label="Organization name"><Input defaultValue="Talent Quest for India" className="w-64" /></Row>
            <Row label="Default time zone"><Input defaultValue="Asia/Kolkata" className="w-64" /></Row>
            <Row label="Maintenance mode" hint="Disable user logins"><Switch /></Row>
            <div className="text-right"><Button onClick={() => toast.success("Settings saved")}>Save</Button></div>
          </Section>
        </TabsContent>
        <TabsContent value="profile" className="mt-4">
          <Section title="Profile">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16"><AvatarFallback className="bg-primary text-primary-foreground">AM</AvatarFallback></Avatar>
              <Button variant="outline">Change avatar</Button>
            </div>
            <Row label="Full name"><Input defaultValue="Aarav Mehta" className="w-64" /></Row>
            <Row label="Email"><Input defaultValue="aarav@tqi.org" className="w-64" /></Row>
            <Row label="Phone"><Input defaultValue="+91 98765 43210" className="w-64" /></Row>
            <div className="text-right"><Button onClick={() => toast.success("Settings saved")}>Save</Button></div>
          </Section>
        </TabsContent>
        <TabsContent value="email" className="mt-4">
          <Section title="Email (SMTP)">
            <Row label="SMTP host"><Input defaultValue="smtp.tqi.org" className="w-64" /></Row>
            <Row label="Port"><Input defaultValue="587" className="w-24" /></Row>
            <Row label="From address"><Input defaultValue="no-reply@tqi.org" className="w-64" /></Row>
            <Row label="TLS" hint="Encrypt connection"><Switch defaultChecked /></Row>
            <div className="text-right"><Button onClick={() => toast.success("Settings saved")}>Save</Button></div>
          </Section>
        </TabsContent>
        <TabsContent value="finance" className="mt-4">
          <Section title="Finance Settings">
            <Row label="Currency"><Input defaultValue="INR (₹)" className="w-40" /></Row>
            <Row label="Advance cap (₹)"><Input type="number" defaultValue={100000} className="w-40" /></Row>
            <Row label="Default Financer Name" hint="Auto-filled in all finance entries. Cluster Admin cannot edit.">
              <Input value={financerName} onChange={(e) => setFinancerName(e.target.value)} className="w-64" placeholder="e.g. TQI Finance Team" />
            </Row>
            <Row label="Finance Lock (hours after session)" hint="Cluster Admin has this many hours to update finance after session.">
              <Input type="number" value={lockHours} onChange={(e) => setLockHours(e.target.value)} className="w-24" min={1} max={168} />
            </Row>
            <Row label="Require bill for expense"><Switch defaultChecked /></Row>
            <Row label="Auto-close on settlement"><Switch /></Row>
            <div className="text-right"><Button onClick={saveFinance}>Save Finance Settings</Button></div>
          </Section>
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <Section title="Timeline">
            <Row label="Default lock after (days)"><Input type="number" defaultValue={7} className="w-24" /></Row>
            <Row label="Allow extension requests"><Switch defaultChecked /></Row>
            <Row label="Auto-notify owners"><Switch defaultChecked /></Row>
            <div className="text-right"><Button onClick={save}>Save</Button></div>
          </Section>
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <Section title="Security">
            <Row label="Two-factor authentication"><Switch defaultChecked /></Row>
            <Row label="Session timeout (mins)"><Input type="number" defaultValue={30} className="w-24" /></Row>
            <Row label="IP allowlist"><Input placeholder="0.0.0.0/0" className="w-64" /></Row>
            <div className="text-right"><Button onClick={save}>Save</Button></div>
          </Section>
        </TabsContent>
        <TabsContent value="password" className="mt-4">
          <Section title="Change Password">
            <Row label="Current password"><Input type="password" className="w-64" /></Row>
            <Row label="New password"><Input type="password" className="w-64" /></Row>
            <Row label="Confirm new password"><Input type="password" className="w-64" /></Row>
            <div className="text-right"><Button onClick={save}>Update password</Button></div>
          </Section>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
