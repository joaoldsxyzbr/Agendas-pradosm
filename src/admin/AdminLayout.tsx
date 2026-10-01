import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const NAV_ITEMS = [
  { to: "/admin", label: "Recebimento", end: true },
  { to: "/admin/stores", label: "Lojas" },
  { to: "/admin/users", label: "Usuários" },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const dashboardOnly = user.papel === "visualizador";
  const navItems = dashboardOnly ? NAV_ITEMS.slice(0, 1) : NAV_ITEMS;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-frame admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-topbar-brand">
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

          <nav className="admin-topnav" aria-label="Navegação principal">
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

          <div className="admin-topbar-account">
            <div className="admin-topbar-user">
              <span>{user.nome}</span>
              <small>{dashboardOnly ? "Visualizador" : "Administrador"}</small>
            </div>
            <button
              className="ghost-button admin-logout"
              type="button"
              onClick={handleLogout}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="app-content admin-content">
        <Outlet />
      </main>
    </div>
  );
}
