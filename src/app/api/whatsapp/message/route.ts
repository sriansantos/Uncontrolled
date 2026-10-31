import { handleWhatsAppMessage } from "@/lib/whatsapp";
import { ok, handleRouteError, badRequest, readJson } from "@/lib/api-helpers";

// POST /api/whatsapp/message — recebe o texto da mensagem e devolve a resposta.
// Proteção opcional: defina WHATSAPP_TOKEN no .env e o bot envia o header
// x-bot-token. Rodando local (localhost), sem token, é seguro.
export async function POST(req: Request) {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    if (token && req.headers.get("x-bot-token") !== token) {
      return Response.json({ error: "Token inválido." }, { status: 401 });
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
