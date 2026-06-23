import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";

type Row = {
  id: string;
  name: string;
  mobile?: string;
  school?: string;
  standard?: string;
  sessionCount?: number;
  status?: "Present" | "Absent" | "Pending";
};

export const AttendanceTable: React.FC<{ rows?: Row[]; onSelect?: (r: Row) => void }> = ({ rows = [], onSelect }) => {
  return (
    <div className="overflow-auto rounded-md border border-border">
      <table className="w-full table-fixed">
        <thead className="bg-background/50">
          <tr>
            <th className="p-2 w-12">Photo</th>
            <th className="p-2 text-left">Student Name</th>
            <th className="p-2">Mobile</th>
            <th className="p-2">School</th>
            <th className="p-2">Std</th>
            <th className="p-2">Sessions</th>
            <th className="p-2">Status</th>
            <th className="p-2">Homework</th>
            <th className="p-2">Remarks</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-accent/30">
              <td className="p-2 text-center"><Avatar><div className="bg-muted h-8 w-8 rounded-full flex items-center justify-center">{r.name.charAt(0)}</div></Avatar></td>
              <td className="p-2 text-left">{r.name}</td>
              <td className="p-2 text-center">{r.mobile || '—'}</td>
              <td className="p-2 text-center">{r.school || '—'}</td>
              <td className="p-2 text-center">{r.standard || '—'}</td>
              <td className="p-2 text-center">{r.sessionCount ?? 0}</td>
              <td className="p-2 text-center">{r.status}</td>
              <td className="p-2 text-center">—</td>
              <td className="p-2 text-center">—</td>
              <td className="p-2 text-center">
                <div className="flex items-center justify-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onSelect?.(r)}>View</Button>
                  <Switch checked={r.status === 'Present'} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AttendanceTable;
