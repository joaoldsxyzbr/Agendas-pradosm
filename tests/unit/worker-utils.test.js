import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PRESENCE_ONLINE_WINDOW_MS,
  PRESENCE_SIGNAL_WINDOW_MS,
  conferentePresenceStatus
} from "../../worker/lib/presence.js";

describe("Presença do conferente após conversão para JS", () => {
  it("mantém os intervalos da main", () => {
    assert.equal(PRESENCE_ONLINE_WINDOW_MS, 180000);
    assert.equal(PRESENCE_SIGNAL_WINDOW_MS, 420000);
  });
  it("distingue online, ausente e offline conforme o último sinal", () => {
    const now = Date.parse("2026-10-18T15:00:00.000Z");
    const ago = ms => new Date(now - ms).toISOString();
    assert.equal(conferentePresenceStatus(ago(1000), ago(1000), now), "online");
    assert.equal(conferentePresenceStatus(ago(181000), ago(1000), now), "away");
    assert.equal(conferentePresenceStatus(ago(1000), ago(421000), now), "offline");
  });
  it("sem sinal válido deve ficar offline", () => {
    assert.equal(conferentePresenceStatus(null, null, Date.now()), "offline");
  });
});