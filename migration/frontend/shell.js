// HTML seguro: os dados de nome, loja e login vêm do backend.
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, symbol => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[symbol]);
}

const NAV_ITEMS = [
  { to: "/admin", label: "Recebimento" },
  { to: "/admin/stores", label: "Lojas" },
  { to: "/admin/users", label: "Usuários" }
];

export function adminShell(user, path) {
  const viewer = user.papel === "visualizador";
  const items = viewer ? NAV_ITEMS.slice(0, 1) : NAV_ITEMS;
  return `<div class="app-frame admin-shell prado-admin">
    <aside class="prado-sidebar">
      <a href="/admin" class="prado-brand">
        <span class="prado-brand-mark" aria-hidden="true">P</span>
        <span><strong>Agenda Prado</strong><small>Gestão de recebimento</small></span>
      </a>
      <div class="prado-sidebar-label">OPERAÇÃO</div>
      <nav class="admin-topnav prado-side-nav" aria-label="Navegação lateral">
        ${items.map(item => `<a class="nav-link${path === item.to ? " active" : ""}" href="${item.to}" ${path === item.to ? 'aria-current="page"' : ""}>${item.label}</a>`).join("")}
      </nav>
      <div class="prado-sidebar-footer">Agenda Prado</div>
    </aside>
    <div class="prado-workspace">
    <header class="admin-topbar prado-topbar"><div class="admin-topbar-inner">
      <div class="prado-topbar-breadcrumb"><span>Operações</span><span aria-hidden="true">/</span><strong>${items.find(item => item.to === path)?.label ?? "Recebimento"}</strong></div>
      <nav class="admin-topnav prado-mobile-nav" aria-label="Navegação móvel">
        ${items.map(item => `<a class="nav-link${path === item.to ? " active" : ""}" href="${item.to}" ${path === item.to ? 'aria-current="page"' : ""}>${item.label}</a>`).join("")}
      </nav>
      <div class="admin-topbar-account">
        <div class="admin-topbar-user"><span>${escapeHtml(user.nome)}</span>
          <small>${viewer ? "Visualizador" : "Administrador"}</small></div>
        <button class="ghost-button admin-logout" type="button" data-logout>Sair</button>
      </div>
    </div></header>
    <main class="app-content admin-content" data-page-outlet></main>
    </div>
  </div>`;
}

export function storeShell(user) {
  const storeLabel = user.lojaNome ?? (user.lojaCodigo ? `Loja ${user.lojaCodigo}` : "Loja");
  return `<div class="store-shell store-operations-shell prado-store-visual">
    <header class="store-topbar store-operations-topbar"><div class="store-topbar-inner">
      <div class="store-topbar-brand">
        <img class="brand-icon small" src="/agenda-prado-icon.svg" alt="" aria-hidden="true">
        <div><strong>Agenda Prado</strong><span>Recebimento</span></div>
      </div>
      <div class="store-operator-context">
        <span>Conferente</span><strong>${escapeHtml(user.nome)}</strong>
        <small>${escapeHtml(storeLabel)}</small>
      </div>
      <div class="store-topbar-agenda-slot" data-agenda-command-slot></div>
      <div class="store-topbar-actions">
        <button class="ghost-button" type="button" data-logout>Sair</button>
      </div>
    </div></header>
    <main class="store-content store-operations-content" data-page-outlet></main>
  </div>`;
}