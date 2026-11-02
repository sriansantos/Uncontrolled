import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

// Troca a senha de um usuário (gera o hash scrypt novo e invalida as sessões):
//   npm run password:set -- email@exemplo.com NovaSenhaForte123

async function main() {
  const [emailArg, passwordArg] = process.argv.slice(2);
  const email = (emailArg ?? "").trim().toLowerCase();
  const password = passwordArg ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("✗ Uso: npm run password:set -- email@exemplo.com NovaSenhaForte123");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("✗ A senha precisa ter pelo menos 8 caracteres.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`✗ Usuário ${email} não existe.`);
    process.exit(1);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    }),
    // força re-login em todos os aparelhos
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  console.log(`✅ Senha alterada para ${email}. Todas as sessões foram encerradas.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("✗ Falhou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
