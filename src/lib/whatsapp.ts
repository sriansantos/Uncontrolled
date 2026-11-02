import { prisma } from "./db";
import { formatBRL, parseBRLToCents } from "./money";
import { currentYearMonth, monthLabel, monthRange, todayISO } from "./month";
import { getDashboard } from "./dashboard";

// Interpretador das mensagens do WhatsApp. Toda a lógica vive no app; o bot
// é só um "cano" que entrega o texto nesta lógica e devolve a resposta.

type CategoryLite = {
  id: number;
  name: string;
  kind: string;
  tier: string | null;
  norm: string;
};

export type WhatsAppResult = { action: string; reply: string };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Palavras-chave → categorias (nomes normalizados, sem acento).
// A ordem importa: palavras mais específicas primeiro.
const KEYWORDS: Array<[string, string]> = [
  ["mercado", "supermercado"], ["supermercado", "supermercado"], ["hortifruti", "supermercado"],
  ["ifood", "restaurantes/ifood"], ["restaurante", "restaurantes/ifood"], ["delivery", "restaurantes/ifood"],
  ["padaria", "padaria/feira"], ["feira", "padaria/feira"],
  ["uber", "transporte (onibus/apps)"], ["99", "transporte (onibus/apps)"], ["onibus", "transporte (onibus/apps)"], ["passagem", "transporte (onibus/apps)"],
  ["gasolina", "combustivel"], ["combustivel", "combustivel"], ["posto", "combustivel"],
  ["netflix", "streaming"], ["spotify", "streaming"], ["streaming", "streaming"], ["disney", "streaming"], ["hbo", "streaming"], ["prime video", "streaming"],
  ["academia", "academia/esportes"], ["esporte", "academia/esportes"],
  ["luz", "luz"], ["energia", "luz"],
  ["agua", "agua"],
  ["gas de cozinha", "gas"], // antes do "gas" genérico? "gas" sozinho também cai aqui
  ["aluguel", "moradia (aluguel/financiamento)"], ["moradia", "moradia (aluguel/financiamento)"],
  ["condominio", "condominio"],
  ["iptu", "iptu"],
  ["plano de saude", "plano de saude"],
  ["remedio", "farmacia"], ["farmacia", "farmacia"],
  ["seguro de vida", "seguro de vida"],
  ["internet", "internet"], ["wifi", "internet"],
  ["celular", "celular/telefonia"], ["telefone", "celular/telefonia"],
  ["escola", "educacao (escola/cursos)"], ["faculdade", "educacao (escola/cursos)"], ["curso", "educacao (escola/cursos)"],
  ["animal", "animais"], ["pet", "animais"], ["veterinario", "animais"],
  ["cinema", "lazer"], ["passeio", "lazer"], ["balada", "lazer"], ["show", "lazer"],
  ["bar", "restaurantes/ifood"],
  ["salao", "salao/estetica"], ["manicure", "salao/estetica"],
  ["tarifa", "tarifas bancarias"],
  ["investimento", "investimentos"], ["investir", "investimentos"], ["aporte", "investimentos"],
  ["cartao", "cartao de credito"],
  ["emprestimo", "emprestimos"],
  ["imprevisto", "imprevistos"],
  ["salario", "salario liquido"],
  ["vale alimentacao", "vale-alimentacao"], ["vale refeicao", "vale-refeicao"],
  ["freela", "renda extra"], ["extra", "renda extra"], ["bico", "renda extra"],
];

const FALLBACK_EXPENSE = "Outras despesas";
const FALLBACK_INCOME = "Renda extra";

