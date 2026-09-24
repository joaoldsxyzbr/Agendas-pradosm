import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/history", label: "Histórico" },
  { to: "/admin/import", label: "Importar" },
  { to: "/admin/stores", label: "Lojas" },
  { to: "/admin/users", label: "Usuários" },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

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
            <span>Administração</span>
          </div>
        </div>

        <nav className="side-nav" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
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
            <small>Administrador</small>
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
          {NAV_ITEMS.map((item) => (
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
