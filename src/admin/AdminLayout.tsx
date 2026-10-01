import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ThemeToggle } from "../theme/ThemeToggle";

const NAV_ITEMS = [
  { to: "/admin", label: "Recebimento", end: true, group: "Operação" },
  { to: "/admin/stores", label: "Lojas", group: "Cadastros" },
  { to: "/admin/users", label: "Usuários", group: "Cadastros" },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const dashboardOnly = user.papel === "visualizador";
  const navItems = dashboardOnly ? NAV_ITEMS.slice(0, 1) : NAV_ITEMS;
  const operationItems = navItems.filter((item) => item.group === "Operação");
  const registrationItems = navItems.filter((item) => item.group === "Cadastros");

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  function renderNavItems(
    items: typeof NAV_ITEMS,
  ) {
    return items.map((item) => (
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
    ));
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
          <div className="side-nav-group">
            <span className="side-nav-label">Operação</span>
            {renderNavItems(operationItems)}
          </div>

          {registrationItems.length > 0 ? (
            <div className="side-nav-group">
              <span className="side-nav-label">Cadastros</span>
              {renderNavItems(registrationItems)}
            </div>
          ) : null}
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
          {renderNavItems(navItems)}
        </nav>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
