import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { AdminAgendaHistoryPage } from "./admin/AdminAgendaHistoryPage";
import { AdminLayout } from "./admin/AdminLayout";
import { DashboardPage } from "./admin/DashboardPage";
import { ImportAgendaPage } from "./admin/ImportAgendaPage";
import { StoresPage } from "./admin/StoresPage";
import { UsersPage } from "./admin/UsersPage";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./auth/LoginPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { TodayPage } from "./agenda/TodayPage";
import { ThemeProvider } from "./theme/ThemeProvider";
import { useStorePresence } from "./presence/useStorePresence";
import { useRealtimeConnection } from "./realtime/useRealtimeConnection";

function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="page-panel">
      <div>
        <span className="eyebrow">Agenda Prado</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}

function StoreLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { disconnect } = useStorePresence(user?.papel === "conferente");

  if (!user) return null;

  const storeLabel =
    user.lojaNome ?? (user.lojaCodigo ? `Loja ${user.lojaCodigo}` : "Loja");

  async function handleLogout() {
    await disconnect();
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="store-shell store-operations-shell">
      <header className="store-topbar store-operations-topbar">
        <div className="store-topbar-inner">
          <div className="store-topbar-brand">
            <img
              className="brand-icon small"
              src="/agenda-prado-icon.svg"
              alt=""
              aria-hidden="true"
            />
            <div>
              <strong>Agenda Prado</strong>
              <span>Recebimento</span>
            </div>
          </div>

          <div className="store-operator-context">
            <span>Conferente</span>
            <strong>{user.nome}</strong>
            <small>{storeLabel}</small>
          </div>

          <div className="store-topbar-actions">
            <button className="ghost-button" type="button" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="store-content store-operations-content">
        <Outlet />
      </main>
    </div>
  );
}

function AdminDashboardRoute() {
  const { user } = useAuth();
  return <DashboardPage readOnly={user?.papel === "visualizador"} />;
}

function FullAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (user?.papel === "visualizador") {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="centered-state" role="status">
        Carregando...
      </main>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.papel === "conferente" ? "/app" : "/admin"} replace />;
}

export function AppRoutes() {
  const { user } = useAuth();
  useRealtimeConnection(user?.id ?? null);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["admin", "visualizador"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardRoute />} />
        <Route
          path="history"
          element={
            <FullAdminRoute>
              <AdminAgendaHistoryPage />
            </FullAdminRoute>
          }
        />
        <Route
          path="import"
          element={
            <FullAdminRoute>
              <ImportAgendaPage />
            </FullAdminRoute>
          }
        />
        <Route
          path="stores"
          element={
            <FullAdminRoute>
              <StoresPage />
            </FullAdminRoute>
          }
        />
        <Route
          path="users"
          element={
            <FullAdminRoute>
              <UsersPage />
            </FullAdminRoute>
          }
        />
      </Route>

      <Route
        path="/app"
        element={
          <ProtectedRoute roles={["conferente"]}>
            <StoreLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TodayPage />} />
        <Route path="history" element={<Navigate to="/app" replace />} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
