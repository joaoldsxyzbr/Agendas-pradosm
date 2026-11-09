import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppErrorBoundary } from "./app/error-boundary";
import { AppRoutes } from "./app/routes";
import "./styles/globals.css";

// Com a UI legado removida, o fallback SPA do Workers serve o index.html do
// React para qualquer caminho, e o BrowserRouter atende os links diretos.
const Router = BrowserRouter;

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 0, refetchOnWindowFocus: false } },
});
const root = document.getElementById("root");
if (!root) throw new Error("Elemento raiz nao localizado");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppErrorBoundary>
          <AppRoutes />
        </AppErrorBoundary>
      </Router>
    </QueryClientProvider>
  </StrictMode>,
);
