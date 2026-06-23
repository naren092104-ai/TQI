import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function KpiCard({
  label, value, delta, icon: Icon, tone = "default",
}: {
  label: string;
  value: string | number;
  delta?: number;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "primary" | "secondary" | "success" | "warning" | "info";
}) {
  const tones: Record<string, string> = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/15 text-secondary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    info: "bg-info/10 text-info",
  };
  return (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 truncate text-2xl font-bold tracking-tight">{value}</div>
            {delta !== undefined && (
              <div className={cn("mt-1 flex items-center gap-1 text-xs", delta >= 0 ? "text-success" : "text-destructive")}>
                {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(delta).toFixed(1)}% vs last week
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", tones[tone])}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
