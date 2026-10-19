import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterStores, activeStoreCount } from "../../frontend/stores.js";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Telas de Lojas portadas fielmente da main", () => {
  const stores = [
    { id: "1", codigo: "F03", nome: "Loja Central", ativo: true },
    { id: "2", codigo: "CD DOCA 01", nome: "Depósito", ativo: false },
    { id: "3", codigo: "F08", nome: "Ação Industrial", ativo: true }
  ];
  it("preserva os filtros, a pesquisa e a contagem", () => {
    assert.deepEqual(filterStores(stores, "", "ativas").map(s => s.codigo), ["F03", "F08"]);
    assert.deepEqual(filterStores(stores, "", "inativas").map(s => s.codigo), ["CD DOCA 01"]);
    assert.deepEqual(filterStores(stores, "AÇÃO").map(s => s.codigo), ["F08"]);
    assert.deepEqual(filterStores(stores, "f03").map(s => s.codigo), ["F03"]);
    assert.equal(activeStoreCount(stores), 2);
  });
  it("mantém classes e colunas operacionais da main", () => {
    const page = read("../../frontend/stores.js");
    for (const name of [
      "registry-page", "registry-card", "registry-table",
      "Código", "Nome", "Situação", "Editar", "Nenhuma loja encontrada."
    ]) assert.ok(page.includes(name), name);
  });
  it("mantém endpoints, auditoria e confirmação de exclusão", () => {
    const dialog = read("../../frontend/store-dialog.js");
    for (const name of [
      'request("/api/admin/stores"', 'method: store ? "PATCH" : "POST"',
      'method: "DELETE"', '/api/admin/stores/', '/api/admin/audit?',
      'role="dialog"', 'aria-modal="true"'
    ]) assert.ok(dialog.includes(name), name);
    assert.doesNotMatch(dialog, /demo-login|PREVIEW_DEMO_LOGIN/);
  });
});