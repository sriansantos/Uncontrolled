import { prisma } from "@/lib/db";
import { ok, handleRouteError, notFound, badRequest, readJson } from "@/lib/api-helpers";
import { transactionUpdateSchema } from "@/lib/validate";
import { getSessionUser } from "@/lib/auth";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/transactions/[id] — só do usuário da sessão
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getSessionUser(req);
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

    const { id } = await params;
    const txId = Number(id);
    if (!Number.isInteger(txId)) return badRequest("id inválido");

    const existing = await prisma.transaction.findFirst({
      where: { id: txId, userId: user.id },
    });
    if (!existing) return notFound("Lançamento não encontrado.");

    const data = transactionUpdateSchema.parse(await readJson(req));

    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId: user.id },
      });
      if (!category) return badRequest("Categoria não encontrada.");
      const kind = data.kind ?? existing.kind;
      if (category.kind !== kind) return badRequest("Categoria não corresponde ao tipo do lançamento.");
    }

    const updated = await prisma.transaction.update({
      where: { id: txId },
      data: {
        ...(data.date !== undefined && { date: data.date }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.amountCents !== undefined && { amountCents: data.amountCents }),
        ...(data.kind !== undefined && { kind: data.kind }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: { category: true },
    });
    return ok(updated);
  } catch (e) {
    return handleRouteError(e);
  }
}

// DELETE /api/transactions/[id]
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getSessionUser(req);
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

    const { id } = await params;
    const txId = Number(id);
    if (!Number.isInteger(txId)) return badRequest("id inválido");

    const existing = await prisma.transaction.findFirst({
      where: { id: txId, userId: user.id },
    });
    if (!existing) return notFound("Lançamento não encontrado.");

    await prisma.transaction.delete({ where: { id: txId } });
    return ok({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
