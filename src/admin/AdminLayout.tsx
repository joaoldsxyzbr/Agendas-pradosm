import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ThemeToggle } from "../theme/ThemeToggle";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/stores", label: "Lojas" },
  { to: "/admin/users", label: "Usuários" },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const dashboardOnly = user.acesso === "dashboard";
  const navItems = dashboardOnly ? NAV_ITEMS.slice(0, 1) : NAV_ITEMS;

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
          <div>
            <strong>Agenda Prado</strong>
            <span>{dashboardOnly ? "Visualização" : "Administração"}</span>
          </div>
        </div>

        <nav className="side-nav" aria-label="Navegação principal">
          {navItems.map((item) => (
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
            <small>{dashboardOnly ? "Visualizador" : "Administrador"}</small>
          </div>
          <ThemeToggle />
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
          <div className="mobile-header-actions">
            <ThemeToggle />
            <button className="ghost-button" type="button" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Navegação principal">
          {navItems.map((item) => (
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
