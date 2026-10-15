import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
describe("security headers", () => {
  it("protege respostas sens\xEDveis da API", async () => {
    const response = await exports.default.fetch(
      new Request("https://example.com/api/auth/bootstrap-status")
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Permissions-Policy")).toContain("camera=()");
    expect(response.headers.get("Strict-Transport-Security")).toContain(
      "max-age=31536000"
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
