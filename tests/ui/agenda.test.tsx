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
import { HistoryPage } from "../../src/agenda/HistoryPage";
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
    expect(screen.getByText("1 não chegou")).toBeInTheDocument();
    expect(screen.getByText("1 recusado")).toBeInTheDocument();

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

    const desktopRows = screen.getAllByTestId("agenda-desktop-row");
    expect(within(desktopRows[0]).getByText("08:00 - 08:10")).toBeInTheDocument();
    expect(within(desktopRows[1]).getByText("09:00 - 10:10")).toBeInTheDocument();

    const mobileCard = screen.getAllByTestId("agenda-mobile-card")[0];
    expect(within(mobileCard).getByText("08:00 - 08:10")).toBeInTheDocument();
    expect(within(mobileCard).getByText("Fornecedor appt-early")).toBeInTheDocument();
    expect(within(mobileCard).getByText("9000early")).toBeInTheDocument();
    expect(within(mobileCard).getByText("Aguardando", { selector: ".store-status" })).toBeInTheDocument();
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
          ...appointment("appt-status", "08:00", "recusado"),
        }),
      );

    vi.stubGlobal("fetch", fetchMock);
    render(<TodayPage />);

    const card = await screen.findByTestId("agenda-mobile-card");
    expect(within(card).getByText("Aguardando", { selector: ".store-status" })).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Aguardando" }),
    ).not.toBeInTheDocument();

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

    fireEvent.click(within(card).getByRole("button", { name: "Recusado" }));
    expect(await within(card).findByText("Recusado", { selector: ".store-status" })).toBeInTheDocument();

    const calls = fetchMock.mock.calls
      .filter((call) => String(call[0]).includes("/status"));
    expect(calls).toHaveLength(2);
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
    fireEvent.click(within(card).getByRole("button", { name: "Não chegou" }));

    expect(
      await within(card).findByText("O status não foi alterado."),
    ).toBeInTheDocument();
    expect(within(card).getByText("Aguardando", { selector: ".store-status" })).toBeInTheDocument();
  });

  it("abre detalhes com campos importados e histórico", async () => {
    const detail = {
      ...appointment("appt-detail", "08:00", "recebido"),
      history: [
        {
          id: "h1",
          statusAnterior: "aguardando",
          statusNovo: "recebido",
          alteradoEm: "2026-09-24T12:00:00.000Z",
          usuario: { id: "u1", nome: "Conferente" },
        },
      ],
    };

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        json(200, agendaBody([appointment("appt-detail", "08:00", "recebido")])),
      )
      .mockImplementationOnce(() => json(200, detail));

    vi.stubGlobal("fetch", fetchMock);
    render(<TodayPage />);

    const detailButtons = await screen.findAllByRole("button", { name: "Ver detalhes" });
    fireEvent.click(detailButtons[0]);

    const detailsTitle = await screen.findByText("Detalhes do agendamento");
    const details = detailsTitle.closest("section");
    expect(details).not.toBeNull();
    const scoped = within(details!);
    expect(scoped.getByText("123456")).toBeInTheDocument();
    expect(scoped.getByText("50001")).toBeInTheDocument();
    expect(scoped.getByText("Pedido")).toBeInTheDocument();
    expect(scoped.getByText("aguardando → recebido")).toBeInTheDocument();
  });
});

describe("HistoryPage", () => {
  it("lista datas e busca somente a agenda escolhida", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/store/history") {
        return (await json(200, [
          {
            id: "a2",
            storeCode: "F03",
            storeName: "LOJA 03",
            date: "2026-09-23",
            total: 2,
            aguardando: 0,
            recebido: 2,
            naoChegou: 0,
            recusado: 0,
          },
          {
            id: "a1",
            storeCode: "F03",
            storeName: "LOJA 03",
            date: "2026-09-22",
            total: 1,
            aguardando: 1,
            recebido: 0,
            naoChegou: 0,
            recusado: 0,
          },
        ]));
      }

      if (url === "/api/store/history/2026-09-22") {
        return (await json(200, agendaBody([
          appointment("appt-history", "08:00"),
        ])));
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<HistoryPage />);

    fireEvent.click(await screen.findByRole("button", { name: /22\/09\/2026/ }));

    const historyRows = await screen.findAllByTestId("agenda-desktop-row");
    expect(within(historyRows[0]).getByText("Fornecedor appt-history")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/store/history/2026-09-22",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
