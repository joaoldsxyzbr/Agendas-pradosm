// Caminhos copiados de App.tsx da main. URL real (History API), nunca hash.
export const APP_PATHS = Object.freeze([
  "/login", "/admin", "/admin/history", "/admin/import", "/admin/stores",
  "/admin/users", "/admin/reports", "/admin/diagnostics", "/app"
]);

export function homeForRole(role) {
  return role === "conferente" ? "/app" : "/admin";
}

export function resolveRoute(pathname, user) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/login") {
    return user ? { redirect: homeForRole(user.papel) } : { view: "login" };
  }
  if (!user) return { redirect: "/login" };
  if (path === "/app/history") return { redirect: "/app" };
  if (path === "/app") {
    return user.papel === "conferente"
      ? { view: "today", layout: "store" }
      : { redirect: homeForRole(user.papel) };
  }
  if (path === "/admin" || path.startsWith("/admin/")) {
    if (user.papel !== "admin" && user.papel !== "visualizador") {
      return { redirect: homeForRole(user.papel) };
    }
    const pages = {
      "/admin": "dashboard",
      "/admin/history": "history",
      "/admin/import": "import",
      "/admin/stores": "stores",
      "/admin/users": "users",
      "/admin/reports": "reports",
      "/admin/diagnostics": "diagnostics"
    };
    const page = pages[path];
    if (!page) return { redirect: homeForRole(user.papel) };
    if (user.papel === "visualizador" && page !== "dashboard" && page !== "reports") {
      return { redirect: "/admin" };
    }
    return { view: page, layout: "admin", readOnly: user.papel === "visualizador" };
  }
  return { redirect: homeForRole(user.papel) };
}