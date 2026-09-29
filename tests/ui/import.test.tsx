import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportAgendaPage } from "../../src/admin/ImportAgendaPage";
import {
  parseAgendaCsv,
  parseAgendaPdfText,
  type ParseAgendaBatchResult,
} from "../../src/import/parseAgendaBatch";
import { extractPdfText } from "../../src/import/extractPdfText";

vi.mock("../../src/import/extractPdfText", () => ({
  extractPdfText: vi.fn(),
}));

vi.mock("../../src/import/parseAgendaBatch", () => ({
  parseAgendaCsv: vi.fn(),
  parseAgendaPdfText: vi.fn(),
}));

const mockedExtract = vi.mocked(extractPdfText);
const mockedParseCsv = vi.mocked(parseAgendaCsv);
const mockedParsePdf = vi.mocked(parseAgendaPdfText);

function validResult(
  blockingErrors: string[] = [],
): ParseAgendaBatchResult {
  return {
    source: "pdf",
    date: "2026-09-24",
    totalAppointments: 1,
    warnings: [],
    blockingErrors,
    agendas: [
      {
        storeCode: "F99",
        storeName: "LOJA TESTE",
        date: "2026-09-24",
        warnings: [],
        blockingErrors: [],
        appointments: [
          {
            protocol: "90000001",
            startTime: "08:00",
            endTime: "08:10",
            supplier: "FORNECEDOR TESTE",
            items: 10,
            volumes: 5,
            pallets: 1,
            cargaBatida: null,
            type: "Pedido",
            nfe: [],
            orders: ["50001"],
            status: "aguardando",
          },
        ],
      },
    ],
  };
}

function response(status: number, body?: unknown) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  mockedExtract.mockReset();
  mockedParseCsv.mockReset();
  mockedParsePdf.mockReset();
});

describe("ImportAgendaPage", () => {
  it("mostra carregando enquanto lê o PDF", async () => {
    let resolveText!: (value: string) => void;
    mockedExtract.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveText = resolve;
      }),
    );
    mockedParsePdf.mockReturnValue(validResult());

    render(<ImportAgendaPage />);

    const file = new File(["pdf"], "agenda.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Arquivo CSV ou PDF"), {
      target: { files: [file] },
    });

    expect(screen.getByText("Lendo arquivo...")).toBeInTheDocument();

    resolveText("texto");
    await screen.findByText("1 loja");
  });

  it("exibe prévia válida com lojas, data, total e tabela", async () => {
    mockedExtract.mockResolvedValue("texto");
    mockedParsePdf.mockReturnValue(validResult());

    render(<ImportAgendaPage />);
    const file = new File(["pdf"], "agenda.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Arquivo CSV ou PDF"), {
      target: { files: [file] },
    });

    expect(await screen.findByText("1 loja")).toBeInTheDocument();
    expect(screen.getByText("24/09/2026")).toBeInTheDocument();
    expect(screen.getByText("1 agendamento")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Loja" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Protocolo" })).toBeInTheDocument();
    expect(screen.getByText("F99")).toBeInTheDocument();
    expect(screen.getByText("90000001")).toBeInTheDocument();
  });

  it("usa CSV como caminho direto sem tentar extrair PDF", async () => {
    mockedParseCsv.mockReturnValue({
      ...validResult(),
      source: "csv",
    });

    render(<ImportAgendaPage />);
    const file = new File(["csv"], "agendas.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: vi.fn().mockResolvedValue("csv"),
    });
    fireEvent.change(screen.getByLabelText("Arquivo CSV ou PDF"), {
      target: { files: [file] },
    });

    expect(await screen.findByText("1 loja")).toBeInTheDocument();
    expect(mockedParseCsv).toHaveBeenCalledTimes(1);
    expect(mockedExtract).not.toHaveBeenCalled();
  });

  it("desabilita confirmação quando há erros bloqueantes", async () => {
    mockedExtract.mockResolvedValue("texto");
    mockedParsePdf.mockReturnValue(validResult(["TOTAL_DIVERGENTE:2:1"]));

    render(<ImportAgendaPage />);
    fireEvent.change(screen.getByLabelText("Arquivo CSV ou PDF"), {
      target: {
        files: [new File(["pdf"], "agenda.pdf", { type: "application/pdf" })],
      },
    });

    const button = await screen.findByRole("button", {
      name: "Confirmar importação",
    });
    expect(button).toBeDisabled();
    expect(screen.getByText(/TOTAL_DIVERGENTE/)).toBeInTheDocument();
  });

  it("fecha o modal após importação em lote concluída com sucesso", async () => {
    mockedExtract.mockResolvedValue("texto");
    mockedParsePdf.mockReturnValue(validResult());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            agendas: [],
            totalAgendas: 1,
            totalAppointments: 1,
            created: 1,
            replaced: 0,
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
    const onClose = vi.fn();
    const onImported = vi.fn();

    render(
      <ImportAgendaPage modal onClose={onClose} onImported={onImported} />,
    );

    fireEvent.change(screen.getByLabelText("Arquivo CSV ou PDF"), {
      target: {
        files: [new File(["pdf"], "agenda.pdf", { type: "application/pdf" })],
      },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Confirmar importação" }),
    );

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("só envia replace=true após confirmação explícita de substituição", async () => {
    mockedExtract.mockResolvedValue("texto");
    mockedParsePdf.mockReturnValue(validResult());

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        response(409, {
          error: "AGENDAS_JA_EXISTEM",
          message: "Já existem agendas para uma ou mais lojas e datas do arquivo.",
        }),
      )
      .mockImplementationOnce(() =>
        response(200, {
          agendas: [],
          totalAgendas: 1,
          totalAppointments: 1,
          created: 0,
          replaced: 1,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<ImportAgendaPage />);
    fireEvent.change(screen.getByLabelText("Arquivo CSV ou PDF"), {
      target: {
        files: [new File(["pdf"], "agenda.pdf", { type: "application/pdf" })],
      },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Confirmar importação" }),
    );

    expect(
      await screen.findByText(
        "Já existe agenda para uma ou mais lojas e datas deste arquivo.",
      ),
    ).toBeInTheDocument();

    const firstBody = JSON.parse(
      String(fetchMock.mock.calls[0][1]?.body),
    ) as {
      agendas: Array<Record<string, unknown>>;
    };
    expect(firstBody.agendas[0]).not.toHaveProperty("replace");

    fireEvent.click(
      screen.getByRole("button", { name: "Substituir agendas existentes" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const secondBody = JSON.parse(
      String(fetchMock.mock.calls[1][1]?.body),
    ) as {
      agendas: Array<Record<string, unknown>>;
    };
    expect(secondBody.agendas[0].replace).toBe(true);
  });
});
