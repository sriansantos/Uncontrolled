import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const TONES: Record<string, { chip: string; value: string }> = {
  default: {
    chip: "bg-muted text-foreground",
    value: "text-foreground",
  },
  positive: {
    chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  negative: {
    chip: "bg-red-500/15 text-red-600 dark:text-red-400",
    value: "text-red-600 dark:text-red-400",
  },
  warning: {
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
  },
  info: {
    chip: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    value: "text-sky-600 dark:text-sky-400",
  },
};

export function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "positive" | "negative" | "warning" | "info";
}) {
  const t = TONES[tone];
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          {Icon && (
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", t.chip)}>
              <Icon className="h-4 w-4" />
            </span>
          )}
        </div>
        <p className={cn("mt-1.5 text-xl font-bold tabular-nums sm:text-2xl", t.value)}>{value}</p>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
