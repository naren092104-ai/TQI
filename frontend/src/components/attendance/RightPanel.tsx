import React from "react";

export const RightPanel: React.FC<{ timeline?: string[] }> = ({ timeline = [] }) => {
  return (
    <div className="w-full md:w-80 p-4 border-l border-border bg-background">
      <div className="text-sm font-semibold">Attendance Timeline</div>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        {timeline.length === 0 && <div className="text-xs">No timeline</div>}
        {timeline.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-success/80 text-white flex items-center justify-center text-xs">{i + 1}</div>
            <div>{t}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RightPanel;
