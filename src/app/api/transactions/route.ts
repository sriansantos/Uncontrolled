import { prisma } from "@/lib/db";
import { ok, handleRouteError, badRequest, readJson } from "@/lib/api-helpers";
import { transactionCreateSchema } from "@/lib/validate";
import { getSessionUser } from "@/lib/auth";
import { isValidYearMonth, monthRange } from "@/lib/month";
import type { NextRequest } from "next/server";

// GET /api/transactions?month=YYYY-MM&kind=&categoryId=&q=&limit=&offset=
// Sempre escopado ao usuário da sessão.
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    const kind = url.searchParams.get("kind");
    const categoryId = Number(url.searchParams.get("categoryId")) || null;
    const q = url.searchParams.get("q")?.trim() || null;
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

    const where: Record<string, unknown> = { userId: user.id };
    if (month) {
      if (!isValidYearMonth(month)) return badRequest("month inválido (esperado YYYY-MM)");
      const { start, end } = monthRange(month);
      where.date = { gte: start, lte: end };
    }
    if (kind === "INCOME" || kind === "EXPENSE") where.kind = kind;
    if (categoryId) where.categoryId = categoryId;
    if (q) where.description = { contains: q };

    const [items, total, incomeSum, expenseSum] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { category: true, recurrence: true },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({ where: { ...where, kind: "INCOME" }, _sum: { amountCents: true } }),
      prisma.transaction.aggregate({ where: { ...where, kind: "EXPENSE" }, _sum: { amountCents: true } }),
    ]);

    return ok({
      items,
      total,
      sums: {
        incomeCents: incomeSum._sum.amountCents ?? 0,
        expenseCents: expenseSum._sum.amountCents ?? 0,
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

// POST /api/transactions
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

    const body = await readJson(req);
    const data = transactionCreateSchema.parse(body);

    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId: user.id },
    });
    if (!category) return badRequest("Categoria não encontrada.");
    if (category.kind !== data.kind) {
      return badRequest(
        `A categoria "${category.name}" é de ${category.kind === "INCOME" ? "entrada" : "saída"}; o lançamento é de ${data.kind === "INCOME" ? "entrada" : "saída"}.`
      );
    }
    if (data.recurrenceId) {
      const rec = await prisma.recurrence.findFirst({
        where: { id: data.recurrenceId, userId: user.id },
      });
      if (!rec) return badRequest("Recorrência não encontrada.");
    }

    const created = await prisma.transaction.create({
      data: {
        date: data.date,
        description: data.description,
        amountCents: data.amountCents,
        kind: data.kind,
        categoryId: data.categoryId,
        source: data.source ?? "MANUAL",
        recurrenceId: data.recurrenceId ?? null,
        notes: data.notes ?? null,
        userId: user.id,
      },
      include: { category: true },
    });
    return ok(created, 201);
  } catch (e) {
    return handleRouteError(e);
  }
}
