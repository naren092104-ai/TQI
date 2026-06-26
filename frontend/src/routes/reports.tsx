import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SmartShell as AppShell, SmartPageHeader as PageHeader } from "@/components/layout/smart-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BarChart3, FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { useStore } from "@/lib/store";
import { downloadMock, toCSV } from "@/lib/format";
import { exportReportPdf, exportReportExcel } from "@/lib/api-exports";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — TQI Admin" }] }),
  component: Page,
});

const reports = [
  "Student Reports","Volunteer Reports","Attendance Reports","Homework Reports",
  "Finance Reports","Advance Reports","Refund Reports","Cluster Reports","Academic Year Reports",
];

function Page() {
  const s = useStore();
  const [type, setType] = useState(reports[0]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const exp = (fmt: "pdf" | "xlsx" | "csv") => {
    if (fmt === "csv") {
      const data = (() => {
        if (type.startsWith("Student")) return s.students;
        if (type.startsWith("Volunteer")) return s.volunteers;
        if (type.startsWith("Attendance")) return s.attendance;
        if (type.startsWith("Homework")) return s.homework;
        if (type.startsWith("Finance")) return s.expenses;
        if (type.startsWith("Advance")) return s.advances;
        if (type.startsWith("Refund")) return s.refunds;
        if (type.startsWith("Cluster")) return s.clusters;
        return s.academicYears;
      })() as any[];
      downloadMock(`${type.replace(/\s+/g,"-").toLowerCase()}.csv`, toCSV(data), "text/csv");
      toast.success("Exported CSV");
      return;
    }

    // For PDF/XLSX, call backend
    if (fmt === "pdf") {
      toast.promise(exportReportPdf(type), { loading: "Generating PDF...", success: "PDF exported", error: (e) => `Failed: ${e.message}` });
    } else {
      toast.promise(exportReportExcel(type), { loading: "Generating Excel...", success: "Excel exported", error: (e) => `Failed: ${e.message}` });
    }
  };

  return (
    <AppShell>
      <PageHeader title="Reports" description="Generate any report in PDF, Excel or CSV." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Report Builder</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Report Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{reports.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => exp("pdf")}><FileText className="h-4 w-4" /> Export PDF</Button>
              <Button variant="outline" onClick={() => exp("xlsx")}><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
              <Button variant="outline" onClick={() => exp("csv")}><FileDown className="h-4 w-4" /> Export CSV</Button>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Recent Reports</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {reports.slice(0, 5).map((r, i) => (
              <div key={r} className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm">
                <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><span>{r}</span></div>
                <Badge variant="outline">{i + 1}d ago</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map(r => (
          <Card key={r} className="shadow-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-xs text-muted-foreground">Auto-generated</div>
                <div className="font-medium">{r}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setType(r); exp("pdf"); }}>
                <FileDown className="h-4 w-4" /> Run
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
