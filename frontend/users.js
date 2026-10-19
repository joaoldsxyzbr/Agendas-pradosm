import { apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";
import { openUserDialog } from "./user-dialog.js";

export const ROLE_LABELS = Object.freeze({
  admin: "Administrador", conferente: "Conferente", visualizador: "Visualizador"
});

// Equivalente aos filtros de UsersPage.tsx da main; mantém a ordem original.
export function filterUsers(users, stores, search = "", role = "todos", status = "todos") {
  const names = new Map(stores.map(store => [store.id, `${store.codigo} - ${store.nome}`]));
  const query = search.trim().toLocaleLowerCase("pt-BR");
  return users.filter(user => {
    const store = user.lojaId ? names.get(user.lojaId) || "" : "";
    const text = [user.nome, user.login, store, ROLE_LABELS[user.papel] || ""]
      .join(" ").toLocaleLowerCase("pt-BR");
    return (!query || text.includes(query)) &&
      (role === "todos" || user.papel === role) &&
      (status === "todos" || (status === "ativos" ? user.ativo : !user.ativo));
  });
}

export function renderUsers(root, { request = apiFetch } = {}) {
  let users = [], stores = [];
  let search = "", role = "todos", status = "todos";
  let disposed = false, dialogCleanup = null;

  root.innerHTML = `<section class="admin-page registry-page">
    <header class="page-heading registry-page-heading">
      <div><span class="eyebrow">Cadastros</span><h1>Usuários</h1>
        <p>Gerencie os acessos ao sistema.</p></div>
      <div class="registry-heading-actions">
        <span class="registry-heading-meta" data-user-count>0 usuários · 0 ativos</span>
        <button class="primary-button registry-new-button" type="button" data-create-user>+ Novo usuário</button>
      </div>
    </header>
    <p class="feedback-message" data-user-feedback hidden></p>
    <div class="table-card registry-card">
      <div class="registry-toolbar registry-toolbar-users">
        <label class="registry-search"><span class="sr-only">Buscar usuário</span>
          <input type="search" data-user-search aria-label="Buscar usuário" placeholder="Buscar por nome, login ou loja...">
        </label>
        <label><span class="sr-only">Filtrar por papel</span>
          <select data-user-role aria-label="Filtrar por papel">
            <option value="todos">Todos os papéis</option>
            <option value="admin">Administrador</option>
            <option value="conferente">Conferente</option>
            <option value="visualizador">Visualizador</option>
          </select>
        </label>
        <label><span class="sr-only">Filtrar por situação</span>
          <select data-user-status aria-label="Filtrar por situação">
            <option value="todos">Todas as situações</option>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
          </select>
        </label>
      </div>
      <div class="table-scroll"><table class="registry-table">
        <thead><tr>
          <th>Nome</th><th>Login</th><th>Loja</th><th>Papel</th><th>Situação</th>
          <th><span class="sr-only">Ações</span></th>
        </tr></thead>
        <tbody data-user-rows><tr><td colspan="6" class="empty-cell">Carregando...</td></tr></tbody>
      </table></div>
    </div>
  </section>`;

  const feedback = message => {
    const element = root.querySelector("[data-user-feedback]");
    if (!element) return;
    element.textContent = message || "";
    element.hidden = !message;
  };
  const redraw = () => {
    if (disposed) return;
    root.querySelector("[data-user-count]").textContent =
      `${users.length} ${users.length === 1 ? "usuário" : "usuários"} · ${users.filter(u => u.ativo).length} ativos`;
    const matches = filterUsers(users, stores, search, role, status);
    const names = new Map(stores.map(store => [store.id, `${store.codigo} - ${store.nome}`]));
    root.querySelector("[data-user-rows]").innerHTML = matches.length
      ? matches.map(user => `<tr data-user-id="${escapeHtml(user.id)}">
        <td class="registry-primary-cell">${escapeHtml(user.nome)}</td>
        <td>${escapeHtml(user.login)}</td>
        <td>${escapeHtml(user.lojaId ? names.get(user.lojaId) || "Loja não localizada" : "—")}</td>
        <td>${escapeHtml(ROLE_LABELS[user.papel] || user.papel)}</td>
        <td><span class="registry-status ${user.ativo ? "is-active" : "is-inactive"}">${user.ativo ? "Ativo" : "Inativo"}</span></td>
        <td class="table-action"><button class="ghost-button registry-edit-button"
          type="button" data-edit-user-id="${escapeHtml(user.id)}">Editar</button></td>
      </tr>`).join("")
      : '<tr><td colspan="6" class="empty-cell">Nenhum usuário encontrado.</td></tr>';
  };
  const load = async () => {
    const [userData, storeData] = await Promise.all([
      request("/api/admin/users"), request("/api/admin/stores")
    ]);
    if (disposed) return;
    users = userData; stores = storeData;
    redraw();
  };
  const open = user => {
    dialogCleanup?.();
    dialogCleanup = openUserDialog(root, {
      user, stores, request,
      onSaved: async updated => {
        if (disposed) return;
        if (user) {
          users = users.map(item => item.id === updated.id ? updated : item);
          feedback("Usuário atualizado com sucesso.");
          redraw();
        } else {
          feedback("Usuário cadastrado com sucesso.");
          try { await load(); }
          catch { feedback("Não foi possível carregar os usuários."); }
        }
      },
      onClose: () => { dialogCleanup = null; }
    });
  };
  const onInput = event => {
    if (event.target.matches("[data-user-search]")) {
      search = event.target.value;
      redraw();
    }
  };
  const onChange = event => {
    if (event.target.matches("[data-user-role]")) {
      role = event.target.value; redraw();
    } else if (event.target.matches("[data-user-status]")) {
      status = event.target.value; redraw();
    }
  };
  const onClick = event => {
    if (event.target.closest?.("[data-create-user]")) {
      feedback(null); open(null); return;
    }
    const button = event.target.closest?.("[data-edit-user-id]");
    if (!button) return;
    const user = users.find(item => item.id === button.dataset.editUserId);
    if (user) open(user);
  };
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);
  void load().catch(() => { if (!disposed) feedback("Não foi possível carregar os usuários."); });

  return () => {
    disposed = true;
    dialogCleanup?.();
    root.removeEventListener("input", onInput);
    root.removeEventListener("change", onChange);
    root.removeEventListener("click", onClick);
  };
}