import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TodayPage } from "../../src/agenda/TodayPage";

type AppointmentStatus =
  | "aguardando"
  | "recebido"
  | "nao_chegou"
  | "recusado";

function appointment(
  id: string,
  startTime: string,
  status: AppointmentStatus = "aguardando",
) {
  return {
    id,
    protocol: id.replace("appt-", "9000"),
    startTime,
    endTime: startTime === "08:00" ? "08:10" : "10:10",
    supplier: `Fornecedor ${id}`,
    items: 10,
    volumes: 5,
    pallets: 1,
    cargaBatida: null,
    type: "Pedido",
    nfe: ["123456"],
    orders: ["50001"],
    status,
    hasExchanges: false,
    ativo: true,
  };
}

function agendaBody(appointments = [
  appointment("appt-late", "10:00", "recebido"),
  appointment("appt-early", "08:00", "aguardando"),
  appointment("appt-missed", "09:00", "nao_chegou"),
  appointment("appt-refused", "09:30", "recusado"),
]) {
  return {
    agenda: {
      id: "agenda-1",
      storeCode: "F03",
      storeName: "LOJA 03",
      date: "2026-09-24",
      originalFileName: "agenda.pdf",
      dayStatus: "aberto",
      completedAt: null,
      completedBy: null,
    },
    appointments,
  };
}

