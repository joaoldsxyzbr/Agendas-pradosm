import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PASSWORD_HASH_ITERATIONS, hashPassword, passwordNeedsUpgrade, verifyPassword } from "../../worker/lib/password.js";

// Hash sintético gerado em teste, nunca obtido do D1 ou de credenciais reais.
async function fixtureHash(password, iterations) {
  const salt = new Uint8Array(16).fill(19);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const hash = new Uint8Array(await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", salt, iterations
  }, key, 256));
  return `pbkdf2_sha256$${iterations}$${Buffer.from(salt).toString("base64")}$${Buffer.from(hash).toString("base64")}`;
}

describe("Segurança do hash de senha PBKDF2", () => {
  it("gera salt aleatório e verifica senha atual corretamente", async () => {
    const first = await hashPassword("SenhaDeTesteSegura2026");
    const second = await hashPassword("SenhaDeTesteSegura2026");
    assert.equal(PASSWORD_HASH_ITERATIONS, 100_000);
    assert.notEqual(first, second);
    assert.equal(await verifyPassword("SenhaDeTesteSegura2026", first), true);
    assert.equal(await verifyPassword("senha incorreta", first), false);
    assert.equal(passwordNeedsUpgrade(first), false);
  });

  it("mantém compatibilidade com hash legado e com 600 mil iterações", async () => {
    for (const iterations of [100_000, 600_000]) {
      const encoded = await fixtureHash("SenhaDeTesteSegura2026", iterations);
      assert.equal(await verifyPassword("SenhaDeTesteSegura2026", encoded), true);
      assert.equal(await verifyPassword("OutraSenha", encoded), false);
      assert.equal(passwordNeedsUpgrade(encoded), false);
    }
  });

  it("rejeita sem exceção hashes corrompidos ou inesperados", async () => {
    const invalid = [null, undefined, 0, {}, "", "abc",
      "pbkdf2_sha256$999999999999$AA==$AA==",
      "pbkdf2_sha256$999$AA==$AA==",
      "pbkdf2_sha1$100000$AA==$AA==",
      "pbkdf2_sha256$100000$invalido$hash",
      "x".repeat(300)];
    for (const value of invalid) {
      assert.equal(await verifyPassword("SenhaDeTesteSegura2026", value), false);
      assert.equal(passwordNeedsUpgrade(value), false);
    }
  });
});
