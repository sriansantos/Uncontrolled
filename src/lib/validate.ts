import { z } from "zod";
import { KINDS, SOURCES, TIERS } from "./types";
import { isValidDate, isValidYearMonth } from "./month";

export const yearMonthSchema = z.string().refine(isValidYearMonth, "Mês inválido (esperado YYYY-MM)");

export const dateSchema = z.string().refine(isValidDate, "Data inválida (esperado YYYY-MM-DD)");

export const amountCentsSchema = z
  .number({ message: "Valor em centavos é obrigatório" })
  .int("Valor em centavos deve ser inteiro")
  .positive("Valor deve ser maior que zero")
  .max(9_999_999_999, "Valor exageradamente grande");

export const kindSchema = z.enum(KINDS as [string, ...string[]]);
export const tierSchema = z.enum(TIERS as [string, ...string[]]);
export const sourceSchema = z.enum(SOURCES as [string, ...string[]]);

export const transactionCreateSchema = z.object({
  date: dateSchema,
  description: z.string().trim().min(1, "Descrição obrigatória").max(200),
  amountCents: amountCentsSchema,
  kind: kindSchema,
  categoryId: z.number().int().positive(),
  source: sourceSchema.optional(),
  recurrenceId: z.number().int().positive().nullish(),
  notes: z.string().trim().max(500).nullish(),
});

export const transactionUpdateSchema = z.object({
  date: dateSchema.optional(),
  description: z.string().trim().min(1).max(200).optional(),
  amountCents: amountCentsSchema.optional(),
  kind: kindSchema.optional(),
  categoryId: z.number().int().positive().optional(),
  notes: z.string().trim().max(500).nullish(),
});

export const categoryCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Nome obrigatório").max(80),
    kind: kindSchema,
    tier: tierSchema.nullable().optional(),
  })
  .refine((c) => c.kind !== "EXPENSE" || !!c.tier, {
    message: "Despesa precisa de tier (ESSENCIAL ou NAO_ESSENCIAL)",
    path: ["tier"],
  });

export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  tier: tierSchema.nullable().optional(),
  active: z.boolean().optional(),
});

export const budgetPutSchema = z.object({
  month: yearMonthSchema,
  items: z
    .array(
      z.object({
        categoryId: z.number().int().positive(),
        plannedCents: z.number().int().min(0),
      })
    )
    .max(200),
});

export const budgetCopySchema = z.object({
  from: yearMonthSchema,
  to: yearMonthSchema,
});

export const recurrenceCreateSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  amountCents: amountCentsSchema,
  dueDay: z.number().int().min(1).max(31),
  categoryId: z.number().int().positive(),
});

export const recurrenceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  amountCents: amountCentsSchema.optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  categoryId: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

export const recurrencePaySchema = z.object({
  month: yearMonthSchema,
  date: dateSchema.optional(),
});

export function zodErrorMessage(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join("; ");
}
