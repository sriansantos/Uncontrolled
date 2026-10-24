// Todo valor do sistema vive em centavos (inteiro). Conversões para exibição
// acontecem apenas na borda, sempre em pt-BR/BRL.

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

export function centsToNumber(cents: number): number {
  return cents / 100;
}

// Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56", "50" → 5000.
// Retorna null quando não dá para interpretar com segurança.
export function parseBRLToCents(input: string): number | null {
  if (typeof input !== "string") return null;
  let s = input.replace(/r\$/gi, "").trim();
  if (!s) return null;
  s = s.replace(/\s/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // o último separador é o decimal; o outro é milhar
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const value = Number(s);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
