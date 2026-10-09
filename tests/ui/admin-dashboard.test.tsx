import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../../src/admin/DashboardPage";

const mockedTime = vi.hoisted(() => ({
  businessDate: "2026-09-30",
}));

vi.mock("../../shared/time", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../shared/time")>();
  return {
    ...original,
    businessDate: () => mockedTime.businessDate,
  };
});

function json(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  mockedTime.businessDate = "2026-09-30";
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("dashboard operacional", () => {
  it("acompanha a virada da data operacional quando estava em hoje", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/stores") return json([]);
      if (url === "/api/admin/presence") return json([]);
      if (url.startsWith("/api/admin/agendas?date=")) return json([]);
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await screen.findByText("Nenhuma loja com conferente ativo.");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/agendas?date=2026-09-30",
      expect.objectContaining({ credentials: "include" }),
    );

    mockedTime.businessDate = "2026-10-01";
    window.dispatchEvent(new Event("focus"));

    await screen.findByText("Nenhuma loja com conferente ativo.");
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/agendas?date=2026-10-01",
        expect.objectContaining({ credentials: "include" }),
      ),
    );
  });

  it("mostra a operação por loja sem resumo geral", async () => {
    const stores = [
      { id: "s1", codigo: "F03", nome: "Canasvieiras", ativo: true },
      { id: "s2", codigo: "F04", nome: "Centro", ativo: true },
      { id: "s3", codigo: "F05", nome: "Porto Belo", ativo: true },
    ];
    const presences = [
      {
        storeId: "s1",
        status: "online",
        lastInteractionAt: "2026-09-30T12:00:00.000Z",
        lastSeenAt: "2026-09-30T12:00:00.000Z",
      },
      {
        storeId: "s2",
        status: "away",
        lastInteractionAt: "2026-09-30T11:55:00.000Z",
        lastSeenAt: "2026-09-30T12:00:00.000Z",
      },
    ];

    const agendas = [
      {
        id: "a1",
        storeCode: "F03",
        storeName: "Canasvieiras",
        date: "2026-09-25",
        total: 5,
        aguardando: 2,
        recebido: 2,
        naoChegou: 1,
        recusado: 0,
        semAgenda: 1,
      },
      {
        id: "a2",
        storeCode: "F04",
        storeName: "Centro",
        date: "2026-09-25",
        total: 3,
        aguardando: 0,
        recebido: 3,
        naoChegou: 0,
        recusado: 0,
        semAgenda: 0,
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/stores") return json(stores);
      if (url === "/api/admin/presence") return json(presences);
      if (url.startsWith("/api/admin/agendas?date=")) return json(agendas);
      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("region", { name: "Resumo operacional" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("region", { name: "Atenção agora" }),
    ).not.toBeInTheDocument();

    const f03Card = await screen.findByTestId("dashboard-store-F03");
    const f04Card = screen.getByTestId("dashboard-store-F04");
    const f05Card = screen.getByTestId("dashboard-store-F05");

    expect(within(f03Card).getByText("2 / 5")).toBeInTheDocument();
    expect(within(f03Card).getByText("1 sem agenda")).toBeInTheDocument();
    expect(
      within(f03Card).getByLabelText("Conferente online"),
    ).toHaveClass("online");
    expect(
      within(f04Card).getByLabelText("Conferente ausente"),
    ).toHaveClass("away");
    expect(
      within(f05Card).getByLabelText("Conferente offline"),
    ).toHaveClass("offline");

    expect(
      screen.getByRole("button", { name: "Data da agenda" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Data da agenda" }));
    fireEvent.click(
      screen.getByRole("button", { name: "25 de setembro de 2026" }),
    );

    await screen.findByTestId("dashboard-store-F03");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/agendas?date=2026-09-25",
      expect.objectContaining({ credentials: "include" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Importar agenda" }));
    expect(screen.getByRole("dialog", { name: "Importar agenda" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(
      screen.queryByRole("dialog", { name: "Importar agenda" }),
    ).not.toBeInTheDocument();
  });


  it("protege a agenda e permite ao ADM editar e adicionar fornecedor manual após ativar o modo edição", async () => {
    const stores = [
      { id: "s1", codigo: "F03", nome: "Canasvieiras", ativo: true },
    ];
    const agendas = [
      {
        id: "a1",
        storeCode: "F03",
        storeName: "Canasvieiras",
        date: "2026-09-28",
        total: 2,
        aguardando: 1,
        recebido: 1,
        naoChegou: 0,
        recusado: 0,
        semAgenda: 0,
        dayStatus: "aberto",
        completedAt: null,
        completedBy: null,
      },
    ];
    const detail = {
      agenda: {
        id: "a1",
        storeCode: "F03",
        storeName: "Canasvieiras",
        date: "2026-09-28",
        dayStatus: "aberto",
        completedAt: null,
        completedBy: null,
      },
      appointments: [
        {
          id: "ap1",
          protocol: "12345",
          startTime: "08:00",
          endTime: "09:00",
          supplier: "Fornecedor Teste",
          items: 4,
          volumes: 10,
          pallets: 1,
          cargaBatida: null,
          type: "Normal",
          nfe: [],
          orders: [],
          status: "aguardando",
          hasExchanges: false,
          origin: "imported",
          ativo: true,
        },
        {
          id: "ap2",
          protocol: "67890",
          startTime: "09:00",
          endTime: "10:00",
          supplier: "Fornecedor Recebido",
          items: 2,
          volumes: 3,
          pallets: 0,
          cargaBatida: null,
          type: "Normal",
          nfe: [],
          orders: [],
          status: "recebido",
          hasExchanges: true,
          origin: "imported",
          ativo: true,
        },
      ],
    };

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/admin/stores") return json(stores);
        if (url === "/api/admin/presence") return json([]);
        if (url.startsWith("/api/admin/agendas?date=")) return json(agendas);
        if (url === "/api/admin/agendas/a1" && !init?.method) return json(detail);
        if (
          url === "/api/admin/appointments/ap1/status" &&
          init?.method === "PATCH"
        ) {
          return json({ ...detail.appointments[0], status: "recebido" });
        }
        if (
          url === "/api/admin/appointments/ap1/exchanges" &&
          init?.method === "PATCH"
        ) {
          return json({ ...detail.appointments[0], hasExchanges: true });
        }
        if (
          url === "/api/admin/appointments/manual-1/manual" &&
          init?.method === "DELETE"
        ) {
          return new Response(null, { status: 204 });
        }
        if (
          url === "/api/admin/agendas/a1/manual" &&
          init?.method === "POST"
        ) {
          return json({
            id: "manual-1",
            protocol: "Sem agenda",
            startTime: "11:30",
            endTime: "11:30",
            supplier: "Fornecedor Extra",
            items: null,
            volumes: null,
            pallets: null,
            cargaBatida: null,
            type: "Sem agenda",
            nfe: [],
            orders: [],
            status: "aguardando",
            hasExchanges: false,
            origin: "manual",
            ativo: true,
          });
        }
        return new Response(null, { status: 404 });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const card = await screen.findByTestId("dashboard-store-F03");
    fireEvent.click(
      within(card).getByRole("button", { name: "Ver detalhes" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Agenda F03 - Canasvieiras",
    });
    expect(within(dialog).getByText("Somente leitura")).toBeInTheDocument();
    expect(within(dialog).getByRole("cell", { name: "Fornecedor Teste" })).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Recebido" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "+ Fornecedor sem agenda" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Editar agenda" }),
    );
    expect(within(dialog).getByText("Modo edição")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Sair da edição" }),
    ).toHaveAttribute("aria-pressed", "true");

    const desktopRows = within(dialog).getAllByTestId("agenda-desktop-row");
    expect(within(desktopRows[0]).getByRole("checkbox", { name: "Trocas" })).not.toBeChecked();
    expect(within(desktopRows[1]).getByRole("checkbox", { name: "Trocas" })).toBeChecked();

    fireEvent.click(
      within(desktopRows[0]).getByRole("button", { name: "Recebido" }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/appointments/ap1/status",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "recebido" }),
          credentials: "include",
        }),
      ),
    );

    fireEvent.click(
      within(desktopRows[0]).getByRole("checkbox", { name: "Trocas" }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/appointments/ap1/exchanges",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ hasExchanges: true }),
          credentials: "include",
        }),
      ),
    );

    fireEvent.click(
      within(dialog).getByRole("button", { name: "+ Fornecedor sem agenda" }),
    );
    const manualDialog = await screen.findByRole("dialog", {
      name: "Fornecedor sem agenda",
    });
    fireEvent.change(
      within(manualDialog).getByRole("textbox", { name: "Nome do fornecedor" }),
      { target: { value: "Fornecedor Extra" } },
    );
    fireEvent.click(
      within(manualDialog).getByRole("button", { name: "Adicionar" }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/agendas/a1/manual",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ supplier: "Fornecedor Extra" }),
          credentials: "include",
        }),
      ),
    );
    expect(
      await within(dialog).findByRole("cell", { name: "Fornecedor Extra" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getAllByRole("button", {
        name: "Excluir fornecedor Fornecedor Extra",
      })[0],
    );
    const deleteDialog = await screen.findByRole("dialog", {
      name: "Excluir fornecedor",
    });
    expect(
      within(deleteDialog).getByText("Fornecedor Extra"),
    ).toBeInTheDocument();
    fireEvent.click(
      within(deleteDialog).getByRole("button", {
        name: "Excluir fornecedor",
      }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/appointments/manual-1/manual",
        expect.objectContaining({
          method: "DELETE",
          credentials: "include",
        }),
      ),
    );
    await waitFor(() =>
      expect(
        within(dialog).queryByRole("cell", { name: "Fornecedor Extra" }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Sair da edição" }),
    );
    expect(within(dialog).getByText("Somente leitura")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Recebido" }),
    ).not.toBeInTheDocument();

    expect(
      within(dialog).queryByRole("button", { name: "Concluir dia" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/agendas/a1",
      expect.objectContaining({ credentials: "include" }),
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(
      screen.queryByRole("dialog", { name: "Agenda F03 - Canasvieiras" }),
    ).not.toBeInTheDocument();
  });


  it("reabre uma agenda concluída pelo preview do dashboard", async () => {
    const stores = [
      { id: "s1", codigo: "F05", nome: "Pagani", ativo: true },
    ];
    const agendas = [
      {
        id: "a5",
        storeCode: "F05",
        storeName: "Pagani",
        date: "2026-09-29",
        total: 1,
        aguardando: 0,
        recebido: 1,
        naoChegou: 0,
        recusado: 0,
        semAgenda: 0,
        dayStatus: "concluido",
        completedAt: "2026-09-29T18:00:00.000Z",
        completedBy: { id: "u1", name: "Conferente" },
      },
    ];
    const detail = {
      agenda: agendas[0],
      appointments: [
        {
          id: "ap5",
          protocol: "11713967",
          startTime: "08:00",
          endTime: "08:10",
          supplier: "Distribuidora Muller Com. e Repres. Ltda",
          items: 1,
          volumes: 1,
          pallets: 0,
          cargaBatida: null,
          type: "Nota fiscal",
          nfe: [],
          orders: [],
          status: "recebido",
          hasExchanges: false,
          origin: "imported",
          ativo: true,
        },
      ],
    };

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/admin/stores") return json(stores);
        if (url === "/api/admin/presence") return json([]);
        if (url.startsWith("/api/admin/agendas?date=")) return json(agendas);
        if (url === "/api/admin/agendas/a5" && !init?.method) {
          return json(detail);
        }
        if (
          url === "/api/admin/agendas/a5/status" &&
          init?.method === "PATCH"
        ) {
          return json({
            ...detail.agenda,
            dayStatus: "aberto",
            completedAt: null,
            completedBy: null,
          });
        }
        return new Response(null, { status: 404 });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const card = await screen.findByTestId("dashboard-store-F05");
    fireEvent.click(
      within(card).getByRole("button", { name: "Ver detalhes" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Agenda F05 - Pagani",
    });
    expect(
      within(dialog).queryByRole("button", {
        name: "Reabrir para conferente",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Editar agenda" }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Reabrir para conferente",
      }),
    );

    expect(await within(dialog).findByText("Em andamento")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", {
        name: "Reabrir para conferente",
      }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/agendas/a5/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "aberto" }),
        credentials: "include",
      }),
    );
  });

  it("oculta lojas sem conferente ativo, mesmo com agenda importada", async () => {
    const stores = [
      { id: "s1", codigo: "F03", nome: "Loja ativa", ativo: true, temConferenteAtivo: true },
      { id: "s2", codigo: "F04", nome: "Loja com usuário desativado", ativo: true, temConferenteAtivo: false },
      { id: "s3", codigo: "F05", nome: "Loja desativada", ativo: false, temConferenteAtivo: true },
    ];
    const agendas = [
      { id: "a2", storeCode: "F04", date: "2026-09-30", total: 3, recebido: 0,
        aguardando: 3, naoChegou: 0, recusado: 0, semAgenda: 0 },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/stores") return json(stores);
      if (url === "/api/admin/presence") return json([]);
      if (url.startsWith("/api/admin/agendas?date=")) return json(agendas);
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    await screen.findByTestId("dashboard-store-F03");
    expect(screen.queryByTestId("dashboard-store-F04")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-store-F05")).not.toBeInTheDocument();
    const summary = screen.getByLabelText("Situação do dia");
    expect(
      [...summary.querySelectorAll("strong")].map((value) => value.textContent),
    ).toEqual(["1", "0", "0", "0", "1"]);
  });

});
