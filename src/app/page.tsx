"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MonthNav } from "@/components/month-nav";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { formatBRL } from "@/lib/money";
import { monthShortLabel } from "@/lib/month";
import { useCurrentMonth } from "@/lib/use-current-month";
import type { DashboardData } from "@/lib/dashboard";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell, ComposedChart, Line,
} from "recharts";
import {
  ArrowDownLeft, ShoppingBag, Home, PiggyBank, ShieldAlert, Gauge,
  Percent, ReceiptText, CheckCircle2, Circle, RefreshCw,
} from "lucide-react";

const DONUT_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7",
  "#06b6d4", "#ec4899", "#84cc16", "#64748b",
];

const fmtAxis = (v: number) => {
  const reais = v / 100;
  return reais >= 1000
    ? `${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`
    : String(reais);
};

function fmtTooltip(value: unknown) {
  const n = Array.isArray(value) ? Number(value[0]) : Number(value);
  return Number.isFinite(n) ? formatBRL(n) : "—";
}

const axisStyle = { fontSize: 11, fill: "var(--muted-foreground)" };

function MetricCell({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "warning";
}) {
  const valueCls =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : tone === "warning"
          ? "text-amber-600 dark:text-amber-400"
          : "";
  return (
    <div className="flex flex-1 flex-col gap-1 px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className={`text-lg font-bold tabular-nums ${valueCls}`}>{value}</p>
      {hint && <p className="text-[11px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [month, setMonth] = useCurrentMonth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (showLoading = false) => {
      if (!month) return;
      if (showLoading) setLoading(true);
      const d = await api<DashboardData>(`/api/dashboard?month=${month}`);
      if (d) setData(d);
      if (showLoading) setLoading(false);
    },
    [month]
  );

  useEffect(() => {
    if (month) load(true);
  }, [load, month]);

  async function payBill(id: number) {
    const res = await api<{ alreadyPaid: boolean }>(`/api/recurrences/${id}/pay`, {
      method: "POST",
      json: { month },
    });
    if (res) {
      toast.success(res.alreadyPaid ? "Essa conta já estava paga." : "Conta marcada como paga!");
      load();
    }
  }

  const t = data?.totals;

  const chartBars = t
    ? [
        { name: "Entradas", Orçado: t.plannedIncomeCents, Realizado: t.incomeCents },
        { name: "Essenciais", Orçado: t.plannedEssentialCents, Realizado: t.essentialCents },
        { name: "Não essenciais", Orçado: t.plannedNonEssentialCents, Realizado: t.nonEssentialCents },
      ]
    : [];

  const donutData = data
    ? data.expenseByCategory.slice(0, 9).map((r) => ({ name: r.name, value: r.executedCents }))
    : [];

  const historyData = data
    ? data.history.map((h) => ({
        name: monthShortLabel(h.month),
        Entradas: h.incomeCents,
        Saídas: h.expenseCents,
        Saldo: h.balanceCents,
      }))
    : [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Dashboard" subtitle="Panorama do mês — essenciais, não essenciais e sobra">
        <MonthNav month={month} onChange={setMonth} />
        <Button variant="outline" size="icon" onClick={() => load(true)} aria-label="Atualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </PageHeader>

      {loading || !t ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Entradas"
              value={formatBRL(t.incomeCents)}
              hint={`Orçado: ${formatBRL(t.plannedIncomeCents)}`}
              icon={ArrowDownLeft}
              tone="positive"
            />
            <KpiCard
              title="Essenciais"
              value={formatBRL(t.essentialCents)}
              hint={`Orçado: ${formatBRL(t.plannedEssentialCents)}`}
              icon={Home}
            />
            <KpiCard
              title="Não essenciais"
              value={formatBRL(t.nonEssentialCents)}
              hint={`Orçado: ${formatBRL(t.plannedNonEssentialCents)}`}
              icon={ShoppingBag}
            />
            <KpiCard
              title="Sobra do mês"
              value={formatBRL(t.balanceCents)}
              hint={`Orçada: ${formatBRL(t.plannedBalanceCents)}`}
              icon={PiggyBank}
              tone={t.balanceCents >= 0 ? "positive" : "negative"}
            />
          </div>

          <Card className="mt-3 border-border/70 p-0 shadow-none">
            <div className="grid grid-cols-2 divide-x divide-border/60 lg:grid-cols-4 lg:divide-y-0">
              <MetricCell
                icon={ShieldAlert}
                label="Reserva ideal"
                value={formatBRL(t.emergencyReserveCents)}
                hint="6 × essenciais do mês"
                tone="warning"
              />
              <MetricCell
                icon={Gauge}
                label="Renda comprometida"
                value={t.commitmentPct !== null ? `${t.commitmentPct}%` : "—"}
                hint={t.plannedCommitmentPct !== null ? `Orçado: ${t.plannedCommitmentPct}%` : undefined}
                tone={(t.commitmentPct ?? 0) > 100 ? "negative" : "default"}
              />
              <MetricCell
                icon={Percent}
                label="Taxa de poupança"
                value={t.savingsRatePct !== null ? `${t.savingsRatePct}%` : "—"}
                hint="Sobra ÷ entradas"
                tone={(t.savingsRatePct ?? 0) >= 10 ? "positive" : "default"}
              />
              <MetricCell
                icon={ReceiptText}
                label="Contas em aberto"
                value={formatBRL(data.pendingBillsCents)}
                hint={`${data.bills.filter((b) => !b.paid).length} de ${data.bills.length} pendentes`}
                tone={data.pendingBillsCents > 0 ? "warning" : "positive"}
              />
            </div>
          </Card>

          <div className="mt-3 grid gap-3 lg:grid-cols-5">
            <Card className="border-border/70 shadow-none lg:col-span-3">
              <CardHeader className="px-4 pb-0 pt-4">
                <CardTitle className="text-sm font-semibold">Entradas × Saídas</CardTitle>
              </CardHeader>
              <CardContent className="h-64 p-2 pr-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartBars} barGap={4}>
                    <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={44} />
                    <Tooltip formatter={fmtTooltip} cursor={{ fill: "var(--accent)", opacity: 0.4 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Orçado" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="Realizado" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-none lg:col-span-2">
              <CardHeader className="px-4 pb-0 pt-4">
                <CardTitle className="text-sm font-semibold">Despesas por categoria</CardTitle>
              </CardHeader>
              <CardContent className="h-64 p-2">
                {donutData.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Nenhuma despesa lançada neste mês.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="48%"
                        outerRadius="78%"
                        paddingAngle={2}
                      >
                        {donutData.map((_, i) => (
                          <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={fmtTooltip} />
                      <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-3 border-border/70 shadow-none">
            <CardHeader className="px-4 pb-0 pt-4">
              <CardTitle className="text-sm font-semibold">Últimos 6 meses</CardTitle>
            </CardHeader>
            <CardContent className="h-56 p-2 pr-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={historyData} barGap={4}>
                  <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={44} />
                  <Tooltip formatter={fmtTooltip} cursor={{ fill: "var(--accent)", opacity: 0.4 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Entradas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Saídas" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line type="monotone" dataKey="Saldo" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Card className="border-border/70 shadow-none">
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-sm font-semibold">Contas do mês</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 px-3 pb-3">
                {data.bills.length === 0 && (
                  <p className="px-1 text-xs text-muted-foreground">
                    Nenhuma recorrência ativa. Cadastre em Recorrências.
                  </p>
                )}
                {data.bills.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Vence dia {b.dueDay} · {b.categoryName}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatBRL(b.amountCents)}
                      </span>
                      {b.paid ? (
                        <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> Pago
                        </Badge>
                      ) : (
                        <>
                          {b.overdue && <Badge variant="destructive">Atrasada</Badge>}
                          <Button size="sm" variant="outline" onClick={() => payBill(b.id)}>
                            <Circle className="mr-1 h-3 w-3" /> Pagar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-none">
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-sm font-semibold">Lançamentos recentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 px-3 pb-3">
                {data.recentTransactions.length === 0 && (
                  <p className="px-1 text-xs text-muted-foreground">Nenhum lançamento neste mês.</p>
                )}
                {data.recentTransactions.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.date.slice(8, 10)}/{r.date.slice(5, 7)} · {r.categoryName}
                      </p>
                    </div>
                    <span
                      className={
                        r.kind === "INCOME"
                          ? "shrink-0 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
                          : "shrink-0 text-sm font-semibold tabular-nums text-red-600 dark:text-red-400"
                      }
                    >
                      {r.kind === "INCOME" ? "+" : "−"} {formatBRL(r.amountCents)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
