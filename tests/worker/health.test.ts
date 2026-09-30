import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("health", () => {
  it("retorna ok somente quando o D1 responde", async () => {
    const response = await exports.default.fetch("https://example.com/api/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, database: "ok" });
  });
});
