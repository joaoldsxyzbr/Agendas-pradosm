import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminLayout } from "../../src/admin/AdminLayout";
import { DashboardPage } from "../../src/admin/DashboardPage";
import { ThemeProvider } from "../../src/theme/ThemeProvider";

vi.mock("../../src/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: {
      id: "admin-test",
      nome: "Administrador",
      perfil: "admin",
      lojaId: null,
    },
    logout: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("navegação administrativa", () => {
  it("remove Importar da navegação lateral e mobile", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <ThemeProvider>
          <Routes>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<span>Conteúdo</span>} />
            </Route>
          </Routes>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("link", { name: "Importar" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(8);
  });

  it("abre Importar agenda em modal no Dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: "Importar agenda" });
    expect(button).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Importar agenda" }),
    ).not.toBeInTheDocument();

    fireEvent.click(button);

    expect(
      await screen.findByRole("dialog", { name: "Importar agenda" }),
    ).toBeInTheDocument();
  });
});
