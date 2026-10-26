import { apiFetch, ApiError } from "./api.js";

// Equivalente ao AuthProvider da main, sem dependência de React.
export function createAuthController({ request = apiFetch, onChange = () => {} } = {}) {
  let user = null;
  let loading = true;
  const changed = () => onChange({ user, loading });
  return {
    get user() { return user; },
    get loading() { return loading; },
    async refresh() {
      try {
        user = await request("/api/auth/me");
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          console.error("Falha ao restaurar sessão", error);
        }
        user = null;
      } finally {
        loading = false;
        changed();
      }
      return user;
    },
    async login(loginValue, senha) {
      const authenticated = await request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginValue, senha })
      });
      user = authenticated;
      loading = false;
      changed();
      return authenticated;
    },
    async quickLogin(role, code) {
      const authenticated = await request("/api/auth/quick-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, code })
      });
      user = authenticated;
      loading = false;
      changed();
      return authenticated;
    },
    async logout() {
      try {
        await request("/api/auth/logout", { method: "POST" });
      } finally {
        user = null;
        loading = false;
        changed();
      }
    }
  };
}