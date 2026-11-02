import { getDashboard } from "@/lib/dashboard";
import { ok, handleRouteError, badRequest } from "@/lib/api-helpers";
import { getSessionUser } from "@/lib/auth";
import { isValidYearMonth, currentYearMonth } from "@/lib/month";
import type { NextRequest } from "next/server";

// GET /api/dashboard?month=YYYY-MM — indicadores do usuário da sessão
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

    const month = new URL(req.url).searchParams.get("month") ?? currentYearMonth();
    if (!isValidYearMonth(month)) return badRequest("month inválido (esperado YYYY-MM)");
    return ok(await getDashboard(month, user.id));
  } catch (e) {
    return handleRouteError(e);
  }
}
