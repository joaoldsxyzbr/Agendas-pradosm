import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRoutes } from "./app/routes";
import "./styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 0, refetchOnWindowFocus: false } },
});
const root = document.getElementById("root");
if (!root) throw new Error("Elemento raiz nao localizado");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><AppRoutes /></BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
