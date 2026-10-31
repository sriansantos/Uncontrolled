// Rate limiter em memória (janela fixa deslizante) por chave — normalmente IP.
// Suficiente para instância única (local ou Render starter). Não usar em
// múltiplas réplicas — aí trocar por Redis/Upstash.

type Bucket = { count: number; resetAt: number; blockedUntil: number };

const globalForLimiter = globalThis as unknown as {
  rateLimitBuckets?: Map<string, Bucket>;
};
const buckets = (globalForLimiter.rateLimitBuckets ??= new Map<string, Bucket>());

export type RateLimitResult = { ok: boolean; retryAfterSec: number };

export function rateLimit(
  key: string,
  { max, windowMs, blockMs = 0 }: { max: number; windowMs: number; blockMs?: number }
): RateLimitResult {
  const now = Date.now();
  // limpeza de buckets velhos de vez em quando
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.resetAt < now && b.blockedUntil < now) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || (bucket.resetAt < now && bucket.blockedUntil < now)) {
    buckets.set(key, { count: 1, resetAt: now + windowMs, blockedUntil: 0 });
    return { ok: true, retryAfterSec: 0 };
  }

  if (bucket.blockedUntil > now) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.blockedUntil - now) / 1000) };
  }

  bucket.count += 1;
  if (bucket.count > max) {
    bucket.blockedUntil = now + blockMs;
    return { ok: false, retryAfterSec: Math.ceil(blockMs / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}
