import React from "react";
import { KpiCard } from "@/components/layout/kpi-card";
import { UserCog } from "lucide-react";

export const KPICards: React.FC<{ stats?: any }> = ({ stats }) => {
  const s = stats ?? { total: 350, present: 320, absent: 30, pct: 91.4, pending: 10 };
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
      <KpiCard label="Total Students" value={s.total} icon={UserCog} tone="primary" />
      <KpiCard label="Present" value={s.present} icon={UserCog} tone="success" />
      <KpiCard label="Absent" value={s.absent} icon={UserCog} tone="destructive" />
      <KpiCard label="Attendance %" value={`${s.pct}%`} icon={UserCog} tone="info" />
      <KpiCard label="Pending Marking" value={s.pending} icon={UserCog} tone="warning" />
    </div>
  );
};

export default KPICards;
