import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import AttendanceLayout from "@/components/attendance/AttendanceLayout";
import { Button } from "@/components/ui/button";

function AnalyticsPage() {
  return (
    <AttendanceLayout title="Attendance Analytics" description="Trends and charts" actions={<Button>Refresh</Button>}>
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2 rounded-lg border border-border p-4 bg-background">Attendance Trend charts go here</div>
        <div className="rounded-lg border border-border p-4 bg-background">Overview cards and filters</div>
      </div>
    </AttendanceLayout>
  );
}

export const Route = createFileRoute("/attendance/analytics")({
  head: () => ({ meta: [{ title: "Attendance Analytics — TQI" }] }),
  component: AnalyticsPage,
});
