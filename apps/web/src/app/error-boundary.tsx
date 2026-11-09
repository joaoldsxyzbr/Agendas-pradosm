import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { reportBrowserException } from "@/lib/api";

// Um erro de renderização não derruba mais a árvore inteira: a operação
// recupera com um recarregamento e o episódio vai para os diagnósticos,
// no mesmo contrato do endpoint que o front legado já usava.
type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { hasError: boolean };

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error("Erro de renderizacao nao tratado", error instanceof Error ? { type: error.name } : { type: "Error" });
    reportBrowserException();
  }

  override render() {
    if (!this.state.hasError) return this.props.children;
    return <main role="alert" className="grid min-h-svh place-items-center gap-3 p-5 text-center">
      <p className="text-base font-bold text-white">Algo saiu do previsto nesta tela.</p>
      <p className="text-sm text-slate-400">O erro foi registrado. Recarregue para voltar à operação.</p>
      <Button onClick={() => window.location.reload()}>Recarregar</Button>
    </main>;
  }
}
