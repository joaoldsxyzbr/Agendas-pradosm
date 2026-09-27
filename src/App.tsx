import {
  BrowserRouter,
  Navigate,
  NavLink,
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
import { HistoryPage } from "./agenda/HistoryPage";
import { TodayPage } from "./agenda/TodayPage";
import { ThemeProvider } from "./theme/ThemeProvider";
import { ThemeToggle } from "./theme/ThemeToggle";

const STORE_NAV = [
  { to: "/app", label: "Hoje", end: true },
  { to: "/app/history", label: "Histórico" },
];

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

  if (!user) return null;

  const storeLabel =
    user.lojaNome ?? (user.lojaCodigo ? `Loja ${user.lojaCodigo}` : "Loja");

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img
            className="brand-icon small"
            src="/agenda-prado-icon.svg"
            alt=""
            aria-hidden="true"
          />
          <div className="sidebar-brand-copy">
            <strong>Agenda Prado</strong>
            <span className="conferente-name">{user.nome}</span>
            <small className="conferente-store">{storeLabel}</small>
          </div>
        </div>

        <nav className="side-nav" aria-label="Navegação principal">
          {STORE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-actions">
            <ThemeToggle />
            <button className="ghost-button" type="button" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      </aside>

      <div className="content-shell">
        <header className="mobile-header">
          <div>
            <strong>Agenda Prado</strong>
            <span>{user.nome} · {storeLabel}</span>
          </div>
          <div className="mobile-header-actions">
            <ThemeToggle />
            <button className="ghost-button" type="button" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Navegação principal">
          {STORE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
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
  return <Navigate to={user.perfil === "admin" ? "/admin" : "/app"} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute profile="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="history" element={<AdminAgendaHistoryPage />} />
        <Route path="import" element={<ImportAgendaPage />} />
        <Route path="stores" element={<StoresPage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>

      <Route
        path="/app"
        element={
          <ProtectedRoute profile="loja">
            <StoreLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TodayPage />} />
        <Route path="history" element={<HistoryPage />} />
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
