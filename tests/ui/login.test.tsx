import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../src/App";
import { AuthProvider } from "../../src/auth/AuthProvider";

type User = {
  id: string;
  nome: string;
  perfil: "admin" | "loja";
  lojaId: string | null;
};

function jsonResponse(status: number, body?: unknown) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers:
        body === undefined
          ? undefined
          : { "Content-Type": "application/json" },
    }),
  );
}

function renderApp(initialPath = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function mockSession(user: User | null) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url === "/api/auth/me" && method === "GET") {
      if (!user) {
        return jsonResponse(401, {
          error: "NAO_AUTENTICADO",
          message: "Sessão inválida ou expirada.",
        });
      }
      return jsonResponse(200, user);
    }

    return jsonResponse(404, { error: "NAO_ENCONTRADO" });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockLogin(user: User | null) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url === "/api/auth/me" && method === "GET") {
      return jsonResponse(401, {
        error: "NAO_AUTENTICADO",
        message: "Sessão inválida ou expirada.",
      });
    }

    if (url === "/api/auth/login" && method === "POST") {
      if (!user) {
        return jsonResponse(401, {
          error: "CREDENCIAIS_INVALIDAS",
          message: "Login ou senha inválidos.",
        });
      }
      return jsonResponse(200, user);
    }

    if (url === "/api/auth/logout" && method === "POST") {
      return jsonResponse(204);
    }

    return jsonResponse(404, { error: "NAO_ENCONTRADO" });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("login e rotas protegidas", () => {
  it("mostra campos de login e senha", async () => {
    mockSession(null);
    renderApp();

    expect(await screen.findByLabelText("Login")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("mostra mensagem neutra quando as credenciais são inválidas", async () => {
    mockLogin(null);
    renderApp();

    fireEvent.change(await screen.findByLabelText("Login"), {
      target: { value: "usuario-teste" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-incorreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByText("Login ou senha inválidos."),
    ).toBeInTheDocument();
  });

  it("envia admin para /admin após login", async () => {
    mockLogin({
      id: "admin-1",
      nome: "Administrador",
      perfil: "admin",
      lojaId: null,
    });
    renderApp();

    fireEvent.change(await screen.findByLabelText("Login"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-segura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("envia usuário de loja para /app após login", async () => {
    mockLogin({
      id: "loja-1",
      nome: "Conferente",
      perfil: "loja",
      lojaId: "store-1",
    });
    renderApp();

    fireEvent.change(await screen.findByLabelText("Login"), {
      target: { value: "loja" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-segura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByRole("heading", { name: "Agenda de hoje" }),
    ).toBeInTheDocument();
  });

  it("redireciona perfil incorreto sem renderizar conteúdo protegido", async () => {
    mockSession({
      id: "admin-2",
      nome: "Administrador",
      perfil: "admin",
      lojaId: null,
    });

    renderApp("/app");

    expect(
      await screen.findByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Agenda de hoje" }),
      ).not.toBeInTheDocument();
    });
  });
});
