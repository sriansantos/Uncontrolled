import { prisma } from "@/lib/db";
import { ok, handleRouteError, notFound, badRequest, readJson } from "@/lib/api-helpers";
import { recurrenceUpdateSchema } from "@/lib/validate";
import { getSessionUser } from "@/lib/auth";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/recurrences/[id] — do usuário da sessão
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getSessionUser(req);
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

    const { id } = await params;
    const recId = Number(id);
    if (!Number.isInteger(recId)) return badRequest("id inválido");

    const existing = await prisma.recurrence.findFirst({
      where: { id: recId, userId: user.id },
    });
    if (!existing) return notFound("Recorrência não encontrada.");

    const data = recurrenceUpdateSchema.parse(await readJson(req));

    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId: user.id },
      });
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
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getSessionUser(req);
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

    const { id } = await params;
    const recId = Number(id);
    if (!Number.isInteger(recId)) return badRequest("id inválido");

    const existing = await prisma.recurrence.findFirst({
      where: { id: recId, userId: user.id },
    });
    if (!existing) return notFound("Recorrência não encontrada.");

    await prisma.$transaction([
      prisma.transaction.updateMany({
        where: { recurrenceId: recId },
        data: { recurrenceId: null },
      }),
      prisma.recurrence.delete({ where: { id: recId } }),
    ]);
    return ok({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
