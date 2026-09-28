import type { LoginRateLimiter } from "../env";

export type LoginRateLimitDecision =
  | "allowed"
  | "limited"
  | "unavailable";

export async function checkLoginRateLimit(
  limiter: LoginRateLimiter | undefined,
  login: string,
  actor: string | null | undefined,
): Promise<LoginRateLimitDecision> {
  if (!limiter) {
    console.warn("Login rate limiter unavailable; denying request.");
    return "unavailable";
  }

  const normalizedLogin = login.trim().toLowerCase();
  const normalizedActor = actor?.trim() || "unknown";

  try {
    const result = await limiter.limit({
      key: `${normalizedLogin}:${normalizedActor}`,
    });
    return result.success ? "allowed" : "limited";
  } catch {
    console.warn("Login rate limiter unavailable; denying request.");
    return "unavailable";
  }
}
