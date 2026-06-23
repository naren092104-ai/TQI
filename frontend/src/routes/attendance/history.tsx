import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import AttendanceLayout from "@/components/attendance/AttendanceLayout";
import { Button } from "@/components/ui/button";

function HistoryPage() {
  return (
    <AttendanceLayout title="Attendance History" description="Historical records and exports" actions={<Button>Export</Button>}>
      <div className="p-4">
        <div className="rounded-lg border border-border p-4 bg-background">
          <div className="text-sm font-semibold">Session History</div>
          <div className="mt-3 text-sm text-muted-foreground">This page provides ERP-style history with session-wise breakdown, user and timestamp details, and export options.</div>
        </div>
      </div>
    </AttendanceLayout>
  );
}

export const Route = createFileRoute("/attendance/history")({
  head: () => ({ meta: [{ title: "Attendance History — TQI" }] }),
  component: HistoryPage,
});
