import type { LoginRateLimiter } from "../env";

export async function checkLoginRateLimit(
  limiter: LoginRateLimiter | undefined,
  login: string,
  actor: string | null | undefined,
): Promise<boolean> {
  if (!limiter) return true;

  const normalizedLogin = login.trim().toLowerCase();
  const normalizedActor = actor?.trim() || "unknown";

  try {
    const result = await limiter.limit({
      key: `${normalizedLogin}:${normalizedActor}`,
    });
    return result.success;
  } catch {
    console.warn("Login rate limiter unavailable; allowing request.");
    return true;
  }
}