const HELP = [
  "🤖 *Uncontrollader* — como lançar:",
  "",
  "*Valor*: livre — 150 | 150,90 | 1.250,00 (o 1º número da mensagem é o valor)",
  "  − na frente também força despesa: -100 para esposa",
  "",
  "*Despesa:* palavra da categoria + valor",
  "• mercado/supermercado/hortifruti → Supermercado",
  "• ifood/restaurante/delivery/bar → Restaurantes",
  "• uber/99/onibus/passagem → Transporte",
  "• gasolina/combustivel/posto → Combustível",
  "• luz/energia · agua · gas de cozinha · iptu · condominio · aluguel",
  "• plano de saude · remedio/farmacia · seguro de vida",
  "• netflix/spotify/disney/hbo → Streaming",
  "• academia/esporte · cinema/passeio/balada/show → Lazer",
  "• escola/faculdade/curso · pet/animal · salao/manicure",
  "• internet/wifi · celular/telefone · cartao · emprestimo",
  "• imprevisto · tarifa",
  "• sem palavra conhecida → Outras despesas",
  "",
  "*Receita:* + no começo da mensagem",
  "• +6500 salario → Salário líquido",
  "• +300 freela/extra/bico → Renda extra",
  "• +200 sozinho → Renda extra",
  "",
  "*Outros comandos:*",
  "• paguei netflix → marca a conta fixa como paga",
  "• saldo (ou resumo) → resumo do mês",
  "• desfazer → apaga o último lançamento daqui",
  "• ajuda → esta lista",
  "",
  "Descrição livre entra junto: `mercado 150 compra da semana`.",
  "Em grupo: `!mercado 150`.",
].join("\n");

async function loadCategories(userId: number): Promise<CategoryLite[]> {
  const cats = await prisma.category.findMany({ where: { active: true, userId } });
  return cats.map((c) => ({ ...c, norm: normalize(c.name) }));
}

function findByKeyword(norm: string, categories: CategoryLite[]): CategoryLite | null {
  for (const [kw, target] of KEYWORDS) {
    if (new RegExp(`\\b${escapeRegex(kw)}\\b`).test(norm)) {
      const cat = categories.find((c) => c.norm === target);
      if (cat) return cat;
    }
  }
  // palavras extras do texto podem bater com o nome da categoria
  const words = norm.replace(/\d+/g, " ").split(" ").filter((w) => w.length > 3);
  for (const w of words) {
    const cat = categories.find((c) => c.norm.includes(w));
    if (cat) return cat;
  }
  return null;
}

function shortName(name: string): string {
  return name.split(" (")[0].split("/")[0];
}

function buildDescription(original: string, amountTokenIndex: number, category: CategoryLite): string {
  const words = original.trim().split(/\s+/);
  words.splice(amountTokenIndex, 1);
  const cleaned = words
    .filter((w) => w !== "+" && w !== "r$")
    .join(" ")
    .replace(/^r\$/i, "")
    .trim();
  if (!cleaned) return shortName(category.name);
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

async function createTransaction(
  rawText: string,
  norm: string,
  userId: number
): Promise<WhatsAppResult> {
  const categories = await loadCategories(userId);

  // valor: primeiro token que é um número válido
  const tokens = norm.split(" ");
  let amountCents: number | null = null;
  let amountIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    const c = parseBRLToCents(tokens[i].replace(/^[+-]/, ""));
    if (c !== null && c > 0) {
      amountCents = c;
      amountIndex = i;
      break;
    }
  }
  if (amountCents === null || amountIndex === -1) {
    return {
      action: "invalid",
      reply: "❌ Não entendi o valor. Ex.: `mercado 150,90` — mande *ajuda* para ver os comandos.",
    };
  }

  const wantsIncome = norm.startsWith("+");
  const matched = findByKeyword(norm, categories);
  let category: CategoryLite | undefined;
  if (matched && (matched.kind === "INCOME" || !wantsIncome)) {
    category = matched;
  } else if (wantsIncome) {
    category =
      categories.find((c) => c.norm === normalize(FALLBACK_INCOME)) ??
      categories.find((c) => c.kind === "INCOME");
    if (!category) return { action: "error", reply: "⚠️ Nenhuma categoria de receita encontrada." };
  } else {
    category =
      categories.find((c) => c.norm === normalize(FALLBACK_EXPENSE)) ??
      categories.find((c) => c.kind === "EXPENSE");
    if (!category) return { action: "error", reply: "⚠️ Nenhuma categoria de despesa encontrada." };
  }
  const kind = category.kind;

  // descrição usa o texto original (com acentos), sem o token do valor
  const originalTokens = rawText.trim().split(/\s+/);
  const description = buildDescription(rawText, amountIndex, category);

  const created = await prisma.transaction.create({
    data: {
      date: todayISO(),
      description,
      amountCents,
      kind,
      categoryId: category.id,
      source: "WHATSAPP",
      userId,
    },
  });

  const sign = kind === "INCOME" ? "+" : "−";
  const tier = category.tier ? ` · ${category.tier === "ESSENCIAL" ? "Essencial" : "Não essencial"}` : "";
  const catNote =
    !matched && !wantsIncome ? " (categoria genérica — ajuste no app se quiser)" : "";
  return {
    action: "created",
    reply: `✅ Lançado #${created.id}: *${shortName(category.name)}* ${sign} ${formatBRL(amountCents)}${tier} · hoje${catNote}`,
  };
}

