import "dotenv/config";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "baileys";
import pino from "pino";
import path from "node:path";

// Renegocia a sessão de criptografia do bot: conecta e envia uma mensagem
// para a própria conversa — isso força o handshake com o celular e corrige
// o "Decrypted message with closed session" após reinícios.
//
// Pare o serviço do bot antes de rodar (a sessão não pode ter dois donos):
//   sudo systemctl stop uncontrollader-bot-lyandra
//   npm run bot:rekey   (na pasta do bot, com o .env certo)
//   sudo systemctl start uncontrollader-bot-lyandra

const SESSION_DIR = path.resolve(
  process.env.BOT_SESSION_DIR ?? "whatsapp-bot/session"
);

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    markOnlineOnConnect: false,
  });
  sock.ev.on("creds.update", saveCreds);

  await new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error("timeout aguardando conexão (60s) — a sessão pode estar morta; apague a pasta da sessão e pareie de novo")),
      60000
    );
    sock.ev.on("connection.update", (u) => {
      if (u.connection === "open") {
        clearTimeout(t);
        resolve(null);
      }
    });
  });

  const jid = (
    sock.user?.id ??
    (sock.authState as { creds?: { me?: { id?: string } } } | undefined)?.creds?.me?.id ??
    ""
  )
    .split(":")[0]
    .trim();
  if (!jid) {
    console.error("✗ não consegui identificar o JID do próprio bot");
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 1500)); // Baileys preenche sock.user após o open
  await sock.sendMessage(jid, {
    text: "🔁 Sessão do bot renovada — mande seus comandos de novo 💜",
  });
  console.log(`✅ mensagem de re-chave enviada para ${jid} — sessão re-negociada`);

  await new Promise((r) => setTimeout(r, 3000));
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ Falhou:", e instanceof Error ? e.message : e);
  console.error("   Se for 'sessão morta': pare o serviço, apague a pasta da sessão e pareie de novo (QR).");
  process.exit(1);
});
