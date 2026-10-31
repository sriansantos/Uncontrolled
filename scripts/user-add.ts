import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

// Cria um usuário de acesso: npm run user:add -- email@exemplo.com senhaForte123
// Útil para criar acessos adicionais sem passar pela tela de primeiro acesso.

async function main() {
  const [emailArg, passwordArg] = process.argv.slice(2);
  const email = (emailArg ?? "").trim().toLowerCase();
  const password = passwordArg ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("✗ Email inválido. Uso: npm run user:add -- email@exemplo.com senhaForte123");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("✗ A senha precisa ter pelo menos 8 caracteres.");
    process.exit(1);
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    console.error(`✗ Já existe um usuário com o email ${email}.`);
    process.exit(1);
  }

  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  });
  console.log(`✅ Usuário criado: ${user.email} (id ${user.id})`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("✗ Falhou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
