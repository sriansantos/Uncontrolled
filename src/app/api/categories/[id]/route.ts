import { prisma } from "@/lib/db";
import { ok, handleRouteError, notFound, badRequest, conflict, readJson } from "@/lib/api-helpers";
import { categoryUpdateSchema } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/categories/[id]
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const catId = Number(id);
    if (!Number.isInteger(catId)) return badRequest("id inválido");

    const existing = await prisma.category.findUnique({ where: { id: catId } });
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
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const catId = Number(id);
    if (!Number.isInteger(catId)) return badRequest("id inválido");

    const existing = await prisma.category.findUnique({
      where: { id: catId },
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
