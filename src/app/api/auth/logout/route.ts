import { ok, handleRouteError } from "@/lib/api-helpers";
import { destroySession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import type { NextRequest } from "next/server";

// POST /api/auth/logout — invalida a sessão atual e limpa o cookie.
export async function POST(req: NextRequest) {
  try {
    await destroySession(req.cookies.get(SESSION_COOKIE)?.value);
    const res = ok({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
    return res;
  } catch (e) {
    return handleRouteError(e);
  }
}
