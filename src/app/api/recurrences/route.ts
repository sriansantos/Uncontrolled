import { prisma } from "@/lib/db";
import { ok, handleRouteError, badRequest, readJson } from "@/lib/api-helpers";
import { recurrenceCreateSchema } from "@/lib/validate";
import { getSessionUser } from "@/lib/auth";
import { isValidYearMonth, monthRange, todayISO, currentYearMonth } from "@/lib/month";
import type { NextRequest } from "next/server";

// GET /api/recurrences?month=YYYY-MM — status pago/pendente do mês, do usuário
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

    const monthParam = new URL(req.url).searchParams.get("month") ?? currentYearMonth();
    if (!isValidYearMonth(monthParam)) return badRequest("month inválido (esperado YYYY-MM)");
    const { start, end } = monthRange(monthParam);

    const items = await prisma.recurrence.findMany({
      where: { active: true, userId: user.id },
      include: {
        category: true,
        transactions: { where: { date: { gte: start, lte: end } } },
      },
      orderBy: [{ dueDay: "asc" }, { name: "asc" }],
    });

    const today = todayISO();
    const isCurrentMonth = monthParam === currentYearMonth();

    return ok({
      month: monthParam,
      items: items.map((r) => {
        const paidTx = r.transactions[0];
        return {
          id: r.id,
          name: r.name,
          amountCents: r.amountCents,
          dueDay: r.dueDay,
          categoryId: r.categoryId,
          categoryName: r.category.name,
          paid: !!paidTx,
          overdue: !paidTx && isCurrentMonth && r.dueDay < Number(today.slice(8, 10)),
          transactionId: paidTx?.id ?? null,
        };
      }),
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

// POST /api/recurrences — cria para o usuário da sessão
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

    const data = recurrenceCreateSchema.parse(await readJson(req));

    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId: user.id },
    });
    if (!category) return badRequest("Categoria não encontrada.");
    if (category.kind !== "EXPENSE") {
      return badRequest("Recorrências devem usar uma categoria de saída.");
    }

    const created = await prisma.recurrence.create({
      data: {
        name: data.name,
        amountCents: data.amountCents,
        dueDay: data.dueDay,
        categoryId: data.categoryId,
        userId: user.id,
      },
      include: { category: true },
    });
    return ok(created, 201);
  } catch (e) {
    return handleRouteError(e);
  }
}
