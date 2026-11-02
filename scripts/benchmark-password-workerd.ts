import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

// Acesso apenas a servidor Workerd efemero rodando localmente no runner CI.
// Nao conecta a API Cloudflare, nem utiliza dados ou credenciais de usuarios.
const BASE = "http://127.0.0.1:8799";
const PASSWORD = "SenhaSinteticaParaBenchmarkSemUsoReal2026";
const salt = new Uint8Array(16).fill(57);
const key = await crypto.subtle.importKey(
  "raw", new TextEncoder().encode(PASSWORD), "PBKDF2", false, ["deriveBits"]
);
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function verifyOnce(password, encoded, expected) {
  const started = performance.now();
  const response = await fetch(BASE + "/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, encoded }),
    signal: AbortSignal.timeout(20000)
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.valid, expected);
  return performance.now() - started;
}

// Parâmetro operacional máximo definido pelo projeto: 100.000 iterações.
for (const iterations of [100_000]) {
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256
  );
  const encoded = ["pbkdf2_sha256", iterations,
    Buffer.from(salt).toString("base64"), Buffer.from(bits).toString("base64")].join("$");
  await verifyOnce(PASSWORD, encoded, true); // warm-up
  const timings = [];
  for (let i = 0; i < 5; i++) {
    timings.push(await verifyOnce(PASSWORD, encoded, true));
  }
  await verifyOnce("OutraSenhaSintetica", encoded, false);
  console.log("workerd local PBKDF2-SHA256 " + iterations +
    " iteracoes: mediana ida-e-volta HTTP " + median(timings).toFixed(1) +
    " ms; min " + Math.min(...timings).toFixed(1) +
    " ms; max " + Math.max(...timings).toFixed(1) + " ms (5 amostras)");
}
console.log("Somente diagnostico local de 100.000 iteracoes; workerd nao mede CPU real da Cloudflare.");