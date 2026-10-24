"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MonthNav } from "@/components/month-nav";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/client";
import { formatBRL, parseBRLToCents, centsToInputValue } from "@/lib/money";
import { shiftMonth } from "@/lib/month";
import { useCurrentMonth } from "@/lib/use-current-month";
import { Copy, Save } from "lucide-react";

type BudgetRow = {
  categoryId: number;
  name: string;
  kind: "INCOME" | "EXPENSE";
  tier: "ESSENCIAL" | "NAO_ESSENCIAL" | null;
  plannedCents: number;
  executedCents: number;
  diffCents: number;
};

type BudgetResponse = { month: string; items: BudgetRow[] };

export default function OrcamentoPage() {
  const [month, setMonth] = useCurrentMonth();
  const [rows, setRows] = useState<BudgetRow[] | null>(null);
  const [edits, setEdits] = useState<Record<number, string>>({}); // categoryId -> texto
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!month) return;
    setRows(null);
    setEdits({});
    const r = await api<BudgetResponse>(`/api/budget?month=${month}`);
    if (r) setRows(r.items);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const planned = useMemo(() => {
    const get = (r: BudgetRow) => {
      const edit = edits[r.categoryId];
      if (edit === undefined) return r.plannedCents;
      return parseBRLToCents(edit) ?? 0;
    };
    return {
      get,
      income: (rows ?? []).filter((r) => r.kind === "INCOME").reduce((s, r) => s + get(r), 0),
      essential: (rows ?? [])
        .filter((r) => r.kind === "EXPENSE" && r.tier === "ESSENCIAL")
        .reduce((s, r) => s + get(r), 0),
      nonEssential: (rows ?? [])
        .filter((r) => r.kind === "EXPENSE" && r.tier === "NAO_ESSENCIAL")
        .reduce((s, r) => s + get(r), 0),
    };
  }, [rows, edits]);

  async function save() {
    if (!rows) return;
    setSaving(true);
    const items = rows.map((r) => {
      const edit = edits[r.categoryId];
      return {
        categoryId: r.categoryId,
        plannedCents: edit === undefined ? r.plannedCents : (parseBRLToCents(edit) ?? 0),
      };
    });
    const res = await api<BudgetResponse>("/api/budget", { method: "PUT", json: { month, items } });
    setSaving(false);
    if (res) {
      toast.success("Orçamento salvo!");
      setRows(res.items);
      setEdits({});
    }
  }

  async function copyPrevious() {
    const res = await api<{ copied: number }>("/api/budget/copy", {
      method: "POST",
      json: { from: shiftMonth(month, -1), to: month },
    });
    if (res) {
      toast.success(`Copiados ${res.copied} valores de ${shiftMonth(month, -1)}.`);
      load();
    }
  }

  const incomeRows = (rows ?? []).filter((r) => r.kind === "INCOME");
  const essentialRows = (rows ?? []).filter((r) => r.kind === "EXPENSE" && r.tier === "ESSENCIAL");
  const nonEssentialRows = (rows ?? []).filter(
    (r) => r.kind === "EXPENSE" && r.tier === "NAO_ESSENCIAL"
  );

  function Section({
    title,
    items,
    plannedTotal,
  }: {
    title: string;
    items: BudgetRow[];
    plannedTotal: number;
  }) {
    const executedTotal = items.reduce((s, r) => s + r.executedCents, 0);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-baseline justify-between text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
            <span className="text-xs normal-case">
              Orçado {formatBRL(plannedTotal)} · Realizado {formatBRL(executedTotal)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-[1fr_32%_auto] items-center gap-x-3 border-b px-4 pb-2 text-xs font-medium text-muted-foreground sm:grid-cols-[1fr_140px_120px_120px]">
            <span>Categoria</span>
            <span>Orçado (R$)</span>
            <span className="hidden text-right sm:block">Realizado</span>
            <span className="text-right">Diferença</span>
          </div>
          {items.length === 0 && (
            <p className="px-4 py-4 text-sm text-muted-foreground">Nenhuma categoria ativa.</p>
          )}
          {items.map((r) => {
            const current = edits[r.categoryId] !== undefined
              ? (parseBRLToCents(edits[r.categoryId]) ?? 0)
              : r.plannedCents;
            const diff = r.executedCents - current;
            return (
              <div
                key={r.categoryId}
                className="grid grid-cols-[1fr_32%_auto] items-center gap-x-3 border-b px-4 py-2 sm:grid-cols-[1fr_140px_120px_120px]"
              >
                <span className="truncate text-sm">{r.name}</span>
                <Input
                  inputMode="decimal"
                  className="h-8 text-sm tabular-nums"
                  placeholder="0,00"
                  value={edits[r.categoryId] ?? (r.plannedCents ? centsToInputValue(r.plannedCents) : "")}
                  onChange={(e) =>
                    setEdits((prev) => ({ ...prev, [r.categoryId]: e.target.value }))
                  }
                />
                <span className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
                  {r.executedCents ? formatBRL(r.executedCents) : "—"}
                </span>
                <span
                  className={`text-right text-sm font-medium tabular-nums ${
                    diff > 0 && r.executedCents > 0
                      ? "text-red-600 dark:text-red-400"
                      : diff < 0 && r.executedCents > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {r.executedCents || current ? formatBRL(diff) : "—"}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  if (!rows) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const plannedBalance = planned.income - planned.essential - planned.nonEssential;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orçamento"
        subtitle="Valor planejado por categoria — como na planilha — vs. o realizado"
      >
        <MonthNav month={month} onChange={setMonth} />
        <Button variant="outline" onClick={copyPrevious}>
          <Copy className="mr-1 h-4 w-4" /> Copiar mês anterior
        </Button>
        <Button onClick={save} disabled={saving || Object.keys(edits).length === 0}>
          <Save className="mr-1 h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          title="Entradas orçadas"
          value={formatBRL(planned.income)}
          hint="Total planejado de receitas"
          tone="positive"
        />
        <KpiCard
          title="Despesas orçadas"
          value={formatBRL(planned.essential + planned.nonEssential)}
          hint={`Essenciais ${formatBRL(planned.essential)} · Não essenciais ${formatBRL(planned.nonEssential)}`}
        />
        <KpiCard
          title="Sobra orçada"
          value={formatBRL(plannedBalance)}
          hint="Se tudo sair conforme o plano, é o que deve sobrar"
          tone={plannedBalance >= 0 ? "positive" : "negative"}
        />
      </div>

      <Section title="Receitas (entradas)" items={incomeRows} plannedTotal={planned.income} />
      <Section title="Despesas essenciais" items={essentialRows} plannedTotal={planned.essential} />
      <Section
        title="Despesas não essenciais"
        items={nonEssentialRows}
        plannedTotal={planned.nonEssential}
      />

      <Separator />
      <p className="text-sm text-muted-foreground">
        Reserva de emergência ideal com este orçamento:{" "}
        <strong className="text-foreground">{formatBRL(planned.essential * 6)}</strong> (6 × despesas
        essenciais orçadas).
      </p>
    </div>
  );
}
