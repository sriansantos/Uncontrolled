import { prisma } from "@/lib/db";
import { ok, handleRouteError, badRequest, readJson, conflict } from "@/lib/api-helpers";
import {
  createSession,
  sessionCookieOptions,
  hashPassword,
  SESSION_COOKIE,
} from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

const REGISTER_LIMIT = { max: 3, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 };

// POST /api/auth/register — cria o PRIMEIRO usuário apenas. Depois disso o
// endpoint morre (403) e novos acessos passam pelo login ou npm run user:add.
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`register:${clientIp(req)}`, REGISTER_LIMIT);
    if (!limit.ok) {
      return Response.json({ error: "Muitas tentativas." }, { status: 429 });
    }

    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return conflict("O acesso já foi configurado. Use o login.");
    }

    const body = (await readJson(req)) as { email?: string; password?: string } | null;
    const email = body?.email?.trim().toLowerCase() ?? "";
    const password = body?.password ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest("Email inválido.");
    }
    if (password.length < 8) {
      return badRequest("A senha precisa ter pelo menos 8 caracteres.");
    }

    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password) },
    });

    const { token, maxAge } = await createSession(user.id);
    const res = ok({ email: user.email }, 201);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
    return res;
  } catch (e) {
    return handleRouteError(e);
  }
}
