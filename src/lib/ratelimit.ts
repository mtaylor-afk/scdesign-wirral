import { getServiceSupabase } from "./supabase";

/**
 * Server-side rate limiting backed by a shared Supabase table
 * (visualiser_rate_limits). This is the production path and must NOT be
 * replaced by frontend-only checks.
 *
 * When Supabase is not configured (local/dev), we fall back to an in-memory
 * map purely so the flow is testable locally. This fallback is explicitly NOT
 * safe for production (serverless instances are stateless) and is logged.
 */

type LimitResult = { allowed: boolean; reason?: "per_ip" | "daily_cap"; retryAfterHint?: string };

const PER_IP_CAP = Number(process.env.VISUALISER_PER_IP_CAP || 5);
const DAILY_CAP = Number(process.env.VISUALISER_DAILY_CAP || 200);

const memory = new Map<string, { count: number }>();
let warnedMemory = false;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function checkVisualiserRateLimit(ip: string): Promise<LimitResult> {
  const supabase = getServiceSupabase();
  const day = today();

  if (!supabase) {
    if (!warnedMemory) {
      console.warn(
        "[ratelimit] Supabase not configured — using in-memory fallback (NOT production-safe)"
      );
      warnedMemory = true;
    }
    // Per-IP within the in-memory window.
    const key = `${ip}:${day}`;
    const rec = memory.get(key) || { count: 0 };
    if (rec.count >= PER_IP_CAP) return { allowed: false, reason: "per_ip" };
    rec.count += 1;
    memory.set(key, rec);
    return { allowed: true };
  }

  // Daily total across all IPs.
  const { count: dailyTotal } = await supabase
    .from("visualiser_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("day", day);
  if ((dailyTotal ?? 0) >= DAILY_CAP) {
    return { allowed: false, reason: "daily_cap" };
  }

  // Per-IP for the day.
  const { count: ipCount } = await supabase
    .from("visualiser_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("day", day)
    .eq("ip", ip);
  if ((ipCount ?? 0) >= PER_IP_CAP) {
    return { allowed: false, reason: "per_ip" };
  }

  // Record this attempt.
  const { error } = await supabase.from("visualiser_rate_limits").insert({ ip, day });
  if (error) console.error("[ratelimit] insert failed", error);
  return { allowed: true };
}

/** Verify a Cloudflare Turnstile token server-side. Skips when not configured. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured → don't block in dev
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}
