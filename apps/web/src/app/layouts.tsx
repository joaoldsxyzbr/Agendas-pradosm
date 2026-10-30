import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router";
import { ClipboardCheck, FileBarChart, History, LogOut, Settings2, Store, Tags, Upload, Users } from "lucide-react";
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
  { path: "/app/tags", label: "Tags", icon: Tags, roles: ["conferente"] },
] as const;

const labels: Record<Role, string> = {
  admin: "Administrador",
  visualizador: "Visualizador",
  conferente: "Conferente",
};

export function AppLayout({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const signout = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      client.setQueryData(["session"], null);
      navigate("/login", { replace: true });
    },
  });
  const items = menu.filter(item => (item.roles as readonly Role[]).includes(user.papel));
  const nav = <nav aria-label="Navegação principal" className="flex gap-1 overflow-x-auto md:flex-col">
    {items.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} end
      className={({ isActive }) => cn("flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-xs font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-400", isActive ? "bg-sky-500/15 text-sky-200" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200")}>
      <Icon size={16} aria-hidden="true" />{label}
    </NavLink>)}
  </nav>;
  return <div className="flex min-h-svh flex-col md:flex-row">
    <aside className="hidden w-56 shrink-0 flex-col border-r border-[#2b415b] bg-[#111e2e] p-3 md:flex">
      <div className="mb-7 border-b border-slate-700/70 p-3">
        <strong className="text-sm tracking-tight text-white">Agenda Prado</strong>
        <p className="mt-1 text-[11px] text-slate-500">Gestão de recebimentos</p>
      </div>
      <div className="flex-1">{nav}</div>
      <div className="border-t border-slate-700/70 px-2 pt-3 text-[11px] text-slate-500">{labels[user.papel]}</div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#2b415b] bg-[#142337] px-4">
        <span className="text-sm font-semibold text-slate-200 md:text-xs">Painel operacional</span>
        <div className="flex items-center gap-3">
          <span className="max-w-40 truncate text-xs text-slate-400">{user.nome}</span>
          <Button variant="ghost" size="sm" disabled={signout.isPending} onClick={() => signout.mutate()}>
            <LogOut size={14} aria-hidden="true" /> Sair
          </Button>
        </div>
      </header>
      <div className="overflow-x-auto border-b border-[#2b415b] bg-[#111e2e] p-2 md:hidden">{nav}</div>
      {signout.isError && <p role="alert" className="px-5 pt-2 text-xs text-rose-300">Não foi possível encerrar a sessão.</p>}
      <main className="min-w-0 flex-1 p-4 md:p-6"><Outlet /></main>
    </div>
  </div>;
}
