import { describe, expect, it, vi } from "vitest";
import { checkLoginRateLimit } from "../../worker/lib/login-rate-limit";

describe("login rate limit", () => {
  it("normaliza login e combina com o ator da requisição", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });

    const allowed = await checkLoginRateLimit(
      { limit },
      "  Joao.Prado  ",
      "203.0.113.10",
    );

    expect(allowed).toBe(true);
    expect(limit).toHaveBeenCalledWith({
      key: "joao.prado:203.0.113.10",
    });
  });

  it("bloqueia quando o binding nega a tentativa", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });

    await expect(
      checkLoginRateLimit({ limit }, "usuario", null),
    ).resolves.toBe(false);
  });

  it("falha aberto se o binding estiver indisponível", async () => {
    const limit = vi.fn().mockRejectedValue(new Error("rate limit indisponível"));

    await expect(
      checkLoginRateLimit({ limit }, "usuario", "203.0.113.20"),
    ).resolves.toBe(true);
  });
});
