import { prisma } from "./db";
import { monthRange, shiftMonth, todayISO, currentYearMonth } from "./month";
import type { Tier } from "./types";

export type CategoryRow = {
  categoryId: number;
  name: string;
  kind: "INCOME" | "EXPENSE";
  tier: Tier | null;
  plannedCents: number;
  executedCents: number;
  diffCents: number; // executado - orçado (positivo = estourou)
  count: number;
};

export type BillRow = {
  id: number;
  name: string;
  amountCents: number;
  dueDay: number;
  categoryName: string;
  paid: boolean;
  overdue: boolean;
  transactionId: number | null;
};

export type DashboardData = {
  month: string;
  totals: {
    incomeCents: number;
    essentialCents: number;
    nonEssentialCents: number;
    expenseCents: number;
    balanceCents: number; // sobra do mês (realizado)
    plannedIncomeCents: number;
    plannedEssentialCents: number;
    plannedNonEssentialCents: number;
    plannedExpenseCents: number;
    plannedBalanceCents: number; // sobra orçada
    emergencyReserveCents: number; // essenciais realizados × 6
    plannedEmergencyReserveCents: number;
    commitmentPct: number | null; // despesas / entradas (%)
    plannedCommitmentPct: number | null;
    savingsRatePct: number | null; // sobra / entradas
  };
  incomeByCategory: CategoryRow[];
  expenseByCategory: CategoryRow[];
  bills: BillRow[];
  pendingBillsCents: number;
  recentTransactions: Array<{
    id: number;
    date: string;
    description: string;
    amountCents: number;
    kind: string;
    categoryName: string;
  }>;
  history: Array<{ month: string; incomeCents: number; expenseCents: number; balanceCents: number }>;
};

function emptyRow(
  categoryId: number,
  name: string,
  kind: "INCOME" | "EXPENSE",
  tier: string | null
): CategoryRow {
  return {
    categoryId,
    name,
    kind,
    tier: (tier as Tier | null) ?? null,
    plannedCents: 0,
    executedCents: 0,
    diffCents: 0,
    count: 0,
  };
}

export async function getDashboard(month: string): Promise<DashboardData> {
  const { start, end } = monthRange(month);

  const [transactions, budgetItems, recurrences, historyTx] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: start, lte: end } },
      include: { category: true },
      orderBy: { date: "desc" },
    }),
    prisma.budgetItem.findMany({
      where: { yearMonth: month },
      include: { category: true },
    }),
    prisma.recurrence.findMany({
      where: { active: true },
      include: { category: true, transactions: { where: { date: { gte: start, lte: end } } } },
      orderBy: [{ dueDay: "asc" }, { name: "asc" }],
    }),
    prisma.transaction.findMany({
      where: { date: { gte: `${shiftMonth(month, -5)}-01`, lte: end } },
      select: { date: true, kind: true, amountCents: true },
    }),
  ]);

  // ---- Totais do mês (realizado) ----
  let incomeCents = 0;
  let essentialCents = 0;
  let nonEssentialCents = 0;
  for (const t of transactions) {
    if (t.kind === "INCOME") {
      incomeCents += t.amountCents;
    } else if (t.category.tier === "ESSENCIAL") {
      essentialCents += t.amountCents;
    } else {
      nonEssentialCents += t.amountCents;
    }
  }
  const expenseCents = essentialCents + nonEssentialCents;
  const balanceCents = incomeCents - expenseCents;

  // ---- Grid por categoria (orçado × realizado) ----
  let plannedIncomeCents = 0;
  let plannedEssentialCents = 0;
  let plannedNonEssentialCents = 0;
  const rows = new Map<number, CategoryRow>();
  for (const b of budgetItems) {
    const kind = b.category.kind === "INCOME" ? "INCOME" : "EXPENSE";
    const row = emptyRow(b.categoryId, b.category.name, kind, b.category.tier);
    row.plannedCents = b.plannedCents;
    rows.set(b.categoryId, row);
    if (kind === "INCOME") plannedIncomeCents += b.plannedCents;
    else if (b.category.tier === "ESSENCIAL") plannedEssentialCents += b.plannedCents;
    else plannedNonEssentialCents += b.plannedCents;
  }
  for (const t of transactions) {
    const kind = t.kind === "INCOME" ? "INCOME" : "EXPENSE";
    let row = rows.get(t.categoryId);
    if (!row) {
      row = emptyRow(t.categoryId, t.category.name, kind, t.category.tier);
      rows.set(t.categoryId, row);
    }
    row.executedCents += t.amountCents;
    row.count++;
  }
  for (const row of rows.values()) row.diffCents = row.executedCents - row.plannedCents;

  const visible = (r: CategoryRow) => r.plannedCents > 0 || r.executedCents > 0;
  const allRows = [...rows.values()]
    .filter(visible)
    .sort((a, b) => b.executedCents - a.executedCents);
  const incomeByCategory = allRows.filter((r) => r.kind === "INCOME");
  const expenseByCategory = allRows.filter((r) => r.kind === "EXPENSE");

  // ---- Contas do mês (recorrências) ----
  const today = todayISO();
  const isCurrentMonth = month === currentYearMonth();
  const bills: BillRow[] = recurrences.map((r) => {
    const paidTx = r.transactions[0];
    const paid = !!paidTx;
    const overdue = !paid && isCurrentMonth && r.dueDay < Number(today.slice(8, 10));
    return {
      id: r.id,
      name: r.name,
      amountCents: r.amountCents,
      dueDay: r.dueDay,
      categoryName: r.category.name,
      paid,
      overdue,
      transactionId: paidTx?.id ?? null,
    };
  });
  const pendingBillsCents = bills.filter((b) => !b.paid).reduce((s, b) => s + b.amountCents, 0);

  // ---- Histórico de 6 meses ----
  const historyMap = new Map<string, { incomeCents: number; expenseCents: number }>();
  for (let i = 5; i >= 0; i--) historyMap.set(shiftMonth(month, -i), { incomeCents: 0, expenseCents: 0 });
  for (const t of historyTx) {
    const bucket = historyMap.get(t.date.slice(0, 7));
    if (!bucket) continue;
    if (t.kind === "INCOME") bucket.incomeCents += t.amountCents;
    else bucket.expenseCents += t.amountCents;
  }
  const history = [...historyMap.entries()].map(([m, v]) => ({
    month: m,
    incomeCents: v.incomeCents,
    expenseCents: v.expenseCents,
    balanceCents: v.incomeCents - v.expenseCents,
  }));

  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

  return {
    month,
    totals: {
      incomeCents,
      essentialCents,
      nonEssentialCents,
      expenseCents,
      balanceCents,
      plannedIncomeCents,
      plannedEssentialCents,
      plannedNonEssentialCents,
      plannedExpenseCents: plannedEssentialCents + plannedNonEssentialCents,
      plannedBalanceCents: plannedIncomeCents - (plannedEssentialCents + plannedNonEssentialCents),
      emergencyReserveCents: essentialCents * 6,
      plannedEmergencyReserveCents: plannedEssentialCents * 6,
      commitmentPct: pct(expenseCents, incomeCents),
      plannedCommitmentPct: pct(plannedEssentialCents + plannedNonEssentialCents, plannedIncomeCents),
      savingsRatePct: pct(balanceCents, incomeCents),
    },
    incomeByCategory,
    expenseByCategory,
    bills,
    pendingBillsCents,
    recentTransactions: transactions.slice(0, 8).map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amountCents: t.amountCents,
      kind: t.kind,
      categoryName: t.category.name,
    })),
    history,
  };
}
