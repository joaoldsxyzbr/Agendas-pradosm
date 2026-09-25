import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StoreEditDialog } from "../../src/admin/StoreEditDialog";
import { StoresPage } from "../../src/admin/StoresPage";
import { ApiError, apiFetch } from "../../src/lib/api";

vi.mock("../../src/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/api")>(
    "../../src/lib/api",
  );
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(apiFetch);

const store = {
  id: "33333333-3333-4333-8333-333333333333",
  codigo: "F03",
  nome: "Canasvieiras",
  ativo: true,
};

afterEach(() => {
  cleanup();
  mockedApiFetch.mockReset();
});

function renderDialog(overrides: Partial<{
  onClose: () => void;
  onSaved: (value: typeof store) => void;
  onDeleted: (id: string) => void;
}> = {}) {
  render(
    <StoreEditDialog
      store={store}
      onClose={overrides.onClose ?? vi.fn()}
      onSaved={overrides.onSaved ?? vi.fn()}
      onDeleted={overrides.onDeleted ?? vi.fn()}
    />,
  );
}

describe("gerenciamento de lojas", () => {
  it("salva código, nome e status no mesmo modal", async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ...store,
      codigo: "F13",
      nome: "Canasvieiras Norte",
      ativo: false,
    });
    renderDialog();

    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "f13" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Canasvieiras Norte" },
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "inativo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/admin/stores",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            id: store.id,
            codigo: "F13",
            nome: "Canasvieiras Norte",
            ativo: false,
          }),
        }),
      ),
    );
  });

  it("só exclui a loja após confirmação explícita", async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);
    const onDeleted = vi.fn();
    renderDialog({ onDeleted });

    fireEvent.click(screen.getByRole("button", { name: "Excluir loja" }));
    expect(mockedApiFetch).not.toHaveBeenCalled();
    expect(screen.getByText("Excluir F03 - Canasvieiras?")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar exclusão" }),
    );

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenCalledWith(
        `/api/admin/stores/${store.id}`,
        { method: "DELETE" },
      ),
    );
    expect(onDeleted).toHaveBeenCalledWith(store.id);
  });

  it("explica quando a loja ainda possui usuários vinculados", async () => {
    mockedApiFetch.mockRejectedValueOnce(
      new ApiError(
        409,
        "LOJA_POSSUI_USUARIOS",
        "Mova ou exclua os usuários vinculados antes de excluir a loja.",
      ),
    );
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Excluir loja" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar exclusão" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Mova ou exclua os usuários vinculados antes de excluir a loja.",
    );
  });

  it("usa Editar na listagem e remove a loja logo após exclusão", async () => {
    mockedApiFetch.mockImplementation((url, init = {}) => {
      if (url === "/api/admin/stores" && !init.method) {
        return Promise.resolve([store]) as ReturnType<typeof apiFetch>;
      }
      if (
        url === `/api/admin/stores/${store.id}` &&
        init.method === "DELETE"
      ) {
        return Promise.resolve(undefined) as ReturnType<typeof apiFetch>;
      }
      return Promise.reject(new Error("chamada inesperada"));
    });

    render(<StoresPage />);

    expect(await screen.findByText("Canasvieiras")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir loja" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar exclusão" }),
    );

    await waitFor(() =>
      expect(screen.queryByText("Canasvieiras")).not.toBeInTheDocument(),
    );
  });
});
