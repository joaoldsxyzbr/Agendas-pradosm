import {
  BrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import type { UserProfile } from "../shared/auth";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./auth/LoginPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
};

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/history", label: "Histórico" },
  { to: "/admin/import", label: "Importar" },
  { to: "/admin/stores", label: "Lojas" },
  { to: "/admin/users", label: "Usuários" },
];

const STORE_NAV: NavItem[] = [
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

function AuthenticatedLayout({ profile }: { profile: UserProfile }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const items = profile === "admin" ? ADMIN_NAV : STORE_NAV;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small" aria-hidden="true">
            AP
          </div>
          <div>
            <strong>Agenda Prado</strong>
            <span>{profile === "admin" ? "Administração" : "Recebimento"}</span>
          </div>
        </div>

        <nav className="side-nav" aria-label="Navegação principal">
          {items.map((item) => (
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
          <div className="user-summary">
            <span>{user.nome}</span>
            <small>{profile === "admin" ? "Administrador" : "Loja"}</small>
          </div>
          <button className="ghost-button" type="button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </aside>

      <div className="content-shell">
        <header className="mobile-header">
          <div>
            <strong>Agenda Prado</strong>
            <span>{user.nome}</span>
          </div>
          <button className="ghost-button" type="button" onClick={handleLogout}>
            Sair
          </button>
        </header>

        <nav className="mobile-nav" aria-label="Navegação principal">
          {items.map((item) => (
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
            <AuthenticatedLayout profile="admin" />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <PlaceholderPage
              title="Dashboard"
              description="Visão geral das agendas do dia por loja."
            />
          }
        />
        <Route
          path="history"
          element={
            <PlaceholderPage
              title="Histórico"
              description="Consulte agendas já importadas."
            />
          }
        />
        <Route
          path="import"
          element={
            <PlaceholderPage
              title="Importar agenda"
              description="Envie e revise o PDF antes da confirmação."
            />
          }
        />
        <Route
          path="stores"
          element={
            <PlaceholderPage
              title="Lojas"
              description="Cadastre e gerencie as lojas."
            />
          }
        />
        <Route
          path="users"
          element={
            <PlaceholderPage
              title="Usuários"
              description="Gerencie os acessos vinculados às lojas."
            />
          }
        />
      </Route>

      <Route
        path="/app"
        element={
          <ProtectedRoute profile="loja">
            <AuthenticatedLayout profile="loja" />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <PlaceholderPage
              title="Agenda de hoje"
              description="Acompanhe os recebimentos previstos para hoje."
            />
          }
        />
        <Route
          path="history"
          element={
            <PlaceholderPage
              title="Histórico"
              description="Consulte agendas dos dias anteriores."
            />
          }
        />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
