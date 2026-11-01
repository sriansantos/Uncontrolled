// Meses no formato "YYYY-MM" (string, sem fuso), datas como "YYYY-MM-DD".

export function isValidYearMonth(m: string | null | undefined): m is string {
  return typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

export function isValidDate(d: string | null | undefined): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

// O servidor vive em UTC (Render/VM), mas o dinheiro é do Brasil:
// datas de lançamento seguem sempre o fuso de Brasília.
const TZ = "America/Sao_Paulo";

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // en-CA → "YYYY-MM-DD"
}

export function currentYearMonth(): string {
  return todayISO().slice(0, 7);
}

export function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, "0")}` };
}

export function monthInRange(date: string, ym: string): boolean {
  return date.startsWith(ym + "-") || date.startsWith(ym);
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const name = d.toLocaleDateString("pt-BR", { month: "long" });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

export function monthShortLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const name = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}/${y}`;
}
