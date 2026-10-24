import { prisma } from "@/lib/db";
import { ok, handleRouteError, readJson } from "@/lib/api-helpers";
import { categoryCreateSchema } from "@/lib/validate";

// GET /api/categories?kind=&includeInactive=1
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");
    const includeInactive = url.searchParams.get("includeInactive") === "1";

    const items = await prisma.category.findMany({
      where: {
        ...(kind === "INCOME" || kind === "EXPENSE" ? { kind } : {}),
        ...(includeInactive ? {} : { active: true }),
      },
      include: { _count: { select: { transactions: true } } },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return ok({ items });
  } catch (e) {
    return handleRouteError(e);
  }
}

// POST /api/categories
export async function POST(req: Request) {
  try {
    const data = categoryCreateSchema.parse(await readJson(req));
    const tier = data.kind === "EXPENSE" ? (data.tier ?? null) : null;
    const last = await prisma.category.findFirst({
      where: { kind: data.kind },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const created = await prisma.category.create({
      data: {
        name: data.name,
        kind: data.kind,
        tier,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
    return ok(created, 201);
  } catch (e) {
    return handleRouteError(e);
  }
}
