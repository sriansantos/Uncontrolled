// SQLite não suporta enums do Prisma; os valores abaixo são strings
// validadas nas bordas da API (zod) e tipadas aqui.

export type Kind = "INCOME" | "EXPENSE";
export type Tier = "ESSENCIAL" | "NAO_ESSENCIAL";
export type Source = "MANUAL" | "WHATSAPP" | "IMPORT";

export const KINDS: Kind[] = ["INCOME", "EXPENSE"];
export const TIERS: Tier[] = ["ESSENCIAL", "NAO_ESSENCIAL"];
export const SOURCES: Source[] = ["MANUAL", "WHATSAPP", "IMPORT"];

export const KIND_LABEL: Record<Kind, string> = {
  INCOME: "Entrada",
  EXPENSE: "Saída",
};

export const TIER_LABEL: Record<Tier, string> = {
  ESSENCIAL: "Essencial",
  NAO_ESSENCIAL: "Não essencial",
};

export const SOURCE_LABEL: Record<Source, string> = {
  MANUAL: "Manual",
  WHATSAPP: "WhatsApp",
  IMPORT: "Importação",
};
