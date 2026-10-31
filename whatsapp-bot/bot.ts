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
// Opcional: ALLOWED_JIDS=numero@c.us,grupo@g.us npm run whatsapp
const ALLOWED_JIDS = (process.env.ALLOWED_JIDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SESSION_DIR = path.resolve("whatsapp-bot/session");
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
    if (!res.ok) return null;
    const data = (await res.json()) as { reply?: string };
    return data.reply ?? null;
  } catch {
    console.error("✗ API não respondeu — o app está rodando? (npm run dev)");
    return null;
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

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
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
        console.log("✗ Sessão deslogada. Apague whatsapp-bot/session e rode de novo.");
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
      if (!body) continue;

      const reply = await ask(body, jid);
      if (reply) {
        await sock.sendMessage(jid, { text: reply }, { quoted: m });
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
