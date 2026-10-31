import { prisma } from "@/lib/db";
import { ok, handleRouteError, badRequest, readJson } from "@/lib/api-helpers";
import {
  createSession,
  sessionCookieOptions,
  verifyPassword,
  SESSION_COOKIE,
} from "@/lib/auth";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

const LOGIN_LIMIT = { max: 5, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 };

// POST /api/auth/login — { email, password }
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const limit = rateLimit(`login:${ip}`, LOGIN_LIMIT);
    if (!limit.ok) {
      return Response.json(
        {
          error: `Muitas tentativas. Tente novamente em ${Math.ceil(limit.retryAfterSec / 60)} min.`,
        },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const body = (await readJson(req)) as { email?: string; password?: string } | null;
    const email = body?.email?.trim().toLowerCase() ?? "";
    const password = body?.password ?? "";
    if (!email || !password) return badRequest("Informe email e senha.");

    const user = await prisma.user.findUnique({ where: { email } });

    // custo de hash mesmo com usuário inexistente (evita medir tempo p/ enumerar emails)
    const stored =
      user?.passwordHash ??
      "scrypt$16384$8$1$00000000000000000000000000000000$" + "0".repeat(128);
    const valid = await verifyPassword(password, stored);

    if (!user || !valid) {
      return Response.json({ error: "Email ou senha inválidos." }, { status: 401 });
    }

    resetRateLimit(`login:${ip}`); // sucesso limpa o contador de falhas
    const { token, maxAge } = await createSession(user.id);
    const res = ok({ email: user.email });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
    return res;
  } catch (e) {
    return handleRouteError(e);
  }
}
