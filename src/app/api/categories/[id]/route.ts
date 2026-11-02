import { prisma } from "@/lib/db";
import { ok, handleRouteError, notFound, badRequest, conflict, readJson } from "@/lib/api-helpers";
import { categoryUpdateSchema } from "@/lib/validate";
import { getSessionUser } from "@/lib/auth";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/categories/[id] — do usuário da sessão
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getSessionUser(req);
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

    const { id } = await params;
    const catId = Number(id);
    if (!Number.isInteger(catId)) return badRequest("id inválido");

    const existing = await prisma.category.findFirst({
      where: { id: catId, userId: user.id },
    });
    if (!existing) return notFound("Categoria não encontrada.");

    const data = categoryUpdateSchema.parse(await readJson(req));
    if (existing.kind === "INCOME" && data.tier) {
      return badRequest("Categorias de entrada não têm tier.");
    }

    const updated = await prisma.category.update({
      where: { id: catId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.tier !== undefined && { tier: data.tier }),
        ...(data.active !== undefined && { active: data.active }),
      },
      include: { _count: { select: { transactions: true } } },
    });
    return ok(updated);
  } catch (e) {
    return handleRouteError(e);
  }
}

// DELETE /api/categories/[id] — bloqueado quando há histórico
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getSessionUser(req);
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

    const { id } = await params;
    const catId = Number(id);
    if (!Number.isInteger(catId)) return badRequest("id inválido");

    const existing = await prisma.category.findFirst({
      where: { id: catId, userId: user.id },
      include: {
        _count: { select: { transactions: true, budgetItems: true, recurrences: true } },
      },
    });
    if (!existing) return notFound("Categoria não encontrada.");

    const inUse =
      existing._count.transactions > 0 ||
      existing._count.budgetItems > 0 ||
      existing._count.recurrences > 0;
    if (inUse) {
      return conflict(
        "Não é possível excluir: a categoria possui lançamentos, orçamento ou recorrências. Desative-a em vez disso."
      );
    }

    await prisma.category.delete({ where: { id: catId } });
    return ok({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
