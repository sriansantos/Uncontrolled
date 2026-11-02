import { handleWhatsAppMessage } from "@/lib/whatsapp";
import { ok, handleRouteError, badRequest, readJson } from "@/lib/api-helpers";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

// POST /api/whatsapp/message — recebe o texto da mensagem e devolve a resposta.
// Autenticação: header x-bot-token → tabela Bot (token → usuário dono).
// Rate limit por IP como segunda camada.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-bot-token");
    if (!token) {
      return Response.json({ error: "Token do bot ausente." }, { status: 401 });
    }
    const bot = await prisma.bot.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!bot) {
      return Response.json({ error: "Token do bot inválido." }, { status: 401 });
    }

    const limit = rateLimit(`whatsapp:${clientIp(req)}`, {
      max: 60,
      windowMs: 60 * 1000,
      blockMs: 5 * 60 * 1000,
    });
    if (!limit.ok) {
      return Response.json(
        { error: "Muitas mensagens; aguarde." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const body = (await readJson(req)) as { text?: string } | null;
    if (!body?.text) return badRequest("Envie { text: \"...\" } com a mensagem.");

    const result = await handleWhatsAppMessage(body.text, bot.userId);
    if (!result.reply) return badRequest("Mensagem vazia.");
    return ok(result);
  } catch (e) {
    return handleRouteError(e);
  }
}
