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
  const tokenHash = hashToken(finalToken);

  // Rotação: se já existe um bot com o mesmo nome, atualiza o token dele.
  const existingByName = await prisma.bot.findFirst({ where: { name } });
  if (existingByName) {
    await prisma.bot.update({
      where: { id: existingByName.id },
      data: { tokenHash, userId: user.id },
    });
    console.log(`🔄 Bot "${name}" atualizado → ${email}`);
    if (!token) console.log(`TOKEN NOVO (coloque no WHATSAPP_TOKEN da VM): ${finalToken}`);
    await prisma.$disconnect();
    return;
  }

  const existingByToken = await prisma.bot.findUnique({ where: { tokenHash } });
  if (existingByToken) {
    console.error("✗ Esse token já está registrado em outro bot.");
    process.exit(1);
  }

  const bot = await prisma.bot.create({
    data: { name, tokenHash, userId: user.id },
  });
  console.log(`✅ Bot "${bot.name}" registrado → ${email}`);
  if (!token) {
    console.log(`TOKEN NOVO (guarde — coloque no WHATSAPP_TOKEN da VM): ${finalToken}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("✗ Falhou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
