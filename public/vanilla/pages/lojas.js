// Tela stores — JavaScript puro.
export async function showStores(ctx) {
  const { state, root, $, $$, loadStores, heading, panel, table, fmt, esc, badge, isCurrent } = ctx;

    await loadStores();
    if (!isCurrent()) return;
    root.innerHTML = heading("Cadastros", "Lojas", "Administração das unidades e vínculos de conferentes.",
      `<button class="primary" id="new-store">Nova loja</button>`) +
      panel("Lojas cadastradas", `${state.stores.length} registros`, table(["Código", "Nome", "Situação", "Ação"],
        state.stores.map(s => `<tr><td class="cell-primary">${esc(s.codigo)}</td><td>${esc(s.nome)}</td><td>${badge(s.ativo ? "ativo" : "inativo")}</td>
          <td><button class="mini-button" data-edit-store="${esc(s.id)}">Editar</button></td></tr>`)));
    $("#new-store").onclick = () => storeDialog(ctx);
    $$("[data-edit-store]").forEach(b => b.onclick = () => storeDialog(ctx, state.stores.find(x => x.id === b.dataset.editStore)));
  }
  const storeDialog = (ctx, store = null) => {
    const { field, modal, json, navigate, tell, state, $, esc } = ctx;
    const body = field("Código", "codigo", store?.codigo || "") + field("Nome", "nome", store?.nome || "") +
      (store ? `<label class="field">Situação<select name="ativo"><option value="true" ${store.ativo ? "selected" : ""}>Ativa</option><option value="false" ${store.ativo ? "" : "selected"}>Inativa</option></select></label>` : "");
    const form = modal(store ? "Editar loja" : "Nova loja", body, "Salvar", async data => {
      await json(store ? "PATCH" : "POST", "/api/admin/stores", {
        ...(store ? { id: store.id } : {}), codigo: data.codigo.trim().toUpperCase(), nome: data.nome.trim(),
        ...(store ? { ativo: data.ativo === "true" } : {}),
      });
      await navigate(); tell("Loja salva.");
    });
    return form;
  };
