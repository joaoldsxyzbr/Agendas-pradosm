import { apiFetch } from "./api.js";
import { createAuthController } from "./session.js";
import { applyTheme, readStoredTheme } from "./theme.js";
import { resolveRoute } from "./routes.js";
import { renderLogin } from "./login.js";
import { adminShell, storeShell } from "./shell.js";
import { setupSidebarNavigation } from "./sidebar-navigation.js";

// Runtime nativo carregado pelo entrypoint de produção através de frontend/application.js.
// Usa apenas os renderizadores registrados para cada rota e perfil.
export function createVanillaRuntime({
  root,
  pageRenderers = {},
  request = apiFetch,
  beforeLogout = async () => {},
  onSessionChange = () => {},
  win = window,
  doc = document
}) {
  const auth = createAuthController({ request, onChange: onSessionChange });
  let cleanup = () => {};
  let cleanupSidebar = () => {};
  let activePage = null;
  let activeLayout = null;
  let started = false;

  const navigate = (path, { replace = false } = {}) => {
    if (replace) win.history.replaceState(null, "", path);
    else win.history.pushState(null, "", path);
    render();
  };

  function render() {
    cleanup();
    cleanup = () => {};
    const route = resolveRoute(win.location.pathname, auth.user);
    if (route.redirect) {
      if (route.redirect !== win.location.pathname) {
        win.history.replaceState(null, "", route.redirect);
        return render();
      }
      throw Error("Redirecionamento circular inesperado.");
    }
    if (route.view === "login") {
      cleanupSidebar();
      cleanupSidebar = () => {};
      activePage = "login";
      activeLayout = null;
      cleanup = renderLogin(root, { auth, navigate, request });
      return;
    }
    if (route.layout !== activeLayout) {
      cleanupSidebar();
      root.innerHTML = route.layout === "store"
        ? storeShell(auth.user)
        : adminShell(auth.user, win.location.pathname);
      cleanupSidebar = setupSidebarNavigation(root, win);
      activeLayout = route.layout;
    }
    const outlet = root.querySelector("[data-page-outlet]");
    if (!outlet) throw Error("Área da página não encontrada.");
    for (const anchor of root.querySelectorAll(".admin-topnav .nav-link")) {
      const active = anchor.getAttribute("href") === win.location.pathname;
      anchor.classList.toggle("active", active);
      if (active) anchor.setAttribute("aria-current", "page");
      else anchor.removeAttribute("aria-current");
    }
    // Atualiza a trilha visual ao navegar sem reconstruir o shell.
    const currentLink = root.querySelector(".prado-side-nav .nav-link.active");
    const breadcrumb = root.querySelector(".prado-topbar-breadcrumb strong");
    if (breadcrumb && currentLink) breadcrumb.textContent = currentLink.textContent.trim();
    const renderer = pageRenderers[route.view];
    if (typeof renderer !== "function") {
      // Impede ativação prematura de uma interface incompleta.
      throw Error("Página da main ainda não migrada: " + route.view);
    }
    if (route.view !== activePage) outlet.replaceChildren();
    activePage = route.view;
    const remove = renderer({
      root: outlet, user: auth.user, readOnly: route.readOnly,
      navigate, request, commandSlot: root.querySelector("[data-agenda-command-slot]")
    });
    if (typeof remove === "function") cleanup = remove;
  }

  const onPop = () => render();
  const onLink = event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.("a[href]");
    if (!anchor || !root.contains(anchor) || anchor.target || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href);
    if (url.origin !== win.location.origin) return;
    if (url.pathname === win.location.pathname && url.search === win.location.search) return;
    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  };
  const onLogout = async event => {
    const button = event.target.closest?.("[data-logout]");
    if (!button || !root.contains(button) || button.disabled) return;
    button.disabled = true;
    try {
      if (auth.user?.papel === "conferente") {
        try { await beforeLogout(); } catch (err) {
          console.warn("Não foi possível sinalizar a saída do conferente.", err);
        }
      }
      // A queda do serviço de presença não pode impedir o encerramento da sessão.
      await auth.logout();
    } catch (err) {
      console.error("Falha ao sair", err);
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return {
    auth,
    navigate,
    async start() {
      if (started) return;
      started = true;
      applyTheme(readStoredTheme(), doc);
      win.addEventListener("popstate", onPop);
      root.addEventListener("click", onLink);
      root.addEventListener("click", onLogout);
      await auth.refresh();
      render();
    },
    stop() {
      cleanup();
      cleanupSidebar();
      cleanupSidebar = () => {};
      win.removeEventListener("popstate", onPop);
      root.removeEventListener("click", onLink);
      root.removeEventListener("click", onLogout);
      started = false;
      activePage = null;
      activeLayout = null;
    }
  };
}