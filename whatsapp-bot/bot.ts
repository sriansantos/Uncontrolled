import "dotenv/config";
import fs from "node:fs";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from "baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import path from "node:path";

// Ponte WhatsApp → API local. Toda a inteligência (interpretar e lançar)
// vive no app (POST /api/whatsapp/message); aqui é só conexão e resposta.

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const TOKEN = process.env.WHATSAPP_TOKEN ?? "";
// Opcional: ALLOWED_JIDS=numero@c.us,grupo@g.us restringe por JID completo
// (inclui grupos). Grupos também exigem o prefixo "!".
const ALLOWED_JIDS = (process.env.ALLOWED_JIDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Números (com DDI) que podem conversar com o bot em chat direto:
//   ALLOWED_NUMBERS=5562920053791
// Se ficar vazio, o bot escuta TODOS os chats diretos (comportamento antigo).
// A conversa consigo mesmo (self-chat) é sempre permitida — o WhatsApp pode
// identificá-la pelo número OU pelo LID (identificador interno), e os dois
// são reconhecidos.
const ALLOWED_NUMBERS = (process.env.ALLOWED_NUMBERS ?? "")
  .split(",")
  .map((s) => s.replace(/\D/g, ""))
  .filter(Boolean);

type WASock = ReturnType<typeof makeWASocket>;

// Identidades do próprio bot (número e LID), em dígitos puros.
function ownIdDigits(sock: WASock): Set<string> {
  const ids = new Set<string>();
  const u = sock.user as { id?: string; lid?: string } | undefined;
  if (u?.id) ids.add(u.id.split("@")[0].split(":")[0].replace(/\D/g, ""));
  if (u?.lid) ids.add(u.lid.split("@")[0].split(":")[0].replace(/\D/g, ""));
  ids.delete("");
  return ids;
}

// Sessão configurável: no Render use um disco persistente (BOT_SESSION_DIR)
// para não perder o pareamento a cada deploy.
const SESSION_DIR = path.resolve(
  process.env.BOT_SESSION_DIR ?? "whatsapp-bot/session"
);
const REPLY_MARKER = /^\s*(✅|❌|ℹ️|🗑️|📊|🤖|⚠️)/; // nossas próprias respostas (echo)

async function ask(text: string, chat: string): Promise<string | null> {
  try {
    const res = await fetch(`${APP_URL}/api/whatsapp/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(TOKEN ? { "x-bot-token": TOKEN } : {}),
      },
      body: JSON.stringify({ text, chat }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      const msg = (detail as { error?: string })?.error;
      console.error(`✗ API ${res.status}: ${msg ?? "sem detalhe"} — o app está rodando?`);
      // erro visível para quem mandou a mensagem (token errado/rate limit)
      if (res.status === 401) return "⚠️ Token do bot inválido — confira WHATSAPP_TOKEN no .env e no painel do Render.";
      if (res.status === 429) return `⚠️ ${msg ?? "Muitas mensagens; aguarde."}`;
      return "⚠️ O servidor recusou a mensagem. Tente de novo em instantes.";
    }
    const data = (await res.json()) as { reply?: string };
    return data.reply ?? null;
  } catch {
    console.error("✗ API não respondeu — o app está rodando? (npm run dev /Render acordando)");
    return "⚠️ Não consegui falar com o servidor agora. Tente de novo em instantes.";
  }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\n📱 Escaneie este QR no WhatsApp: Aparelhos conectados → Conectar aparelho\n");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      console.log("✅ Bot conectado! Mande mensagens para este número (ou use ! em grupos).");
      console.log(`   Falando com a API em ${APP_URL}`);
    }
    if (connection === "close") {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
        ?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        // Desconectaram o bot pelo celular: a sessão morreu. Auto-recuperação:
        // limpa a sessão e gera um QR novo — só escanear de novo.
        console.log(`✗ Sessão deslogada — limpando ${SESSION_DIR} e gerando um novo QR em 3s…`);
        await fs.promises.rm(SESSION_DIR, { recursive: true, force: true });
        setTimeout(() => void start(), 3000);
        return;
      }
      console.log("↻ Conexão caiu; reconectando em 3s…");
      setTimeout(() => void start(), 3000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      const text = m.message?.conversation ?? m.message?.extendedTextMessage?.text;
      const jid = m.key.remoteJid;
      if (!text || !jid) continue;
      if (jid === "status@broadcast" || jid.endsWith("@newsletter")) continue;
      if (REPLY_MARKER.test(text)) continue;

      const isGroup = jid.endsWith("@g.us");
      let body = text.trim();
      if (isGroup) {
        if (!body.startsWith("!")) continue;
        body = body.slice(1).trim();
      }
      if (ALLOWED_JIDS.length > 0 && !ALLOWED_JIDS.includes(jid)) continue;

      // Chat direto: a conversa consigo mesmo é sempre permitida (o WhatsApp
      // pode identificá-la pelo número OU pelo LID). Outros números só com
      // ALLOWED_NUMBERS — os dígitos aparecem no log de "ignorado" para copiar.
      if (!isGroup) {
        const chatNumber = jid.split("@")[0].replace(/\D/g, "");
        const own = ownIdDigits(sock);
        const isSelfChat = own.has(chatNumber);
        if (!isSelfChat && ALLOWED_NUMBERS.length > 0 && !ALLOWED_NUMBERS.includes(chatNumber)) {
          console.log(
            `↩ ignorado — número fora da lista: ${chatNumber}` +
              (own.size ? ` (o dono do bot é: ${[...own].join(", ")})` : "")
          );
          continue;
        }
      }

      if (!body) continue;

      console.log(`→ ${isGroup ? "grupo" : "chat"}: "${body}"`);
      const reply = await ask(body, jid);
      if (reply) {
        await sock.sendMessage(jid, { text: reply }, { quoted: m });
        console.log(`← respondido`);
      }
    }
  });
}

console.log("🤖 Uncontrollader WhatsApp Bot");
console.log(`   API: ${APP_URL}  |  Sessão: ${SESSION_DIR}`);
void start().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
