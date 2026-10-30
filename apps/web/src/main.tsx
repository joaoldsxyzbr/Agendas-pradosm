import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRoutes } from "./app/routes";
import "./styles/globals.css";

// HashRouter na Preview evita que links profundos caiam no index.html legado.
// O desenvolvimento Vite local continua com BrowserRouter e as rotas originais.
const Router = import.meta.env.BASE_URL === "/modern/" ? HashRouter : BrowserRouter;

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 0, refetchOnWindowFocus: false } },
});
const root = document.getElementById("root");
if (!root) throw new Error("Elemento raiz nao localizado");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router><AppRoutes /></Router>
    </QueryClientProvider>
  </StrictMode>,
);
