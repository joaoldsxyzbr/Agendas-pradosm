import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserEditDialog } from "../../src/admin/UserEditDialog";
import { UsersPage } from "../../src/admin/UsersPage";
import type { AdminUser } from "../../src/admin/types";
import { ApiError, apiFetch } from "../../src/lib/api";

vi.mock("../../src/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/api")>(
    "../../src/lib/api",
  );
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(apiFetch);

const user: AdminUser = {
  id: "11111111-1111-4111-8111-111111111111",
  nome: "Conferente",
  login: "conferente",
    papel: "conferente" as const,
  lojaId: "22222222-2222-4222-8222-222222222222",
  ativo: true,
};

const stores = [
  {
    id: user.lojaId!,
    codigo: "F03",
    nome: "Canasvieiras",
    ativo: true,
  },
];

afterEach(() => {
  cleanup();
  mockedApiFetch.mockReset();
});

function renderDialog(overrides: Partial<{
  onClose: () => void;
  onSaved: (value: typeof user) => void;
  onDeleted: (id: string) => void;
}> = {}) {
  render(
    <UserEditDialog
      user={user}
      stores={stores}
      onClose={overrides.onClose ?? vi.fn()}
      onSaved={overrides.onSaved ?? vi.fn()}
      onDeleted={overrides.onDeleted ?? vi.fn()}
    />,
  );
}

describe("gerenciamento de usuários", () => {
  it("omite senha vazia no PATCH", async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ...user,
      nome: "Conferente Atualizado",
    });
    renderDialog();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Conferente Atualizado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledTimes(1));
    const init = mockedApiFetch.mock.calls[0][1];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("senha");
  });

  it("envia nova senha quando preenchida", async () => {
    mockedApiFetch.mockResolvedValueOnce(user);
    renderDialog();

    fireEvent.change(screen.getByLabelText("Nova senha (opcional)"), {
      target: { value: "nova-senha-segura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledTimes(1));
    const init = mockedApiFetch.mock.calls[0][1];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.senha).toBe("nova-senha-segura");
  });

  it("exibe erro amigável para login duplicado", async () => {
    mockedApiFetch.mockRejectedValueOnce(
      new ApiError(409, "LOGIN_EM_USO", "Login já está em uso."),
    );
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Login já está em uso.",
    );
  });


  it("consulta histórico de auditoria do usuário sob demanda", async () => {
    mockedApiFetch.mockResolvedValueOnce([
      {
        id: "audit-user-1",
        action: "usuario_atualizado",
        entity: "usuario",
        entityId: user.id,
        storeId: user.lojaId,
        agendaId: null,
        appointmentId: null,
        before: { nome: "Antigo" },
        after: { nome: "Conferente" },
        details: "Usuário de loja atualizado.",
        createdAt: "2026-09-27T20:00:00.000Z",
        user: { id: "admin-1", name: "Administrador" },
      },
    ]);

    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Ver histórico" }));

    expect(
      await screen.findByText("Usuário atualizado"),
    ).toBeInTheDocument();
    expect(mockedApiFetch).toHaveBeenCalledWith(
      `/api/admin/audit?entity=usuario&entityId=${user.id}`,
    );
  });

  it("só exclui após confirmação explícita", async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);
    const onDeleted = vi.fn();
    renderDialog({ onDeleted });

    fireEvent.click(screen.getByRole("button", { name: "Excluir usuário" }));
    expect(mockedApiFetch).not.toHaveBeenCalled();
    expect(screen.getByText("Excluir Conferente?")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar exclusão" }),
    );

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenCalledWith(
        `/api/admin/users/${user.id}`,
        { method: "DELETE" },
      ),
    );
    expect(onDeleted).toHaveBeenCalledWith(user.id);
  });

  it("remove o usuário da listagem logo após exclusão", async () => {
    mockedApiFetch.mockImplementation((url, init = {}) => {
      if (url === "/api/admin/users" && !init.method) {
        return Promise.resolve([user]) as ReturnType<typeof apiFetch>;
      }
      if (url === "/api/admin/stores" && !init.method) {
        return Promise.resolve(stores) as ReturnType<typeof apiFetch>;
      }
      if (
        url === `/api/admin/users/${user.id}` &&
        init.method === "DELETE"
      ) {
        return Promise.resolve(undefined) as ReturnType<typeof apiFetch>;
      }
      return Promise.reject(new Error("chamada inesperada"));
    });

    render(<UsersPage />);

    expect(await screen.findByText(user.login)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir usuário" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar exclusão" }),
    );

    await waitFor(() =>
      expect(screen.queryByText(user.login)).not.toBeInTheDocument(),
    );
  });
  it("usa uma única lista com papel e loja condicional", async () => {
    const admin = {
      ...user,
      id: "33333333-3333-4333-8333-333333333333",
      nome: "Admin Principal",
      login: "administrador",
      papel: "admin" as const,
      lojaId: null,
    };
    const viewer = {
      ...user,
      id: "44444444-4444-4444-8444-444444444444",
      nome: "Visualizador Operação",
      login: "visualizador",
      papel: "visualizador" as const,
      lojaId: null,
    };

    mockedApiFetch.mockImplementation((url, init = {}) => {
      if (url === "/api/admin/users" && !init.method) {
        return Promise.resolve([admin, user, viewer]) as ReturnType<typeof apiFetch>;
      }
      if (url === "/api/admin/stores" && !init.method) {
        return Promise.resolve(stores) as ReturnType<typeof apiFetch>;
      }
      return Promise.reject(new Error("chamada inesperada"));
    });

    render(<UsersPage />);

    expect(await screen.findByText("Admin Principal")).toBeInTheDocument();
    expect(screen.getByText("Visualizador Operação")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Papel" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Novo usuário" }));
    expect(screen.getByLabelText("Papel")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Visualizadores do dashboard" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Papel"), {
      target: { value: "visualizador" },
    });
    expect(screen.queryByLabelText("Loja")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Papel"), {
      target: { value: "conferente" },
    });
    expect(screen.getByLabelText("Loja")).toBeRequired();
  });


});
