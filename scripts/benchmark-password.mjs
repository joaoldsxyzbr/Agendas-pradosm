import { performance } from "node:perf_hooks";
import { verifyPassword } from "../worker/lib/password.js";

// Benchmark local e opcional; números NÃO equivalem à latência/custo de CPU nos Workers.
const password = "SenhaSinteticaApenasBenchmark2026";
const salt = new Uint8Array(16).fill(41);
const key = await crypto.subtle.importKey(
  "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
);
for (const iterations of [100_000, 600_000]) {
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256
  );
  const encoded = `pbkdf2_sha256$${iterations}$${Buffer.from(salt).toString("base64")}$${Buffer.from(bits).toString("base64")}`;
  const measured = [];
  for (let run = 0; run < 3; run++) {
    const started = performance.now();
    if (!await verifyPassword(password, encoded)) throw Error("Falha no fixture do benchmark");
    measured.push(performance.now() - started);
  }
  const averageMs = measured.reduce((a, b) => a + b, 0) / measured.length;
  console.log(`PBKDF2-SHA256 ${iterations} iterações: média local de ${averageMs.toFixed(1)} ms (3 execuções)`);
}
console.log("Atenção: validar limites de CPU e desempenho reais do Cloudflare Worker antes de alterar CURRENT_ITERATIONS.");