function json(status: number, body?: unknown) {
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TodayPage", () => {
  it("mostra resumo, colunas essenciais e ordena por horário", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json(200, agendaBody())),
    );

    render(<TodayPage />);

    expect(await screen.findByText("4 agendamentos")).toBeInTheDocument();
    expect(screen.getByText("1 aguardando")).toBeInTheDocument();
    expect(screen.getByText("1 recebido")).toBeInTheDocument();
    expect(screen.getByText("1 não recebido")).toBeInTheDocument();
    expect(screen.getByText("1 recusado")).toBeInTheDocument();

    const exportButton = screen.getByRole("button", { name: "Exportar PDF" });
    expect(exportButton).toBeInTheDocument();
    expect(exportButton.closest("header")).not.toBeNull();

    const manualButton = screen.getByRole("button", {
      name: /Fornecedor sem agenda/,
    });
    expect(manualButton.closest(".agenda-toolbar")).not.toBeNull();
    expect(manualButton.closest("header")).toBeNull();

    expect(
      screen.getByRole("columnheader", { name: "Horário" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Fornecedor" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Protocolo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Status" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("columnheader", { name: "Ações" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Trocas" }),
    ).toBeInTheDocument();

    const desktopRows = screen.getAllByTestId("agenda-desktop-row");
    expect(within(desktopRows[0]).getByText("08:00 - 08:10")).toBeInTheDocument();
    expect(within(desktopRows[1]).getByText("09:00 - 10:10")).toBeInTheDocument();

    const firstRowCells = within(desktopRows[0]).getAllByRole("cell");
    expect(within(firstRowCells[4]).getByText("Aguardando")).toBeInTheDocument();
    expect(within(firstRowCells[4]).queryByRole("button")).not.toBeInTheDocument();
    expect(within(firstRowCells[5]).getByRole("button", { name: "Recebido" })).toBeInTheDocument();
    expect(within(firstRowCells[5]).getByRole("button", { name: "Não recebido" })).toBeInTheDocument();
    expect(within(firstRowCells[5]).queryByRole("button", { name: "Recusado" })).not.toBeInTheDocument();
    expect(within(firstRowCells[5]).queryByRole("button", { name: "Ver detalhes" })).not.toBeInTheDocument();
    expect(within(firstRowCells[6]).getByRole("checkbox", { name: "Trocas" })).not.toBeChecked();

    const mobileCard = screen.getAllByTestId("agenda-mobile-card")[0];
    expect(within(mobileCard).getByText("08:00 - 08:10")).toBeInTheDocument();
    expect(within(mobileCard).getByText("Fornecedor appt-early")).toBeInTheDocument();
    expect(within(mobileCard).getByText("9000early")).toBeInTheDocument();
    expect(within(mobileCard).getByText("Aguardando", { selector: ".store-status" })).toBeInTheDocument();
  });

  it("filtra a agenda por fornecedor ou protocolo enquanto digita", async () => {
    const alpha = {
      ...appointment("appt-alpha", "08:00"),
      supplier: "PAMPLONA ALIMENTOS S/A",
      protocol: "12458375",
    };
    const beta = {
      ...appointment("appt-beta", "09:00"),
      supplier: "GRANJA PINHEIROS LTDA",
      protocol: "12473312",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(() => json(200, agendaBody([alpha, beta]))),
    );

    render(<TodayPage />);

    const search = await screen.findByRole("searchbox", {
      name: "Pesquisar fornecedor ou protocolo",
    });

    fireEvent.change(search, { target: { value: "pamplona" } });
    expect(screen.getAllByTestId("agenda-desktop-row")).toHaveLength(1);
    expect(screen.getAllByTestId("agenda-mobile-card")).toHaveLength(1);
    expect(screen.getAllByText("PAMPLONA ALIMENTOS S/A").length).toBeGreaterThan(0);
    expect(screen.queryByText("GRANJA PINHEIROS LTDA")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "12473312" } });
    expect(screen.getAllByTestId("agenda-desktop-row")).toHaveLength(1);
    expect(screen.getAllByText("GRANJA PINHEIROS LTDA").length).toBeGreaterThan(0);
    expect(screen.queryByText("PAMPLONA ALIMENTOS S/A")).not.toBeInTheDocument();
  });

  it("adiciona fornecedor sem agenda informando apenas o nome", async () => {
    const manual = {
      ...appointment("appt-manual", "13:31"),
      protocol: "Sem agenda",
      supplier: "FORNECEDOR EXTRA LTDA",
      type: "Sem agenda",
      origin: "manual",
      endTime: "13:31",
    };

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => json(200, agendaBody([appointment("appt-base", "08:00")])))
      .mockImplementationOnce(() => json(201, manual));

    vi.stubGlobal("fetch", fetchMock);
    render(<TodayPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Fornecedor sem agenda/ }),
    );

    const input = screen.getByRole("textbox", { name: "Nome do fornecedor" });
    fireEvent.change(input, { target: { value: "FORNECEDOR EXTRA LTDA" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect((await screen.findAllByText("FORNECEDOR EXTRA LTDA")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sem agenda").length).toBeGreaterThan(0);
    expect(screen.getByText("2 agendamentos")).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/store/agenda/"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ supplier: "FORNECEDOR EXTRA LTDA" }),
      }),
    );
    expect(
      String(fetchMock.mock.calls[1]?.[0]),
    ).toMatch(/\/manual$/);
  });

  it("mostra estado vazio sem misturar agendas anteriores", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json(200, { agenda: null, appointments: [] })),
    );

    render(<TodayPage />);

    expect(
      await screen.findByText("Nenhuma agenda para hoje."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("agenda-desktop-row")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Fornecedor sem agenda/ }),
    ).not.toBeInTheDocument();
  });

  it("só atualiza status após resposta 2xx e permite correção posterior", async () => {
    let resolveFirst!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        json(200, agendaBody([appointment("appt-status", "08:00")])),
      )
      .mockImplementationOnce(() => pending)
      .mockImplementationOnce(() =>
        json(200, {
          ...appointment("appt-status", "08:00", "nao_chegou"),
        }),
      );

    vi.stubGlobal("fetch", fetchMock);
    render(<TodayPage />);

    const card = await screen.findByTestId("agenda-mobile-card");
    expect(within(card).getByText("Aguardando", { selector: ".store-status" })).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Aguardando" }),
    ).not.toBeInTheDocument();

    expect(within(card).getByRole("button", { name: "Recebido" })).toHaveTextContent("✓");
    expect(within(card).getByRole("button", { name: "Não recebido" })).toHaveTextContent("✕");
    expect(within(card).queryByRole("button", { name: "Recusado" })).not.toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Recebido" }));
    expect(within(card).getByText("Aguardando", { selector: ".store-status" })).toBeInTheDocument();

    resolveFirst(
      new Response(
        JSON.stringify({
          ...appointment("appt-status", "08:00", "recebido"),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    expect(await within(card).findByText("Recebido", { selector: ".store-status" })).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Não recebido" }));
    expect(await within(card).findByText("Não recebido", { selector: ".store-status" })).toBeInTheDocument();

    const calls = fetchMock.mock.calls
      .filter((call) => String(call[0]).includes("/status"));
    expect(calls).toHaveLength(2);
  });

  it("marca trocas sem alterar o status de chegada", async () => {
    const updated = {
      ...appointment("appt-exchanges", "08:00"),
      hasExchanges: true,
    };
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        json(200, agendaBody([appointment("appt-exchanges", "08:00")])),
      )
      .mockImplementationOnce(() => json(200, updated));

    vi.stubGlobal("fetch", fetchMock);
    render(<TodayPage />);

    const row = (await screen.findAllByTestId("agenda-desktop-row"))[0];
    const checkbox = within(row).getByRole("checkbox", { name: "Trocas" });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    await waitFor(() => expect(checkbox).toBeChecked());
    expect(within(row).getByText("Aguardando", { selector: ".store-status" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/store/appointments/appt-exchanges/exchanges",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ hasExchanges: true }),
      }),
    );
  });

  it("falha de status mantém valor anterior e mostra erro", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        json(200, agendaBody([appointment("appt-fail", "08:00")])),
      )
      .mockImplementationOnce(() =>
        json(500, {
          error: "ALTERACAO_STATUS_FALHOU",
          message: "O status não foi alterado.",
        }),
      );

    vi.stubGlobal("fetch", fetchMock);
    render(<TodayPage />);

    const card = await screen.findByTestId("agenda-mobile-card");
    fireEvent.click(within(card).getByRole("button", { name: "Não recebido" }));

    expect(
      await within(card).findByText("O status não foi alterado."),
    ).toBeInTheDocument();
    expect(within(card).getByText("Aguardando", { selector: ".store-status" })).toBeInTheDocument();
  });

  it("não mostra ação de detalhes na agenda de hoje", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        json(200, agendaBody([appointment("appt-detail", "08:00", "recebido")])),
      ),
    );

    render(<TodayPage />);

    await screen.findByTestId("agenda-mobile-card");
    expect(
      screen.queryByRole("button", { name: "Ver detalhes" }),
    ).not.toBeInTheDocument();
  });
});

