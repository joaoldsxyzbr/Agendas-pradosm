const STORAGE_PREFIX = "agenda-prado-sidebar-";
const AUTO_COLLAPSE_QUERY = "(max-width: 1440px)";

export function setupSidebarNavigation(root, win = window) {
  const shell = root.querySelector(".prado-admin.admin-shell, .prado-store-layout.store-shell");
  const toggle = shell?.querySelector("[data-sidebar-toggle]");
  if (!shell || !toggle) return () => {};

  const layout = shell.matches(".prado-store-layout") ? "store" : "admin";
  const key = STORAGE_PREFIX + layout;
  let stored = null;
  try {
    stored = win.localStorage.getItem(key);
  } catch {
    // A navegação continua utilizável mesmo quando o armazenamento está bloqueado.
  }

  const autoCollapsed = typeof win.matchMedia === "function"
    ? win.matchMedia(AUTO_COLLAPSE_QUERY).matches
    : Number(win.innerWidth) <= 1440;
  let collapsed = stored === "collapsed" ? true : stored === "expanded" ? false : autoCollapsed;

  function sync() {
    shell.dataset.sidebarCollapsed = String(collapsed);
    const label = collapsed ? "Expandir navegação" : "Recolher navegação";
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  }

  function onToggle() {
    collapsed = !collapsed;
    sync();
    try {
      win.localStorage.setItem(key, collapsed ? "collapsed" : "expanded");
    } catch {
      // A preferência vale até a página ser recarregada.
    }
  }

  toggle.addEventListener("click", onToggle);
  sync();
  return () => toggle.removeEventListener("click", onToggle);
}