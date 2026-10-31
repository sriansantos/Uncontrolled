import { handleWhatsAppMessage } from "@/lib/whatsapp";
import { ok, handleRouteError, badRequest, readJson } from "@/lib/api-helpers";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// POST /api/whatsapp/message — recebe o texto da mensagem e devolve a resposta.
// Proteções: token compartilhado (WHATSAPP_TOKEN no .env, header x-bot-token)
// + rate limit por IP. Exceção à autenticação de sessão de propósito.
export async function POST(req: Request) {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    if (token && req.headers.get("x-bot-token") !== token) {
      return Response.json({ error: "Token inválido." }, { status: 401 });
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

    const result = await handleWhatsAppMessage(body.text);
    if (!result.reply) return badRequest("Mensagem vazia.");
    return ok(result);
  } catch (e) {
    return handleRouteError(e);
  }
}
