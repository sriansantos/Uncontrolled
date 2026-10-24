import { prisma } from "@/lib/db";
import { ok, handleRouteError, badRequest, readJson } from "@/lib/api-helpers";
import { budgetPutSchema } from "@/lib/validate";
import { isValidYearMonth, monthRange } from "@/lib/month";
import type { Tier } from "@/lib/types";

async function budgetPayload(month: string) {
  const { start, end } = monthRange(month);
  const [categories, budgetItems, transactions] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.budgetItem.findMany({ where: { yearMonth: month } }),
    prisma.transaction.findMany({
      where: { date: { gte: start, lte: end } },
      select: { categoryId: true, kind: true, amountCents: true },
    }),
  ]);

  const planned = new Map(budgetItems.map((b) => [b.categoryId, b.plannedCents]));
  const executed = new Map<number, number>();
  for (const t of transactions) {
    executed.set(t.categoryId, (executed.get(t.categoryId) ?? 0) + t.amountCents);
  }

  const items = categories.map((c) => ({
    categoryId: c.id,
    name: c.name,
    kind: c.kind,
    tier: (c.tier as Tier | null) ?? null,
    plannedCents: planned.get(c.id) ?? 0,
    executedCents: executed.get(c.id) ?? 0,
    diffCents: (executed.get(c.id) ?? 0) - (planned.get(c.id) ?? 0),
  }));

  return { month, items };
}

// GET /api/budget?month=YYYY-MM — grade completa (todas as categorias ativas)
export async function GET(req: Request) {
  try {
    const month = new URL(req.url).searchParams.get("month") ?? "";
    if (!isValidYearMonth(month)) return badRequest("month inválido (esperado YYYY-MM)");
    return ok(await budgetPayload(month));
  } catch (e) {
    return handleRouteError(e);
  }
}

// PUT /api/budget — { month, items: [{categoryId, plannedCents}] }
// plannedCents = 0 remove o item do orçamento.
export async function PUT(req: Request) {
  try {
    const { month, items } = budgetPutSchema.parse(await readJson(req));

    const ids = items.map((i) => i.categoryId);
    const categories = await prisma.category.findMany({ where: { id: { in: ids } } });
    if (categories.length !== new Set(ids).size) {
      return badRequest("Uma ou mais categorias não existem.");
    }

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.plannedCents === 0) {
          await tx.budgetItem
            .deleteMany({ where: { yearMonth: month, categoryId: item.categoryId } })
            .catch(() => null);
        } else {
          await tx.budgetItem.upsert({
            where: { yearMonth_categoryId: { yearMonth: month, categoryId: item.categoryId } },
            update: { plannedCents: item.plannedCents },
            create: { yearMonth: month, categoryId: item.categoryId, plannedCents: item.plannedCents },
          });
        }
      }
    });

    return ok(await budgetPayload(month));
  } catch (e) {
    return handleRouteError(e);
  }
}
