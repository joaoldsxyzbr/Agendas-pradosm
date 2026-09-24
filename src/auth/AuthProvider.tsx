import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "../../shared/auth";
import { ApiError, apiFetch } from "../lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (login: string, senha: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const current = await apiFetch<AuthUser>("/api/auth/me");
      setUser(current);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.error("Falha ao restaurar sessão", error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (loginValue: string, senha: string) => {
    const authenticated = await apiFetch<AuthUser>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: loginValue, senha }),
    });
    setUser(authenticated);
    return authenticated;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }
  return value;
}
