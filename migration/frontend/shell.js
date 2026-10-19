// HTML seguro: os dados de nome, loja e login vêm do backend.
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, symbol => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[symbol]);
}

const NAV_ITEMS = [
  { to: "/admin", label: "Recebimento" },
  { to: "/admin/reports", label: "Relatório Gerencial" },
  { to: "/admin/stores", label: "Lojas" },
  { to: "/admin/users", label: "Usuários" }
];

export function adminShell(user, path) {
  const viewer = user.papel === "visualizador";
  const items = viewer ? NAV_ITEMS.filter(item => ["/admin", "/admin/reports"].includes(item.to)) : NAV_ITEMS;
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
  return `<div class="store-shell store-operations-shell prado-store-visual prado-store-layout">
    <aside class="prado-store-sidebar" aria-label="Navegação do conferente">
      <a class="prado-brand" href="/app">
        <span class="prado-brand-mark" aria-hidden="true">P</span>
        <span><strong>Agenda Prado</strong><small>Gestão de recebimento</small></span>
      </a>
      <div class="prado-store-sidebar-label">OPERAÇÃO</div>
      <nav class="prado-store-side-nav" aria-label="Áreas do conferente">
        <a class="prado-store-nav-link active" href="/app" aria-current="page">
          <span class="prado-store-nav-symbol" aria-hidden="true">✓</span>Conferência
        </a>
      </nav>
      <div class="prado-store-sidebar-footer">
        <span>LOJA</span>
        <strong>${escapeHtml(storeLabel)}</strong>
      </div>
    </aside>
    <div class="prado-store-workspace">
      <header class="store-topbar store-operations-topbar prado-store-topbar">
        <div class="store-topbar-inner">
          <div class="prado-store-breadcrumb">
            <span>Operações</span><span aria-hidden="true">/</span><strong>Conferente</strong>
          </div>
          <div class="store-operator-context">
            <span>Conferente</span><strong>${escapeHtml(user.nome)}</strong>
            <small>${escapeHtml(storeLabel)}</small>
          </div>
          <div class="store-topbar-actions">
            <button class="ghost-button" type="button" data-logout>Sair</button>
          </div>
        </div>
      </header>
      <div class="prado-store-body">
        <div class="prado-store-heading-bar">
          <div class="prado-store-page-heading">
            <span class="prado-store-eyebrow">OPERAÇÃO DE LOJA</span>
            <h1>Conferência de recebimentos</h1>
            <p>${escapeHtml(storeLabel)} · Acompanhe os recebimentos da agenda</p>
          </div>
          <div class="store-topbar-agenda-slot prado-store-heading-controls" data-agenda-command-slot></div>
        </div>
        <main class="store-content store-operations-content" data-page-outlet></main>
      </div>
    </div>
  </div>`;
}