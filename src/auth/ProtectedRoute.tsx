import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { UserRole } from "../../shared/auth";
import { useAuth } from "./AuthProvider";

function homeForRole(papel: UserRole) {
  return papel === "conferente" ? "/app" : "/admin";
}

export function ProtectedRoute({
  roles,
  children,
}: {
  roles: UserRole[];
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

  if (!roles.includes(user.papel)) {
    return <Navigate to={homeForRole(user.papel)} replace />;
  }

  return children;
}
