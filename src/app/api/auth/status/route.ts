import { ok, handleRouteError } from "@/lib/api-helpers";
import { getAuthenticatedUser, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

// GET /api/auth/status — público. Diz se há sessão ativa e se o app ainda
// precisa do "primeiro acesso" (nenhum usuário cadastrado).
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req.cookies.get(SESSION_COOKIE)?.value);
    const setupRequired = (await prisma.user.count()) === 0;
    return ok({ authenticated: !!user, email: user?.email ?? null, setupRequired });
  } catch (e) {
    return handleRouteError(e);
  }
}
