import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveRoute, APP_PATHS, homeForRole } from "../../frontend/routes.js";
import { escapeHtml, adminShell, storeShell } from "../../frontend/shell.js";
import { createAuthController } from "../../frontend/session.js";
import { ApiError, apiFetch } from "../../frontend/api.js";
import { applyTheme, readStoredTheme, createThemeController } from "../../frontend/theme.js";
import { agendaPdfFileName, buildAgendaPdf } from "../../frontend/agenda/exportAgendaPdf.js";

describe("Rotas nativas com paridade da main", () => {
  it("mantém os caminhos da aplicação React", () => {
    assert.deepEqual(APP_PATHS, ["/login", "/admin", "/admin/history", "/admin/import", "/admin/stores", "/admin/users", "/admin/reports", "/admin/diagnostics", "/app"]);
    assert.equal(homeForRole("conferente"), "/app");
    assert.equal(homeForRole("admin"), "/admin");
  });
  it("não permite que visualizador entre em cadastros ou históricos", () => {
    for (const path of ["/admin/users", "/admin/stores", "/admin/import", "/admin/history", "/admin/diagnostics", "/admin/cross"]) {
      assert.deepEqual(resolveRoute(path, { papel: "visualizador" }), { redirect: "/admin" });
    }
    assert.equal(resolveRoute("/admin", { papel: "visualizador" }).readOnly, true);
    assert.deepEqual(resolveRoute("/admin/reports",{papel:"visualizador"}),{view:"reports",layout:"admin",readOnly:true});
    assert.equal(resolveRoute("/admin/reports",{papel:"admin"}).view,"reports");
    assert.deepEqual(resolveRoute("/admin/cross",{papel:"admin"}),{redirect:"/admin"});
    assert.deepEqual(resolveRoute("/admin/cross",{papel:"conferente"}),{redirect:"/app"});
    assert.doesNotMatch(adminShell({papel:"admin",nome:"Administrador"},"/admin"), /href="\/admin\/cross"/);
    assert.equal(resolveRoute("/admin/diagnostics",{papel:"admin"}).view,"diagnostics");
    assert.deepEqual(resolveRoute("/admin/reports",{papel:"conferente"}),{redirect:"/app"});
    assert.deepEqual(resolveRoute("/app", { papel: "admin" }), { redirect: "/admin" });
    assert.deepEqual(resolveRoute("/admin", { papel: "conferente" }), { redirect: "/app" });
  });
  it("redireciona usuário sem sessão para login", () => {
    assert.deepEqual(resolveRoute("/admin", null), { redirect: "/login" });
    assert.deepEqual(resolveRoute("/app", null), { redirect: "/login" });
    assert.deepEqual(resolveRoute("/app/history", { papel: "conferente" }), { redirect: "/app" });
  });
});
describe("HTML fiel à main e proteção de nomes", () => {
  const user = { nome: "<svg onload=alert(1)>", lojaNome: "Loja & Filial", lojaCodigo: "01" };
  it("mantém as classes e escapa qualquer nome exibido", () => {
    const text = adminShell({ ...user, papel: "admin" }, "/admin");
    assert.match(text, /admin-topbar-inner/);
    assert.match(text, /admin-topnav/);
    assert.doesNotMatch(text, /<svg onload/);
    assert.match(text, /&lt;svg/);
    const store = storeShell({ ...user, papel: "conferente" });
    assert.match(store, /store-operations-shell/);
    assert.match(store, /store-topbar-agenda-slot/);
    assert.match(store, /Loja &amp; Filial/);
    assert.doesNotMatch(store, /<svg onload/);
    assert.equal(escapeHtml("<>&\"'"), "&lt;&gt;&amp;&quot;&#39;");
  });
  it("oculta cadastro de lojas e usuários no menu do visualizador", () => {
    const text = adminShell({ ...user, papel: "visualizador" }, "/admin");
    assert.match(text, /href="\/admin"/);
    assert.doesNotMatch(text, /href="\/admin\/stores"/);
    assert.doesNotMatch(text, /href="\/admin\/users"/);
  });
});
describe("Autenticação compatível com sessão da main", () => {
  it("restaura, autentica e encerra sessão pelos mesmos endpoints", async () => {
    const calls = [];
    const controller = createAuthController({
      request: async (path, init) => {
        calls.push([path, init?.method || "GET"]);
        return path === "/api/auth/me" ? { papel: "admin" } : path === "/api/auth/login" ? { papel: "conferente" } : undefined;
      }
    });
    await controller.refresh();
    assert.equal(controller.user.papel, "admin");
    await controller.login("teste", "senha");
    assert.equal(controller.user.papel, "conferente");
    await controller.logout();
    assert.equal(controller.user, null);
    assert.deepEqual(calls, [
      ["/api/auth/me", "GET"], ["/api/auth/login", "POST"], ["/api/auth/logout", "POST"]
    ]);
  });
  it("limpa a sessão mesmo quando a chamada de logout falha", async () => {
    const controller = createAuthController({
      request: async path => {
        if (path === "/api/auth/logout") throw Error("Rede indisponível");
        return { id: "1", papel: "admin" };
      }
    });
    await controller.refresh();
    await assert.rejects(controller.logout(), /Rede indisponível/);
    assert.equal(controller.user, null);
  });
  it("preserva os dados de erro do backend", async () => {
    const error = await ApiError.fromResponse({
      status: 403,
      json: async () => ({ error: "ACESSO_NEGADO", message: "Acesso não permitido." })
    });
    assert.equal(error.status, 403);
    assert.equal(error.code, "ACESSO_NEGADO");
    assert.equal(error.message, "Acesso não permitido.");
  });
});
describe("Tema e PDF da main", () => {
  it("mantém tema escuro por padrão e alternância sem React", () => {
    const doc = { documentElement: { dataset: {}, style: {} } };
    const values = [];
    const controller = createThemeController({ doc, storage: { setItem: (...args) => values.push(args) } });
    assert.equal(readStoredTheme(), "dark");
    assert.equal(controller.apply(), "dark");
    assert.equal(controller.toggle(), "light");
    assert.equal(doc.documentElement.dataset.theme, "light");
    assert.deepEqual(values.at(-1), ["agenda-prado-theme", "light"]);
  });
  it("gera PDF binário e o mesmo nome de arquivo", () => {
    const agenda = {
      id: "agenda-1", storeCode: "F08", storeName: "PORTO BELO",
      date: "2026-09-25", dayStatus: "aberto",
      completedAt: null, completedBy: null
    };
    const appointment = {
      id: "appt1", protocol: "12458375",
      startTime: "07:30", endTime: "07:40", supplier: "PAMPLONA",
      items: 1, volumes: 1, pallets: 0, cargaBatida: null, type: "CNPJ",
      nfe: [], orders: [], status: "recebido", hasExchanges: false, ativo: true
    };
    const bytes = buildAgendaPdf(agenda, [appointment]);
    assert.ok(bytes instanceof Uint8Array);
    assert.equal(String.fromCharCode(...bytes.slice(0, 8)), "%PDF-1.4");
    assert.equal(agendaPdfFileName(agenda), "agenda-F08-25-09-2026.pdf");
  });
});