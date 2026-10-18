import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Tela de login JS fiel à main", () => {
  const html = read("../../migration/frontend/login.js");
  const shell = read("../../migration/frontend/runtime.js");
  it("preserva mensagens, classes e todos os endpoints necessários", () => {
    for (const token of [
      "login-card", "Preparar primeiro administrador", "Login ou senha inválidos.",
      "As senhas não coincidem.", "/api/auth/bootstrap-status",
      "/api/auth/bootstrap-register", "Entrando...", "Cadastro preparado."
    ]) assert.ok(html.includes(token), token);
    for (const unexpected of ["demo-login", "demo-status", "PREVIEW_DEMO_LOGIN"]) {
      assert.equal(html.includes(unexpected), false);
    }
  });
  it("não ativa a migração antes de converter as telas e permite saída segura", () => {
    assert.ok(shell.includes("Página da main ainda não migrada"));
    assert.ok(shell.includes("await auth.logout()"));
    assert.ok(shell.includes("await beforeLogout()"));
    assert.ok(shell.includes('win.addEventListener("popstate"'));
    assert.ok(shell.includes("win.history.pushState"));
  });
});
