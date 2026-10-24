import { getDashboard } from "@/lib/dashboard";
import { ok, handleRouteError, badRequest } from "@/lib/api-helpers";
import { isValidYearMonth, currentYearMonth } from "@/lib/month";

// GET /api/dashboard?month=YYYY-MM — todos os indicadores do mês
export async function GET(req: Request) {
  try {
    const month = new URL(req.url).searchParams.get("month") ?? currentYearMonth();
    if (!isValidYearMonth(month)) return badRequest("month inválido (esperado YYYY-MM)");
    return ok(await getDashboard(month));
  } catch (e) {
    return handleRouteError(e);
  }
}
