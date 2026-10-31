"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { monthLabel, shiftMonth, currentYearMonth } from "@/lib/month";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MonthNav({
  month,
  onChange,
}: {
  month: string;
  onChange: (m: string) => void;
}) {
  // mês corrente resolvido após a montagem (Next 16 bloqueia new Date() no render)
  const [current, setCurrent] = useState("");
  useEffect(() => setCurrent(currentYearMonth()), []);
  const isCurrent = month === current;
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-40 text-center text-sm font-semibold tabular-nums">
        {monthLabel(month)}
      </span>
      <Button variant="outline" size="icon" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isCurrent && (
        <Button variant="ghost" size="sm" onClick={() => onChange(currentYearMonth())}>
          Hoje
        </Button>
      )}
    </div>
  );
}
