import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

let burstLimiter: Ratelimit | null = null;
let dailyLimiter: Ratelimit | null = null;

if (url && token) {
  const redis = new Redis({ url, token });
  burstLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "whitepaper-ai:burst",
    analytics: false
  });
  dailyLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, "1 d"),
    prefix: "whitepaper-ai:day",
    analytics: false
  });
}

export const isRateLimitConfigured = burstLimiter !== null && dailyLimiter !== null;

export interface RateLimitOutcome {
  ok: boolean;
  retryAfterSec?: number;
  scope?: "burst" | "daily";
}

/**
 * Check both the per-minute burst limit and the per-day cap for an IP.
 * Fails open (returns ok=true) when Upstash env vars are unset so local
 * dev works without external infra.
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitOutcome> {
  if (!burstLimiter || !dailyLimiter) return { ok: true };

  const [burst, daily] = await Promise.all([
    burstLimiter.limit(identifier),
    dailyLimiter.limit(identifier)
  ]);

  if (!burst.success) {
    return {
      ok: false,
      scope: "burst",
      retryAfterSec: Math.max(1, Math.ceil((burst.reset - Date.now()) / 1000))
    };
  }
  if (!daily.success) {
    return {
      ok: false,
      scope: "daily",
      retryAfterSec: Math.max(1, Math.ceil((daily.reset - Date.now()) / 1000))
    };
  }
  return { ok: true };
}

/**
 * Best-effort client IP. Vercel sets x-forwarded-for; fallback to x-real-ip
 * then a literal anonymous bucket so a totally headerless caller still gets
 * rate-limited (just collectively rather than per-IP).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "anonymous";
}
