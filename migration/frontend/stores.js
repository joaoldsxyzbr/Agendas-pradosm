import { apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";
import { openStoreDialog } from "./store-dialog.js";

// Regra de busca/filtro copiada de src/admin/StoresPage.tsx da main.
export function filterStores(stores, search = "", statusFilter = "todas") {
  const query = search.trim().toLocaleLowerCase("pt-BR");
  return stores.filter(store => {
    const matchesSearch = !query ||
      [store.codigo, store.nome].join(" ").toLocaleLowerCase("pt-BR").includes(query);
    const matchesStatus = statusFilter === "todas" ||
      (statusFilter === "ativas" ? store.ativo : !store.ativo);
    return matchesSearch && matchesStatus;
  });
}

export function activeStoreCount(stores) {
  return stores.filter(store => store.ativo).length;
}

export function renderStores(root, { request = apiFetch } = {}) {
  let stores = [];
  let search = "";
  let statusFilter = "todas";
  let disposed = false;
  let closeDialog = null;

  root.innerHTML = `<section class="admin-page registry-page">
    <header class="page-heading registry-page-heading">
      <div><span class="eyebrow">Cadastros</span><h1>Lojas</h1>
        <p>Gerencie as unidades habilitadas para recebimento.</p></div>
      <div class="registry-heading-actions">
        <span class="registry-heading-meta" data-store-count>0 lojas · 0 ativas</span>
        <button type="button" class="primary-button registry-new-button" data-create-store>+ Nova loja</button>
      </div>
    </header>
    <p class="feedback-message" data-store-feedback hidden></p>
    <div class="table-card registry-card">
      <div class="registry-toolbar registry-toolbar-stores">
        <label class="registry-search"><span class="sr-only">Buscar loja</span>
          <input type="search" data-store-search placeholder="Buscar por código ou nome..." aria-label="Buscar loja">
        </label>
        <label><span class="sr-only">Filtrar por situação</span>
          <select data-store-status aria-label="Filtrar por situação">
            <option value="todas">Todas as situações</option>
            <option value="ativas">Ativas</option>
            <option value="inativas">Inativas</option>
          </select>
        </label>
      </div>
      <div class="table-scroll"><table class="registry-table">
        <thead><tr><th>Código</th><th>Nome</th><th>Situação</th><th><span class="sr-only">Ações</span></th></tr></thead>
        <tbody data-store-rows><tr><td colspan="4" class="empty-cell">Carregando...</td></tr></tbody>
      </table></div>
    </div>
  </section>`;

  const feedback = message => {
    const node = root.querySelector("[data-store-feedback]");
    if (!node) return;
    node.textContent = message || "";
    node.hidden = !message;
  };
  const renderRows = () => {
    if (disposed) return;
    root.querySelector("[data-store-count]").textContent =
      `${stores.length} ${stores.length === 1 ? "loja" : "lojas"} · ${activeStoreCount(stores)} ativas`;
    const filtered = filterStores(stores, search, statusFilter);
    root.querySelector("[data-store-rows]").innerHTML = filtered.length
      ? filtered.map(store => `<tr data-store-id="${escapeHtml(store.id)}">
          <td class="registry-code-cell">${escapeHtml(store.codigo)}</td>
          <td class="registry-primary-cell">${escapeHtml(store.nome)}</td>
          <td><span class="registry-status ${store.ativo ? "is-active" : "is-inactive"}">${store.ativo ? "Ativa" : "Inativa"}</span></td>
          <td class="table-action"><button class="ghost-button registry-edit-button" type="button" data-edit-store-id="${escapeHtml(store.id)}">Editar</button></td>
        </tr>`).join("")
      : '<tr><td colspan="4" class="empty-cell">Nenhuma loja encontrada.</td></tr>';
  };
  const load = async () => {
    const result = await request("/api/admin/stores");
    if (disposed) return;
    stores = result;
    renderRows();
  };
  const open = store => {
    closeDialog?.();
    closeDialog = openStoreDialog(root, {
      store, request,
      onSaved: async updated => {
        if (disposed) return;
        if (store) {
          stores = stores.map(item => item.id === updated.id ? updated : item);
          feedback("Loja atualizada com sucesso.");
          renderRows();
        } else {
          feedback("Loja cadastrada com sucesso.");
          try { await load(); } catch { feedback("Não foi possível carregar as lojas."); }
        }
      },
      onDeleted: storeId => {
        if (disposed) return;
        stores = stores.filter(item => item.id !== storeId);
        feedback("Loja excluída com sucesso.");
        renderRows();
      },
      onClose: () => { closeDialog = null; }
    });
  };

  const onInput = event => {
    if (event.target.matches("[data-store-search]")) {
      search = event.target.value;
      renderRows();
    }
  };
  const onChange = event => {
    if (event.target.matches("[data-store-status]")) {
      statusFilter = event.target.value;
      renderRows();
    }
  };
  const onClick = event => {
    if (event.target.closest?.("[data-create-store]")) {
      feedback(null);
      open(null);
    }
    const editButton = event.target.closest?.("[data-edit-store-id]");
    if (!editButton) return;
    const store = stores.find(item => item.id === editButton.dataset.editStoreId);
    if (store) open(store);
  };
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);
  void load().catch(() => { if (!disposed) feedback("Não foi possível carregar as lojas."); });
  return () => {
    disposed = true;
    closeDialog?.();
    root.removeEventListener("input", onInput);
    root.removeEventListener("change", onChange);
    root.removeEventListener("click", onClick);
  };
}
