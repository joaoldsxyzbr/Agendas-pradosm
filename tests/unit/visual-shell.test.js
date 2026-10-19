import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adminShell, storeShell } from "../../frontend/shell.js";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Aparência da preview sem alterações de negócio", () => {
  it("preserva navegação por perfil, escapamento e controles operacionais", () => {
    const admin = adminShell({ nome: "<script>teste</script>", papel: "admin" }, "/admin");
    for (const item of ["prado-sidebar", "prado-topbar", "prado-side-nav", "prado-mobile-nav",
                        "admin-topbar-inner", "data-page-outlet", "data-logout"])
      assert.ok(admin.includes(item), item);
    for (const path of ["/admin", "/admin/stores", "/admin/users", "/admin/reports"])
      assert.match(admin, new RegExp('href="' + path + '"'));
    assert.match(admin, /&lt;script&gt;/);
    assert.doesNotMatch(admin, /<script>teste/);
    const viewer = adminShell({ nome: "Leitura", papel: "visualizador" }, "/admin");
    assert.doesNotMatch(viewer, /href="\/admin\/(stores|users)"/);
    assert.match(viewer, /href="\/admin\/reports"/);
    const store = storeShell({ nome: "Conferente", lojaNome: "Loja & A", papel: "conferente" });
    for (const item of ["store-operations-shell", "data-page-outlet", "data-agenda-command-slot", "data-logout"])
      assert.ok(store.includes(item), item);
    assert.match(store, /Loja &amp; A/);
  });
  it("usa somente CSS novo e mantém o build produtivo", () => {
    const css = read("../../frontend/styles/preview-visual.css");
    const html = read("../../index.html");
    const build = read("../../scripts/build-native.mjs");
    assert.match(css, /--color-background:\s*#14161b/);
    assert.match(css, /\.prado-sidebar/);
    assert.match(css, /@media\s*\(max-width:\s*760px\)/);
    assert.match(html, /\/src\/preview-visual\.css/);
    assert.match(build, /"preview-visual\.css"/);
    assert.doesNotMatch(css + html, /PREVIEW_DEMO_LOGIN|Conta de demonstração|D1 ISOLADO/);
  });
});