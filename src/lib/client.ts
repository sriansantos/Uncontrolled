"use client";

// Wrapper mínimo de fetch para as telas — erros da API viram toast.
import { toast } from "sonner";

export async function api<T>(
  url: string,
  init?: RequestInit & { json?: unknown }
): Promise<T | null> {
  const { json, ...rest } = init ?? {};
  try {
    const res = await fetch(url, {
      ...rest,
      headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (data as { error?: string })?.error ?? `Erro ${res.status}`;
      toast.error(msg);
      return null;
    }
    return data as T;
  } catch {
    toast.error("Falha de conexão com o servidor.");
    return null;
  }
}
