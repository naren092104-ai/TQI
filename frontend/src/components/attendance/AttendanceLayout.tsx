import React from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/layout/kpi-card";
import { Plus } from "lucide-react";

export const AttendanceLayout: React.FC<{ title?: string; description?: string; actions?: React.ReactNode }> = ({ title = "Attendance", description = "Premium attendance management", actions, children }) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <PageHeader title={title} description={description} actions={actions ?? <Button><Plus className="h-4 w-4" /> New</Button>} />

      {/* Internal scroll area so the attendance module scrolls independently */}
      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-8rem)]">
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
};

export default AttendanceLayout;
