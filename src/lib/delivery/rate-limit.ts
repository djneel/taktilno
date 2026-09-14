/**
 * Простой per-instance лимитер запросов к API служб доставки.
 *
 * Защищает внешние API (СДЭК, Почта России) от перебора через наш сервер:
 * считаем обращения по IP в минутном окне. Лимит не строгий — при
 * перезапуске процесса счётчики сбрасываются.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 1000;

export function isRateLimited(
  scope: string,
  ip: string,
  limit = 60,
  windowMs = 60_000
): boolean {
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt < now) {
    if (buckets.size > MAX_BUCKETS) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
