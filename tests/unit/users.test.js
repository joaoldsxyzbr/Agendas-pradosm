import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterUsers, ROLE_LABELS } from "../../frontend/users.js";
import { buildUserPayload } from "../../frontend/user-dialog.js";
import { compactAuditValue } from "../../frontend/audit-trail.js";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const stores = [
  { id: "loja-a", codigo: "F03", nome: "Loja São José", ativo: true },
  { id: "loja-b", codigo: "F08", nome: "Depósito", ativo: false }
];
const users = [
  { id: "a", nome: "Conferente A", login: "conf", papel: "conferente", lojaId: "loja-a", ativo: true },
  { id: "b", nome: "Administrador", login: "adm", papel: "admin", lojaId: null, ativo: false },
  { id: "c", nome: "Leitor", login: "view", papel: "visualizador", lojaId: null, ativo: true }
];
const form = fields => ({ elements: { namedItem: key => ({ value: fields[key] ?? "" }) } });

describe("Usuários: regras, campos e colunas equivalentes à main", () => {
  it("mantém os três papéis e os filtros de status/papel/loja", () => {
    assert.equal(ROLE_LABELS.admin, "Administrador");
    assert.equal(ROLE_LABELS.conferente, "Conferente");
    assert.equal(ROLE_LABELS.visualizador, "Visualizador");
    assert.deepEqual(filterUsers(users, stores, "são josé", "conferente", "ativos").map(x => x.id), ["a"]);
    assert.deepEqual(filterUsers(users, stores, "", "todos", "inativos").map(x => x.id), ["b"]);
    assert.deepEqual(filterUsers(users, stores, "", "visualizador", "todos").map(x => x.id), ["c"]);
  });
  it("mantém ordem Nome, Login, Loja, Papel, Situação e Ações", () => {
    const script = read("../../frontend/users.js");
    assert.match(script, /<th>Nome<\/th><th>Login<\/th><th>Loja<\/th><th>Papel<\/th><th>Situação<\/th>/);
    for (const token of ["registry-table", "registry-toolbar-users", "Novo usuário",
      "Nenhum usuário encontrado.", "Filtrar por situação"]) assert.ok(script.includes(token), token);
  });
  it("cadastro exige senha e loja quando o papel é conferente", () => {
    const payload = buildUserPayload(form({
      nome: "  Conferente  ", login: " conf ", senha: "senhaComDoze", papel: "conferente", lojaId: "loja-a"
    }));
    assert.deepEqual(payload, {
      nome: "Conferente", login: "conf", papel: "conferente", lojaId: "loja-a", senha: "senhaComDoze"
    });
    const dialog = read("../../frontend/user-dialog.js");
    assert.match(dialog, /minlength="12"/);
    assert.match(dialog, /autocomplete="new-password"/);
  });
  it("edição permite manter senha e não envia loja em papel administrativo", () => {
    const payload = buildUserPayload(form({
      nome: " Novo ", login: "adm", papel: "admin", senha: "", lojaId: ""
    }), users[0]);
    assert.deepEqual(payload, { id: "a", nome: "Novo", login: "adm", papel: "admin" });
  });
  it("ativação e desativação preservam dados, sem deletar usuário", () => {
    const dialog = read("../../frontend/user-dialog.js");
    for (const text of ["Confirmar desativação", "Confirmar ativação",
      "Bloqueia o acesso sem apagar agendas ou histórico.", "ativo: !user.ativo", "/api/admin/users"]) {
      assert.ok(dialog.includes(text), text);
    }
    assert.doesNotMatch(dialog, /method: "DELETE"|demo-login/);
  });
  it("auditoria preserva os detalhes sem expor senhas", () => {
    assert.equal(compactAuditValue({ senhaAlterada: true }), "senha alterada");
    assert.equal(compactAuditValue({ nome: "Maria", ativo: false }), "nome: Maria · status: não");
  });
});