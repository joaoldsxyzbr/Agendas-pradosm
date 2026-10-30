// HTML seguro: os dados de nome, loja e login vêm do backend.
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, symbol => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[symbol]);
}

const NAV_ITEMS = [
  { to: "/admin", label: "Recebimento", icon: "layout-dashboard" },
  { to: "/admin/reports", label: "Relatório Gerencial", icon: "chart-no-axes-column-increasing" },
  { to: "/admin/stores", label: "Lojas", icon: "store" },
  { to: "/admin/users", label: "Usuários", icon: "users" },
  { to: "/admin/diagnostics", label: "Logs e Auditoria", icon: "info" }
];

export function adminShell(user, path) {
  const viewer = user.papel === "visualizador";
  const items = viewer ? NAV_ITEMS.filter(item => ["/admin", "/admin/reports"].includes(item.to)) : NAV_ITEMS;
  return `<div class="app-frame admin-shell prado-admin">
    <aside class="prado-sidebar">
      <div class="prado-sidebar-head">
        <a href="/admin" class="prado-brand" aria-label="Agenda Prado — Gestão de recebimento">
          <span class="prado-brand-mark" aria-hidden="true">P</span>
          <span class="prado-brand-copy"><strong>Agenda Prado</strong><small>Gestão de recebimento</small></span>
        </a>
        <button class="prado-sidebar-toggle" type="button" data-sidebar-toggle aria-controls="admin-sidebar-navigation" aria-expanded="true" aria-label="Recolher navegação" title="Recolher navegação">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 4H5v16h4"></path><path d="m15 17-5-5 5-5"></path></svg>
        </button>
      </div>
      <div class="prado-sidebar-label">OPERAÇÃO</div>
      <nav id="admin-sidebar-navigation" class="admin-topnav prado-side-nav" aria-label="Navegação lateral">
        ${items.map(item => `<a class="nav-link${path === item.to ? " active" : ""}" href="${item.to}" aria-label="${item.label}" title="${item.label}" ${path === item.to ? 'aria-current="page"' : ""}><img class="prado-nav-icon" src="/vendor/lucide/${item.icon}.svg" alt="" aria-hidden="true" width="17" height="17">${item.label}</a>`).join("")}
      </nav>
      <div class="prado-sidebar-footer">Agenda Prado</div>
    </aside>
    <div class="prado-workspace">
    <header class="admin-topbar prado-topbar"><div class="admin-topbar-inner">
      <div class="prado-topbar-breadcrumb"><span>Operações</span><span aria-hidden="true">/</span><strong>${items.find(item => item.to === path)?.label ?? "Recebimento"}</strong></div>
      <nav class="admin-topnav prado-mobile-nav" aria-label="Navegação móvel">
        ${items.map(item => `<a class="nav-link${path === item.to ? " active" : ""}" href="${item.to}" aria-label="${item.label}" title="${item.label}" ${path === item.to ? 'aria-current="page"' : ""}><img class="prado-nav-icon" src="/vendor/lucide/${item.icon}.svg" alt="" aria-hidden="true" width="17" height="17">${item.label}</a>`).join("")}
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

export function storeShell(user, path = "/app") {
  const storeLabel = user.lojaNome ?? (user.lojaCodigo ? `Loja ${user.lojaCodigo}` : "Loja");
  const tagsPage = path === "/app/tags";
  return `<div class="store-shell store-operations-shell prado-store-visual prado-store-layout">
    <aside class="prado-store-sidebar" aria-label="Navegação do conferente">
      <div class="prado-store-sidebar-head">
        <a class="prado-brand" href="/app" aria-label="Agenda Prado — Gestão de recebimento">
          <span class="prado-brand-mark" aria-hidden="true">P</span>
          <span class="prado-brand-copy"><strong>Agenda Prado</strong><small>Gestão de recebimento</small></span>
        </a>
        <button class="prado-sidebar-toggle" type="button" data-sidebar-toggle aria-controls="store-sidebar-navigation" aria-expanded="true" aria-label="Recolher navegação" title="Recolher navegação">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 4H5v16h4"></path><path d="m15 17-5-5 5-5"></path></svg>
        </button>
      </div>
      <div class="prado-store-sidebar-label">OPERAÇÃO</div>
      <nav id="store-sidebar-navigation" class="prado-store-side-nav" aria-label="Áreas do conferente">
        <a class="prado-store-nav-link${tagsPage ? "" : " active"}" href="/app" aria-label="Conferência" title="Conferência" ${tagsPage ? "" : 'aria-current="page"'}>
          <span class="prado-store-nav-symbol" aria-hidden="true"><img class="prado-nav-icon" src="/vendor/lucide/clipboard-check.svg" alt="" width="17" height="17"></span>Conferência
        </a>
        <a class="prado-store-nav-link${tagsPage ? " active" : ""}" href="/app/tags" aria-label="Tags" title="Tags" ${tagsPage ? 'aria-current="page"' : ""}>
          <span class="prado-store-nav-symbol" aria-hidden="true"><img class="prado-nav-icon" src="/vendor/lucide/tags.svg" alt="" width="17" height="17"></span>Tags
        </a>
      </nav>
      <div class="prado-store-sidebar-footer" title="Loja: ${escapeHtml(storeLabel)}" aria-label="Loja: ${escapeHtml(storeLabel)}">
        <span>LOJA</span>
        <strong>${escapeHtml(storeLabel)}</strong>
      </div>
    </aside>
    <div class="prado-store-workspace">
      <header class="store-topbar store-operations-topbar prado-store-topbar">
        <div class="store-topbar-inner">
          <div class="prado-store-breadcrumb">
            <span>Operações</span><span aria-hidden="true">/</span><strong>${tagsPage ? "Tags" : "Conferente"}</strong>
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
            <h1>${tagsPage ? "Tags de fornecedores" : "Conferência de recebimentos"}</h1>
            <p>${escapeHtml(storeLabel)} · ${tagsPage ? "Organize etiquetas para os recebimentos" : "Acompanhe os recebimentos da agenda"}</p>
          </div>
          <div class="store-topbar-agenda-slot prado-store-heading-controls" data-agenda-command-slot></div>
        </div>
        <main class="store-content store-operations-content" data-page-outlet></main>
      </div>
    </div>
  </div>`;
}