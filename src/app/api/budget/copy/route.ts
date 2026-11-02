import { prisma } from "@/lib/db";
import { ok, handleRouteError, badRequest, readJson } from "@/lib/api-helpers";
import { budgetCopySchema } from "@/lib/validate";
import { getSessionUser } from "@/lib/auth";
import type { NextRequest } from "next/server";

// POST /api/budget/copy — { from: "YYYY-MM", to: "YYYY-MM" }
// Copia os valores orçados do mês de origem para o de destino (do usuário).
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

    const { from, to } = budgetCopySchema.parse(await readJson(req));
    if (from === to) return badRequest("Origem e destino são o mesmo mês.");

    const source = await prisma.budgetItem.findMany({
      where: { yearMonth: from, category: { userId: user.id } },
    });
    if (source.length === 0) return badRequest(`Nenhum orçamento definido em ${from}.`);

    await prisma.$transaction(async (tx) => {
      for (const item of source) {
        await tx.budgetItem.upsert({
          where: { yearMonth_categoryId: { yearMonth: to, categoryId: item.categoryId } },
          update: { plannedCents: item.plannedCents },
          create: {
            yearMonth: to,
            categoryId: item.categoryId,
            plannedCents: item.plannedCents,
            userId: user.id,
          },
        });
      }
    });

    return ok({ copied: source.length, to });
  } catch (e) {
    return handleRouteError(e);
  }
}
