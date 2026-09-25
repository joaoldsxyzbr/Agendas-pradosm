import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserEditDialog } from "../../src/admin/UserEditDialog";
import { UsersPage } from "../../src/admin/UsersPage";
import { ApiError, apiFetch } from "../../src/lib/api";

vi.mock("../../src/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/api")>(
    "../../src/lib/api",
  );
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(apiFetch);

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  nome: "Conferente",
  login: "conferente",
  perfil: "loja" as const,
  lojaId: "22222222-2222-4222-8222-222222222222",
  ativo: true,
};

const stores = [
  {
    id: user.lojaId,
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

    expect(await screen.findByText("Conferente")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir usuário" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar exclusão" }),
    );

    await waitFor(() =>
      expect(screen.queryByText("Conferente")).not.toBeInTheDocument(),
    );
  });
});