describe("seletor de data da agenda", () => {
  it("abre um dia anterior na mesma tela e permite editar quando estiver aberto", async () => {
    const historical = {
      agenda: {
        id: "agenda-history-old",
        storeCode: "F03",
        storeName: "LOJA 03",
        date: "2026-09-24",
        originalFileName: "agenda.pdf",
        dayStatus: "aberto",
        completedAt: null,
        completedBy: null,
      },
      appointments: [
        {
          ...appointment("appt-history-old", "08:00", "nao_chegou"),
          supplier: "FORNECEDOR ANTIGO LTDA",
          protocol: "12000001",
        },
      ],
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/store/today") {
        return json(200, agendaBody([appointment("appt-today", "08:00")]));
      }
      if (url === "/api/store/history/2026-09-24") {
        return json(200, historical);
      }
      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<TodayPage />);

    await screen.findByRole("searchbox", {
      name: "Pesquisar fornecedor ou protocolo",
    });

    fireEvent.change(screen.getByLabelText("Data da agenda"), {
      target: { value: "2026-09-24" },
    });

    expect(
      (await screen.findAllByText("FORNECEDOR ANTIGO LTDA")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Em aberto")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Recebido" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Ver detalhes" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/store/history/2026-09-24",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("conclui o dia e bloqueia a edição na tela", async () => {
    const closedAgenda = {
      ...agendaBody([appointment("appt-close", "08:00")]).agenda,
      dayStatus: "concluido",
      completedAt: "2026-09-27T20:00:00.000Z",
      completedBy: { id: "user-1", name: "Gabriel" },
    };

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        json(200, agendaBody([appointment("appt-close", "08:00")])),
      )
      .mockImplementationOnce(() => json(200, closedAgenda));

    vi.stubGlobal("fetch", fetchMock);
    render(<TodayPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Concluir dia" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Concluir dia" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Concluir dia" }),
    );

    expect(await screen.findByText("Dia concluído")).toBeInTheDocument();
    expect(screen.getByText(/Gabriel em/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Recebido" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Fornecedor sem agenda/ }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/store/agenda/"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("mostra estado vazio ao selecionar um dia sem agenda", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/store/today") {
        return json(200, agendaBody([appointment("appt-today", "08:00")]));
      }
      return json(404, {
        error: "AGENDA_NAO_ENCONTRADA",
        message: "Agenda não encontrada.",
      });
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<TodayPage />);

    await screen.findByRole("searchbox", {
      name: "Pesquisar fornecedor ou protocolo",
    });

    fireEvent.change(screen.getByLabelText("Data da agenda"), {
      target: { value: "2026-09-23" },
    });

    expect(
      await screen.findByText("Nenhuma agenda em 23/09/2026."),
    ).toBeInTheDocument();
  });
});
