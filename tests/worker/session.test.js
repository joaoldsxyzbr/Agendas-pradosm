import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  SESSION_MAX_AGE,
  shouldRenewSession,
  verifySessionToken
} from "../../worker/lib/session";
const secret = "session-test-secret";
const dayMs = 24 * 60 * 60 * 1e3;
const hourMs = 60 * 60 * 1e3;
const nowMs = Date.UTC(2026, 9, 5, 12, 0, 0);
describe("session", () => {
  it("mant\xE9m a sess\xE3o v\xE1lida por 30 dias em vez de 8 horas", async () => {
    const token = await createSessionToken("user-1", 1, secret, nowMs);
    expect(SESSION_MAX_AGE).toBe(30 * 24 * 60 * 60);
    expect(await verifySessionToken(token, secret, nowMs + 8 * hourMs + 1)).not.toBeNull();
    expect(await verifySessionToken(token, secret, nowMs + 29 * dayMs)).not.toBeNull();
    expect(await verifySessionToken(token, secret, nowMs + 30 * dayMs)).toBeNull();
  });
  it("renova no m\xE1ximo uma vez por dia durante o uso", async () => {
    const token = await createSessionToken("user-2", 1, secret, nowMs);
    const payload = await verifySessionToken(token, secret, nowMs);
    expect(payload).not.toBeNull();
    expect(shouldRenewSession(payload, nowMs + 23 * hourMs)).toBe(false);
    expect(shouldRenewSession(payload, nowMs + 24 * hourMs)).toBe(true);
  });
  it("renova tokens antigos ainda v\xE1lidos na primeira atividade", () => {
    const nowSeconds = Math.floor(nowMs / 1e3);
    expect(
      shouldRenewSession(
        {
          userId: "legacy-user",
          sessionVersion: 1,
          exp: nowSeconds + 8 * 60 * 60
        },
        nowMs
      )
    ).toBe(true);
  });
});
