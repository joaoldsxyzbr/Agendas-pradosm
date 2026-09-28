import { describe, expect, it, vi } from "vitest";
import { checkLoginRateLimit } from "../../worker/lib/login-rate-limit";

describe("login rate limit", () => {
  it("normaliza login e combina com o ator da requisição", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });

    const decision = await checkLoginRateLimit(
      { limit },
      "  Joao.Prado  ",
      "203.0.113.10",
    );

    expect(decision).toBe("allowed");
    expect(limit).toHaveBeenCalledWith({
      key: "joao.prado:203.0.113.10",
    });
  });

  it("bloqueia quando o binding nega a tentativa", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });

    await expect(
      checkLoginRateLimit({ limit }, "usuario", null),
    ).resolves.toBe("limited");
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
