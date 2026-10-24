import { NextResponse } from "next/server";
import { z } from "zod";
import { zodErrorMessage } from "./validate";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

// Erros Prisma chegam como objetos com `code` (P2002 unique, P2003 FK,
// P2025 não encontrado) — mapeamos pelos códigos, sem depender de classe.
export function handleRouteError(e: unknown) {
  if (e instanceof z.ZodError) {
    return NextResponse.json({ error: zodErrorMessage(e) }, { status: 400 });
  }
  const err = e as { code?: string; message?: string; meta?: unknown };
  switch (err?.code) {
    case "P2002":
      return NextResponse.json({ error: "Já existe um registro com esse nome." }, { status: 409 });
    case "P2025":
      return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
    default:
      console.error("[api]", e);
      return NextResponse.json(
        { error: err?.message || "Erro interno inesperado." },
        { status: 500 }
      );
  }
}

export function notFound(msg = "Registro não encontrado.") {
  return NextResponse.json({ error: msg }, { status: 404 });
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export function conflict(msg: string) {
  return NextResponse.json({ error: msg }, { status: 409 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
