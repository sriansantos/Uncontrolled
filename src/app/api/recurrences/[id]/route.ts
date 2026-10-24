import { prisma } from "@/lib/db";
import { ok, handleRouteError, notFound, badRequest, readJson } from "@/lib/api-helpers";
import { recurrenceUpdateSchema } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/recurrences/[id]
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const recId = Number(id);
    if (!Number.isInteger(recId)) return badRequest("id inválido");

    const existing = await prisma.recurrence.findUnique({ where: { id: recId } });
    if (!existing) return notFound("Recorrência não encontrada.");

    const data = recurrenceUpdateSchema.parse(await readJson(req));

    if (data.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) return badRequest("Categoria não encontrada.");
      if (category.kind !== "EXPENSE") return badRequest("Recorrências devem usar categoria de saída.");
    }

    const updated = await prisma.recurrence.update({
      where: { id: recId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.amountCents !== undefined && { amountCents: data.amountCents }),
        ...(data.dueDay !== undefined && { dueDay: data.dueDay }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.active !== undefined && { active: data.active }),
      },
      include: { category: true },
    });
    return ok(updated);
  } catch (e) {
    return handleRouteError(e);
  }
}

// DELETE /api/recurrences/[id] — histórico de pagamentos é preservado
// (lançamentos ficam, apenas desvinculados).
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const recId = Number(id);
    if (!Number.isInteger(recId)) return badRequest("id inválido");

    const existing = await prisma.recurrence.findUnique({ where: { id: recId } });
    if (!existing) return notFound("Recorrência não encontrada.");

    await prisma.$transaction([
      prisma.transaction.updateMany({ where: { recurrenceId: recId }, data: { recurrenceId: null } }),
      prisma.recurrence.delete({ where: { id: recId } }),
    ]);
    return ok({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