async function payRecurrence(restNorm: string, userId: number): Promise<WhatsAppResult> {
  const wanted = restNorm.trim();
  const recs = await prisma.recurrence.findMany({
    where: { active: true, userId },
    include: { category: true },
    orderBy: { dueDay: "asc" },
  });
  const target =
    recs.find((r) => normalize(r.name).includes(wanted)) ??
    recs.find((r) => wanted.includes(normalize(r.name)));
  if (!target) {
    const names = recs.map((r) => r.name).join(", ");
    return {
      action: "recurrence_not_found",
      reply: `❌ Não achei essa conta. Ativas: ${names || "nenhuma"}.`,
    };
  }

  const ym = currentYearMonth();
  const { start, end } = monthRange(ym);
  const already = await prisma.transaction.findFirst({
    where: { recurrenceId: target.id, userId, date: { gte: start, lte: end } },
  });
  if (already) {
    return { action: "already_paid", reply: `ℹ️ *${target.name}* já estava paga este mês.` };
  }

  const lastDay = Number(end.slice(8, 10));
  const payDate = `${ym}-${String(Math.min(target.dueDay, lastDay)).padStart(2, "0")}`;
  await prisma.transaction.create({
    data: {
      date: payDate,
      description: `${target.name} (${ym})`,
      amountCents: target.amountCents,
      kind: "EXPENSE",
      categoryId: target.categoryId,
      source: "WHATSAPP",
      recurrenceId: target.id,
      userId,
    },
  });
  return {
    action: "paid",
    reply: `✅ *${target.name}* marcada como paga: ${formatBRL(target.amountCents)}.`,
  };
}

async function undoLast(userId: number): Promise<WhatsAppResult> {
  const last = await prisma.transaction.findFirst({
    where: { source: "WHATSAPP", userId },
    orderBy: { createdAt: "desc" },
  });
  if (!last) {
    return { action: "nothing_to_undo", reply: "ℹ️ Nenhum lançamento meu para desfazer." };
  }
  await prisma.transaction.delete({ where: { id: last.id } });
  const sign = last.kind === "INCOME" ? "+" : "−";
  return {
    action: "undone",
    reply: `🗑️ Desfeito #${last.id}: ${last.description} ${sign} ${formatBRL(last.amountCents)}.`,
  };
}

async function summary(userId: number): Promise<WhatsAppResult> {
  const ym = currentYearMonth();
  const d = await getDashboard(ym, userId);
  const pending = d.bills.filter((b) => !b.paid);
  const lines = [
    `📊 *${monthLabel(ym)}*`,
    `Entradas: ${formatBRL(d.totals.incomeCents)}`,
    `Essenciais: ${formatBRL(d.totals.essentialCents)}`,
    `Não essenciais: ${formatBRL(d.totals.nonEssentialCents)}`,
    `*Sobra: ${formatBRL(d.totals.balanceCents)}*`,
  ];
  if (pending.length > 0) {
    const total = pending.reduce((s, b) => s + b.amountCents, 0);
    lines.push(`⏳ Contas em aberto: ${pending.length} (${formatBRL(total)})`);
    for (const b of pending.filter((x) => x.overdue)) lines.push(`⚠️ *${b.name}* venceu dia ${b.dueDay}`);
  }
  return { action: "summary", reply: lines.join("\n") };
}

export async function handleWhatsAppMessage(rawText: string, userId: number): Promise<WhatsAppResult> {
  const text = String(rawText ?? "").trim().slice(0, 300);
  const norm = normalize(text);
  if (!norm) return { action: "ignored", reply: "" };
  if (/^(ajuda|help|\?)$/.test(norm)) return { action: "help", reply: HELP };
  if (/^(saldo|resumo)$/.test(norm)) return summary(userId);
  if (/^desfazer$/.test(norm)) return undoLast(userId);
  const paid = norm.match(/^(?:paguei|pago)\s+(.+)$/);
  if (paid) return payRecurrence(paid[1], userId);
  return createTransaction(text, norm, userId);
}
