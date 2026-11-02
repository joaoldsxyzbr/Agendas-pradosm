async function checkLoginRateLimit(limiter, login, actor) {
  if (!limiter) {
    console.warn("Login rate limiter unavailable; denying request.");
    return "unavailable";
  }
  const normalizedLogin = login.trim().toLowerCase();
  const normalizedActor = actor?.trim();
  try {
    if (normalizedActor) {
      const actorResult = await limiter.limit({
        key: `actor:${normalizedActor}`
      });
      if (!actorResult.success) return "limited";
    }
    const loginResult = await limiter.limit({
      key: `login:${normalizedLogin}`
    });
    return loginResult.success ? "allowed" : "limited";
  } catch {
    console.warn("Login rate limiter unavailable; denying request.");
    return "unavailable";
  }
}
export {
  checkLoginRateLimit
};