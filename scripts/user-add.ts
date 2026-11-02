import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { seedCategoriesForUser } from "../src/lib/seed-categories";

// Cria um usuário de acesso com as categorias padrão da planilha:
//   npm run user:add -- email@exemplo.com senhaForte123
// (mínimo 8 caracteres). O primeiro acesso pelo site também funciona —
// mas só enquanto não existir nenhum usuário.

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
  const cats = await seedCategoriesForUser(user.id);
  console.log(`✅ Usuário criado: ${user.email} (id ${user.id}) com ${cats} categorias padrão.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("✗ Falhou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
