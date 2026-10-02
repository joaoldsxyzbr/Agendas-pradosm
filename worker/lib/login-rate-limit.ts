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
  const normalizedActor = actor?.trim();

  try {
    if (normalizedActor) {
      const actorResult = await limiter.limit({
        key: `actor:${normalizedActor}`,
      });
      if (!actorResult.success) return "limited";
    }

    const loginResult = await limiter.limit({
      key: `login:${normalizedLogin}`,
    });
    return loginResult.success ? "allowed" : "limited";
  } catch {
    console.warn("Login rate limiter unavailable; denying request.");
    return "unavailable";
  }
}
