import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";
import { hashToken } from "../src/lib/auth";

// Registra um bot do WhatsApp e liga ao dono:
//   npm run bot:add -- nome-do-bot email@exemplo.com            (gera token novo)
//   npm run bot:add -- nome-do-bot email@exemplo.com --token TOKEN  (registra token existente)
// O token vai no .env do bot da VM (WHATSAPP_TOKEN).

async function main() {
  const args = process.argv.slice(2);
  const tokenFlagIdx = args.indexOf("--token");
  const token = tokenFlagIdx !== -1 ? args[tokenFlagIdx + 1] : undefined;
  const positional =
    tokenFlagIdx === -1
      ? args
      : [...args.slice(0, tokenFlagIdx), ...args.slice(tokenFlagIdx + 2)];
  const [nameArg, emailArg] = positional;

  const name = (nameArg ?? "").trim();
  const email = (emailArg ?? "").trim().toLowerCase();

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("✗ Uso: npm run bot:add -- nome-do-bot email@exemplo.com [--token TOKEN]");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`✗ Usuário ${email} não existe — crie com npm run user:add ou pelo site.`);
    process.exit(1);
  }

  const finalToken = token ?? randomBytes(24).toString("base64url");
  const existing = await prisma.bot.findUnique({ where: { tokenHash: hashToken(finalToken) } });
  if (existing) {
    console.error("✗ Esse token já está registrado em outro bot.");
    process.exit(1);
  }

  const bot = await prisma.bot.create({
    data: { name, tokenHash: hashToken(finalToken), userId: user.id },
  });
  console.log(`✅ Bot "${bot.name}" registrado → ${email}`);
  if (!token) {
    console.log(`TOKEN (guarde — coloque no WHATSAPP_TOKEN da VM): ${finalToken}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("✗ Falhou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
