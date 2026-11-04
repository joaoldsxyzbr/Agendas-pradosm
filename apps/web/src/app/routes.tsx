import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router";
import { AppLayout } from "./layouts";
import { useSession } from "./session-query";
// Cada área é carregada quando a rota é visitada. Evita transferir relatórios,
// exportação e conferência para quem utiliza somente outra área do sistema.
const LoginPage = lazy(() => import("@/features/auth/login-page").then(m => ({ default: m.LoginPage })));
const AgendasPage = lazy(() => import("@/features/agendas/agendas-page").then(m => ({ default: m.AgendasPage })));
const ImportPage = lazy(() => import("@/features/import/import-page").then(m => ({ default: m.ImportPage })));
const ReceivingPage = lazy(() => import("@/features/receiving/receiving-page").then(m => ({ default: m.ReceivingPage })));
const ConferencePage = lazy(() => import("@/features/conference/conference-page").then(m => ({ default: m.ConferencePage })));
const ReportsPage = lazy(() => import("@/features/reports/reports-page").then(m => ({ default: m.ReportsPage })));
const StoresPage = lazy(() => import("@/features/stores/stores-page").then(m => ({ default: m.StoresPage })));
const HistoryPage = lazy(() => import("@/features/history/history-page").then(m => ({ default: m.HistoryPage })));
const UsersPage = lazy(() => import("@/features/users/users-page").then(m => ({ default: m.UsersPage })));
const DiagnosticsPage = lazy(() => import("@/features/diagnostics/diagnostics-page").then(m => ({ default: m.DiagnosticsPage })));
import { Button } from "@/components/ui/button";
import { homeForRole, type Role, type SessionUser } from "@/features/auth/session";

// O Suspense fica dentro do Outlet: o menu permanece visível enquanto a tela carrega.
function DeferredPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main role="status" className="p-5 text-sm text-slate-300">Carregando tela…</main>}>{children}</Suspense>;
}

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

function UnknownRoute() {
  const session = useSession();
  if (session.isPending) return <main className="grid min-h-svh place-items-center">Verificando sessão…</main>;
  return <Navigate to={session.data ? homeForRole(session.data.papel) : "/login"} replace />;
}

export function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<DeferredPage><LoginPage /></DeferredPage>} />
    <Route element={<Guard roles={["admin", "visualizador"]} />}>
      <Route element={<LayoutRoute />}>
        <Route path="/admin" element={<DeferredPage><ReceivingPage /></DeferredPage>} />
        <Route path="/admin/reports" element={<DeferredPage><ReportsPage /></DeferredPage>} />
      </Route>
    </Route>
    <Route element={<Guard roles={["admin"]} />}>
      <Route element={<LayoutRoute />}>
        <Route path="/admin/agendas" element={<DeferredPage><AgendasPage /></DeferredPage>} />
        <Route path="/admin/import" element={<DeferredPage><ImportPage /></DeferredPage>} />
        <Route path="/admin/history" element={<DeferredPage><HistoryPage /></DeferredPage>} />
        <Route path="/admin/stores" element={<DeferredPage><StoresPage /></DeferredPage>} />
        <Route path="/admin/users" element={<DeferredPage><UsersPage /></DeferredPage>} />
        <Route path="/admin/diagnostics" element={<DeferredPage><DiagnosticsPage /></DeferredPage>} />
      </Route>
    </Route>
    <Route element={<Guard roles={["conferente"]} />}>
      <Route element={<LayoutRoute />}>
        <Route path="/app" element={<DeferredPage><ConferencePage /></DeferredPage>} />
      </Route>
    </Route>
    <Route path="*" element={<UnknownRoute />} />
  </Routes>;
}

// Mantém o contrato explícito dos três papéis durante a substituição do runtime.
export type AuthenticatedUser = SessionUser;
