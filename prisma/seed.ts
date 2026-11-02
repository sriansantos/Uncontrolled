import "dotenv/config";
import { prisma } from "../src/lib/db";
import { seedCategoriesForUser } from "../src/lib/seed-categories";

// npm run db:seed — cria as categorias padrão para TODOS os usuários existentes
// npm run db:seed:demo -- email@exemplo.com — cria lançamentos de exemplo
//   do mês corrente para o usuário informado (após o seed de categorias)

async function seedCategoriesForAllUsers() {
  const users = await prisma.user.findMany({ select: { id: true } });
  if (users.length === 0) {
    console.log("nenhum usuário no banco — crie o acesso no app primeiro");
    return;
  }
  for (const u of users) {
    const created = await seedCategoriesForUser(u.id);
    console.log(`usuário ${u.id}: ${created} categoria(s) criada(s)`);
  }
}

async function seedDemo(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    console.error(`✗ usuário ${email} não existe`);
    process.exit(1);
  }
  const existing = await prisma.transaction.count({ where: { userId: user.id } });
  if (existing > 0) {
    console.log(`usuário já possui ${existing} lançamentos; demo ignorada.`);
    return;
  }
  await seedCategoriesForUser(user.id);

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const d = (day: number) => `${ym}-${String(day).padStart(2, "0")}`;

  const cat = async (name: string) => {
    const c = await prisma.category.findFirst({ where: { userId: user.id, name } });
    if (!c) throw new Error(`categoria ${name} não encontrada`);
    return c;
  };
  const [salario, va, vr, aluguel, mercado, luz, internet, invest, academia, streaming, restaurantes, transporte, lazer, padaria, farmacia] =
    await Promise.all([
      cat("Salário líquido"), cat("Vale-alimentação"), cat("Vale-refeição"),
      cat("Moradia (aluguel/financiamento)"), cat("Supermercado"), cat("Luz"),
      cat("Internet"), cat("Investimentos"), cat("Academia/Esportes"),
      cat("Streaming"), cat("Restaurantes/iFood"), cat("Transporte (ônibus/apps)"),
      cat("Lazer"), cat("Padaria/Feira"), cat("Farmácia"),
    ]);

  const budget: Array<[number, number]> = [
    [salario.id, 650000], [va.id, 60000], [vr.id, 40000],
    [aluguel.id, 180000], [mercado.id, 120000], [luz.id, 15000],
    [internet.id, 12000], [invest.id, 100000], [academia.id, 10000],
    [streaming.id, 8000], [restaurantes.id, 40000], [transporte.id, 25000],
    [lazer.id, 30000], [padaria.id, 12000],
  ];
  for (const [categoryId, plannedCents] of budget) {
    await prisma.budgetItem.upsert({
      where: { yearMonth_categoryId: { yearMonth: ym, categoryId } },
      update: { plannedCents },
      create: { yearMonth: ym, categoryId, plannedCents, userId: user.id },
    });
  }

  const recAluguel = await prisma.recurrence.create({ data: { name: "Aluguel", amountCents: 180000, dueDay: 10, categoryId: aluguel.id, userId: user.id } });
  const recInternet = await prisma.recurrence.create({ data: { name: "Internet fibra", amountCents: 11990, dueDay: 15, categoryId: internet.id, userId: user.id } });
  const recNetflix = await prisma.recurrence.create({ data: { name: "Netflix", amountCents: 5590, dueDay: 8, categoryId: streaming.id, userId: user.id } });
  const recAcademia = await prisma.recurrence.create({ data: { name: "Academia", amountCents: 9990, dueDay: 5, categoryId: academia.id, userId: user.id } });
  await prisma.recurrence.create({ data: { name: "Spotify", amountCents: 2190, dueDay: 20, categoryId: streaming.id, userId: user.id } });

  const tx = (date: string, description: string, amountCents: number, kind: "INCOME" | "EXPENSE", categoryId: number, recurrenceId?: number) =>
    prisma.transaction.create({
      data: { date, description, amountCents, kind, categoryId, recurrenceId, source: "MANUAL", userId: user.id },
    });

  await tx(d(5), "Salário", 650000, "INCOME", salario.id);
  await tx(d(5), "VA", 60000, "INCOME", va.id);
  await tx(d(5), "VR", 40000, "INCOME", vr.id);
  await tx(d(10), "Aluguel", 180000, "EXPENSE", aluguel.id, recAluguel.id);
  await tx(d(15), "Internet fibra", 11990, "EXPENSE", internet.id, recInternet.id);
  await tx(d(8), "Netflix", 5590, "EXPENSE", streaming.id, recNetflix.id);
  await tx(d(5), "Academia", 9990, "EXPENSE", academia.id, recAcademia.id);
  await tx(d(2), "Supermercado — compra do mês", 31245, "EXPENSE", mercado.id);
  await tx(d(12), "Supermercado", 18990, "EXPENSE", mercado.id);
  await tx(d(20), "Hortifruti", 42130, "EXPENSE", mercado.id);
  await tx(d(11), "Conta de luz", 13875, "EXPENSE", luz.id);
  await tx(d(6), "Investimento mensal", 100000, "EXPENSE", invest.id);
  await tx(d(14), "iFood jantar", 8740, "EXPENSE", restaurantes.id);
  await tx(d(19), "Uber", 3420, "EXPENSE", transporte.id);
  await tx(d(21), "Cinema", 7800, "EXPENSE", lazer.id);
  await tx(d(3), "Padaria", 4580, "EXPENSE", padaria.id);
  await tx(d(17), "Farmácia", 6235, "EXPENSE", farmacia.id);

  console.log(`dados de demonstração criados para ${user.email} (${ym})`);
}

async function main() {
  await seedCategoriesForAllUsers();
  const emailArg = process.argv[process.argv.indexOf("--demo") + 1];
  if (process.argv.includes("--demo")) {
    if (!emailArg) {
      console.error("uso: npm run db:seed:demo -- email@exemplo.com");
      process.exit(1);
    }
    await seedDemo(emailArg);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
