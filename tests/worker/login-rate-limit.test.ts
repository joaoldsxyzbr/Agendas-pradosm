import { describe, expect, it, vi } from "vitest";
import { checkLoginRateLimit } from "../../worker/lib/login-rate-limit";

describe("login rate limit", () => {
  it("aplica limites independentes por origem e por login", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });

    const decision = await checkLoginRateLimit(
      { limit },
      "  Joao.Prado  ",
      "203.0.113.10",
    );

    expect(decision).toBe("allowed");
    expect(limit).toHaveBeenNthCalledWith(1, {
      key: "actor:203.0.113.10",
    });
    expect(limit).toHaveBeenNthCalledWith(2, {
      key: "login:joao.prado",
    });
  });

  it("bloqueia quando origem ou login atingem o limite", async () => {
    const actorLimited = vi.fn().mockResolvedValue({ success: false });
    await expect(
      checkLoginRateLimit(
        { limit: actorLimited },
        "usuario",
        "203.0.113.20",
      ),
    ).resolves.toBe("limited");
    expect(actorLimited).toHaveBeenCalledTimes(1);

    const loginLimited = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false });
    await expect(
      checkLoginRateLimit({ limit: loginLimited }, "usuario", "203.0.113.20"),
    ).resolves.toBe("limited");
  });

  it("sem IP aplica somente o limite por login", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });

    await expect(
      checkLoginRateLimit({ limit }, "usuario", null),
    ).resolves.toBe("allowed");

    expect(limit).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith({ key: "login:usuario" });
  });

  it("falha fechado se o binding lançar erro", async () => {
    const limit = vi.fn().mockRejectedValue(new Error("rate limit indisponível"));

    await expect(
      checkLoginRateLimit({ limit }, "usuario", "203.0.113.20"),
    ).resolves.toBe("unavailable");
  });

  it("falha fechado se o binding não estiver disponível", async () => {
    await expect(
      checkLoginRateLimit(undefined, "usuario", "203.0.113.20"),
    ).resolves.toBe("unavailable");
  });
});
