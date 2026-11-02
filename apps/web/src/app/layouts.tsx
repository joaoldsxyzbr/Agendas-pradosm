import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router";
import { ClipboardCheck, FileBarChart, History, LogOut, PanelLeft, Settings2, Store, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logout, type SessionUser, type Role } from "@/features/auth/session";

const menu = [
  { path: "/admin", label: "Recebimento", icon: ClipboardCheck, roles: ["admin", "visualizador"] },
  { path: "/admin/reports", label: "Relatório Gerencial", icon: FileBarChart, roles: ["admin", "visualizador"] },
  { path: "/admin/history", label: "Histórico", icon: History, roles: ["admin"] },
  { path: "/admin/import", label: "Importar agenda", icon: Upload, roles: ["admin"] },
  { path: "/admin/stores", label: "Lojas", icon: Store, roles: ["admin"] },
  { path: "/admin/users", label: "Usuários", icon: Users, roles: ["admin"] },
  { path: "/admin/diagnostics", label: "Logs e Auditoria", icon: Settings2, roles: ["admin"] },
  { path: "/app", label: "Conferência", icon: ClipboardCheck, roles: ["conferente"] },
] as const;

const labels: Record<Role, string> = {
  admin: "Administrador",
  visualizador: "Visualizador",
  conferente: "Conferente",
};

const SIDEBAR_STORAGE_PREFIX = "agenda-prado-sidebar-";
const AUTO_COLLAPSE_QUERY = "(max-width: 1440px)";

function sidebarKey(role: Role) {
  return SIDEBAR_STORAGE_PREFIX + (role === "conferente" ? "store" : "admin");
}

function readSidebarCollapsed(role: Role) {
  try {
    const saved = window.localStorage.getItem(sidebarKey(role));
    if (saved === "collapsed") return true;
    if (saved === "expanded") return false;
  } catch {
    // localStorage bloqueado: segue para o critério automático
  }
  return typeof window.matchMedia === "function" && window.matchMedia(AUTO_COLLAPSE_QUERY).matches;
}

function writeSidebarCollapsed(role: Role, collapsed: boolean) {
  try {
    window.localStorage.setItem(sidebarKey(role), collapsed ? "collapsed" : "expanded");
  } catch {
    // localStorage bloqueado: mantém apenas o estado em memória
  }
}

export function AppLayout({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [collapsed, setCollapsed] = useState(() => readSidebarCollapsed(user.papel));
  const signout = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      client.setQueryData(["session"], null);
      navigate("/login", { replace: true });
    },
  });
  const items = menu.filter(item => (item.roles as readonly Role[]).includes(user.papel));
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeSidebarCollapsed(user.papel, next);
  };
  const renderNav = (compact: boolean) => <nav aria-label="Navegação principal" className={cn("flex min-w-0 gap-1 md:flex-col", compact && "md:items-center")}>
    {items.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} end
      className={({ isActive }) => cn("flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-xs font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-400",
        compact && "md:justify-center md:px-2",
        isActive ? "bg-sky-500/15 text-sky-200" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200")}>
      <Icon size={16} aria-hidden="true" />
      <span className={compact ? "sr-only" : undefined}>{label}</span>
    </NavLink>)}
  </nav>;
  return <div className="flex min-h-svh w-screen min-w-0 max-w-[100vw] flex-col overflow-x-clip md:w-full md:max-w-full md:flex-row">
    <aside className={cn("hidden shrink-0 flex-col border-r border-[#2b415b] bg-[#111e2e] p-3 md:sticky md:top-0 md:flex md:h-svh md:max-h-svh md:overflow-y-auto", collapsed ? "w-[76px]" : "w-56")}>
      <div className={cn("mb-7 border-b border-slate-700/70 p-3", collapsed && "flex flex-col items-center gap-2")}>
        {collapsed ? <>
          <strong className="text-sm tracking-tight text-white">AP</strong>
          <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Expandir navegação" aria-expanded={false} onClick={toggleCollapsed}>
            <PanelLeft size={16} aria-hidden="true" />
          </Button>
        </> : <>
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm tracking-tight text-white">Agenda Prado</strong>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Recolher navegação" aria-expanded onClick={toggleCollapsed}>
              <PanelLeft size={16} aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Gestão de recebimentos</p>
        </>}
      </div>
      <div className="flex-1">{renderNav(collapsed)}</div>
      <div className={cn("border-t border-slate-700/70 px-2 pt-3 text-[11px] text-slate-500", collapsed && "truncate text-center")}>{labels[user.papel]}</div>
    </aside>
    <div className="flex w-screen min-w-0 max-w-[100vw] flex-1 flex-col md:w-full md:max-w-full">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#2b415b] bg-[#142337] px-4">
        <span className="text-sm font-semibold text-slate-200 md:text-xs">Painel operacional</span>
        <div className="flex items-center gap-3">
          <span className="max-w-40 truncate text-xs text-slate-400">{user.nome}</span>
          <Button variant="ghost" size="sm" disabled={signout.isPending} onClick={() => signout.mutate()}>
            <LogOut size={14} aria-hidden="true" /> Sair
          </Button>
        </div>
      </header>
      <div data-testid="mobile-navigation" className="w-screen min-w-0 max-w-[100vw] overflow-x-auto overscroll-x-contain border-b border-[#2b415b] bg-[#111e2e] p-2 md:hidden">{renderNav(false)}</div>
      {signout.isError && <p role="alert" className="px-5 pt-2 text-xs text-rose-300">Não foi possível encerrar a sessão.</p>}
      <main className="w-full min-w-0 max-w-full flex-1 overflow-x-clip p-4 md:p-6"><Outlet /></main>
    </div>
  </div>;
}
