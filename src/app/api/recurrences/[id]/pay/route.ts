import { prisma } from "@/lib/db";
import { ok, handleRouteError, notFound, badRequest, readJson } from "@/lib/api-helpers";
import { recurrencePaySchema } from "@/lib/validate";
import { monthRange } from "@/lib/month";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/recurrences/[id]/pay — { month: "YYYY-MM", date? }
// Idempotente: se já existe pagamento no mês, devolve o lançamento existente.
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const recId = Number(id);
    if (!Number.isInteger(recId)) return badRequest("id inválido");

    const rec = await prisma.recurrence.findUnique({
      where: { id: recId },
      include: { category: true },
    });
    if (!rec) return notFound("Recorrência não encontrada.");

    const { month, date } = recurrencePaySchema.parse(await readJson(req));
    const { start, end } = monthRange(month);

    const already = await prisma.transaction.findFirst({
      where: { recurrenceId: recId, date: { gte: start, lte: end } },
    });
    if (already) return ok({ transaction: already, alreadyPaid: true });

    // Data do pagamento: informada, ou o dia de vencimento limitado ao fim do mês
    const lastDay = Number(end.slice(8, 10));
    const payDate = date ?? `${month}-${String(Math.min(rec.dueDay, lastDay)).padStart(2, "0")}`;

    const created = await prisma.transaction.create({
      data: {
        date: payDate,
        description: `${rec.name} (${month})`,
        amountCents: rec.amountCents,
        kind: "EXPENSE",
        categoryId: rec.categoryId,
        source: "MANUAL",
        recurrenceId: recId,
      },
      include: { category: true },
    });
    return ok({ transaction: created, alreadyPaid: false }, 201);
  } catch (e) {
    return handleRouteError(e);
  }
}
