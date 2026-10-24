import { prisma } from "../src/lib/db";

// Categorias no modelo da planilha "Primo Pobre 2026"
const INCOME_CATEGORIES = [
  "Salário líquido",
  "Vale-alimentação",
  "Vale-refeição",
  "Renda extra",
];

const ESSENTIAL_CATEGORIES = [
  "Moradia (aluguel/financiamento)",
  "Condomínio",
  "Supermercado",
  "Água",
  "Luz",
  "Gás",
  "IPTU",
  "Plano de saúde",
  "Seguro de vida",
  "Investimentos",
];

const NON_ESSENTIAL_CATEGORIES = [
  "Academia/Esportes",
  "Aplicativos e assinaturas",
  "Cartão de crédito",
  "Celular/Telefonia",
  "Combustível",
  "Empréstimos",
  "Educação (escola/cursos)",
  "Farmácia",
  "Financiamento de veículos",
  "Animais",
  "Imprevistos",
  "Transporte (ônibus/apps)",
  "Internet",
  "Lazer",
  "Streaming",
  "Padaria/Feira",
  "Restaurantes/iFood",
  "Salão/Estética",
  "Tarifas bancárias",
  "Outras despesas",
];

async function seedCategories() {
  let order = 0;
  for (const name of INCOME_CATEGORIES) {
    order++;
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, kind: "INCOME", tier: null, sortOrder: order },
    });
  }
  for (const name of ESSENTIAL_CATEGORIES) {
    order++;
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, kind: "EXPENSE", tier: "ESSENCIAL", sortOrder: order },
    });
  }
  for (const name of NON_ESSENTIAL_CATEGORIES) {
    order++;
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, kind: "EXPENSE", tier: "NAO_ESSENCIAL", sortOrder: order },
    });
  }
  console.log(
    `Categorias prontas: ${INCOME_CATEGORIES.length} entradas, ${ESSENTIAL_CATEGORIES.length} essenciais, ${NON_ESSENTIAL_CATEGORIES.length} não essenciais.`
  );
}

// Dados fictícios do mês corrente para visualizar o dashboard populado.
// Criar o banco sem demo: apague dev.db e rode `npx prisma migrate dev`.
async function seedDemo() {
  const existing = await prisma.transaction.count();
  if (existing > 0) {
    console.log(`Banco já possui ${existing} lançamentos; demo ignorada.`);
    return;
  }

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const d = (day: number) => `${ym}-${String(day).padStart(2, "0")}`;

  const cat = (name: string) => prisma.category.findUniqueOrThrow({ where: { name } });
  const [
    salario, va, vr, aluguel, mercado, luz, internet, invest, academia,
    streaming, restaurantes, transporte, lazer, padaria, farmacia,
  ] = await Promise.all(
    [
      "Salário líquido", "Vale-alimentação", "Vale-refeição",
      "Moradia (aluguel/financiamento)", "Supermercado", "Luz", "Internet",
      "Investimentos", "Academia/Esportes", "Streaming", "Restaurantes/iFood",
      "Transporte (ônibus/apps)", "Lazer", "Padaria/Feira", "Farmácia",
    ].map(cat)
  );

  // Orçamento do mês (plannedCents)
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
      create: { yearMonth: ym, categoryId, plannedCents },
    });
  }

  // Recorrências
  const recAluguel = await prisma.recurrence.create({ data: { name: "Aluguel", amountCents: 180000, dueDay: 10, categoryId: aluguel.id } });
  const recInternet = await prisma.recurrence.create({ data: { name: "Internet fibra", amountCents: 11990, dueDay: 15, categoryId: internet.id } });
  const recNetflix = await prisma.recurrence.create({ data: { name: "Netflix", amountCents: 5590, dueDay: 8, categoryId: streaming.id } });
  const recAcademia = await prisma.recurrence.create({ data: { name: "Academia", amountCents: 9990, dueDay: 5, categoryId: academia.id } });
  await prisma.recurrence.create({ data: { name: "Spotify", amountCents: 2190, dueDay: 20, categoryId: streaming.id } });

  // Lançamentos do mês (recorrências pagas levam recurrenceId)
  const tx = (
    date: string, description: string, amountCents: number,
    kind: "INCOME" | "EXPENSE", categoryId: number, recurrenceId?: number
  ) => prisma.transaction.create({
    data: { date, description, amountCents, kind, categoryId, recurrenceId },
  });

  await tx(d(5), "Salário outubro", 650000, "INCOME", salario.id);
  await tx(d(5), "VA outubro", 60000, "INCOME", va.id);
  await tx(d(5), "VR outubro", 40000, "INCOME", vr.id);
  await tx(d(10), "Aluguel outubro", 180000, "EXPENSE", aluguel.id, recAluguel.id);
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

  console.log(`Dados de demonstração criados para ${ym}.`);
}

async function main() {
  await seedCategories();
  if (process.argv.includes("--demo")) {
    await seedDemo();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
