import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { UserProfile } from "../../shared/auth";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute({
  profile,
  children,
}: {
  profile: UserProfile;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="centered-state" role="status">
        Carregando...
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.perfil !== profile) {
    return (
      <Navigate to={user.perfil === "admin" ? "/admin" : "/app"} replace />
    );
  }

  return children;
}
