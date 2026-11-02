import { prisma } from "./db";

// Categorias padrão da planilha Primo Pobre — criadas para cada usuário
// novo (primeiro acesso ou npm run user:add).

export const DEFAULT_INCOME = [
  "Salário líquido",
  "Vale-alimentação",
  "Vale-refeição",
  "Renda extra",
];

export const DEFAULT_ESSENTIAL = [
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

export const DEFAULT_NON_ESSENTIAL = [
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

export async function seedCategoriesForUser(userId: number): Promise<number> {
  let order = 0;
  let created = 0;
  const upsert = async (name: string, kind: "INCOME" | "EXPENSE", tier: string | null) => {
    order++;
    const existing = await prisma.category.findUnique({
      where: { userId_name: { userId, name } },
    });
    if (existing) return;
    await prisma.category.create({
      data: { name, kind, tier, sortOrder: order, userId },
    });
    created++;
  };

  for (const name of DEFAULT_INCOME) await upsert(name, "INCOME", null);
  for (const name of DEFAULT_ESSENTIAL) await upsert(name, "EXPENSE", "ESSENCIAL");
  for (const name of DEFAULT_NON_ESSENTIAL) await upsert(name, "EXPENSE", "NAO_ESSENCIAL");
  return created;
}
