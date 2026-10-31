import { Navigate, Outlet, Route, Routes } from "react-router";
import { AppLayout } from "./layouts";
import { useSession } from "./session-query";
import { LoginPage } from "@/features/auth/login-page";
import { PlaceholderPage } from "@/features/placeholder-page";
import { ReceivingPage } from "@/features/receiving/receiving-page";
import { ImportPage } from "@/features/import/import-page";
import { ConferencePage } from "@/features/conference/conference-page";
import { TagsPage } from "@/features/tags/tags-page";
import { ReportsPage } from "@/features/reports/reports-page";
import { StoresPage } from "@/features/stores/stores-page";
import { HistoryPage } from "@/features/history/history-page";
import { Button } from "@/components/ui/button";
import { homeForRole, type Role, type SessionUser } from "@/features/auth/session";

function Guard({ roles }: { roles: Role[] }) {
  const session = useSession();
  if (session.isPending) return <main className="grid min-h-svh place-items-center text-sm text-slate-300">Verificando sessão…</main>;
  if (session.isError) return <main className="grid min-h-svh place-items-center gap-3 p-5">
    <p role="alert">Não foi possível verificar sua sessão.</p>
    <Button onClick={() => void session.refetch()}>Tentar novamente</Button>
  </main>;
  if (!session.data) return <Navigate to="/login" replace />;
  if (!roles.includes(session.data.papel)) return <Navigate to={homeForRole(session.data.papel)} replace />;
  return <Outlet context={session.data} />;
}

function LayoutRoute() {
  const session = useSession();
  // O Guard garante que o papel foi validado antes de renderizar a estrutura.
  return session.data ? <AppLayout user={session.data} /> : null;
}

function Page({ title, description }: { title: string; description: string }) {
  return <PlaceholderPage title={title} description={description} />;
}

function UnknownRoute() {
  const session = useSession();
  if (session.isPending) return <main className="grid min-h-svh place-items-center">Verificando sessão…</main>;
  return <Navigate to={session.data ? homeForRole(session.data.papel) : "/login"} replace />;
}

export function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<Guard roles={["admin", "visualizador"]} />}>
      <Route element={<LayoutRoute />}>
        <Route path="/admin" element={<ReceivingPage />} />
        <Route path="/admin/reports" element={<ReportsPage />} />
      </Route>
    </Route>
    <Route element={<Guard roles={["admin"]} />}>
      <Route element={<LayoutRoute />}>
        <Route path="/admin/history" element={<HistoryPage />} />
        <Route path="/admin/import" element={<ImportPage />} />
        <Route path="/admin/stores" element={<StoresPage />} />
        <Route path="/admin/users" element={<Page title="Usuários" description="Perfis, acesso e auditoria." />} />
        <Route path="/admin/diagnostics" element={<Page title="Logs e Auditoria" description="Diagnósticos e eventos do sistema." />} />
      </Route>
    </Route>
    <Route element={<Guard roles={["conferente"]} />}>
      <Route element={<LayoutRoute />}>
        <Route path="/app" element={<ConferencePage />} />
        <Route path="/app/tags" element={<TagsPage />} />
      </Route>
    </Route>
    <Route path="*" element={<UnknownRoute />} />
  </Routes>;
}

// Mantém o contrato explícito dos três papéis durante a substituição do runtime.
export type AuthenticatedUser = SessionUser;
