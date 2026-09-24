import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ParseAgendaResult } from "../../shared/agenda";
import { ImportAgendaPage } from "../../src/admin/ImportAgendaPage";
import { extractPdfText } from "../../src/import/extractPdfText";
import { parseAgendaText } from "../../src/import/parseAgendaText";

vi.mock("../../src/import/extractPdfText", () => ({
  extractPdfText: vi.fn(),
}));

vi.mock("../../src/import/parseAgendaText", () => ({
  parseAgendaText: vi.fn(),
}));

const mockedExtract = vi.mocked(extractPdfText);
const mockedParse = vi.mocked(parseAgendaText);

function validResult(
  blockingErrors: string[] = [],
): ParseAgendaResult {
  return {
    storeCode: "F99",
    storeName: "LOJA TESTE",
    date: "2026-09-24",
    warnings: [],
    blockingErrors,
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
  };
}

function response(status: number, body?: unknown) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  mockedExtract.mockReset();
  mockedParse.mockReset();
});

describe("ImportAgendaPage", () => {
  it("mostra carregando enquanto lê o PDF", async () => {
    let resolveText!: (value: string) => void;
    mockedExtract.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveText = resolve;
      }),
    );

    render(<ImportAgendaPage />);

    const file = new File(["pdf"], "agenda.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Arquivo PDF"), {
      target: { files: [file] },
    });

    expect(screen.getByText("Lendo PDF...")).toBeInTheDocument();

    resolveText("texto");
    mockedParse.mockReturnValue(validResult());
  });

  it("exibe prévia válida com loja, data, total e tabela", async () => {
    mockedExtract.mockResolvedValue("texto");
    mockedParse.mockReturnValue(validResult());

    render(<ImportAgendaPage />);
    const file = new File(["pdf"], "agenda.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Arquivo PDF"), {
      target: { files: [file] },
    });

    expect(await screen.findByText("F99 - LOJA TESTE")).toBeInTheDocument();
    expect(screen.getByText("24/09/2026")).toBeInTheDocument();
    expect(screen.getByText("1 agendamento")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Protocolo" })).toBeInTheDocument();
    expect(screen.getByText("90000001")).toBeInTheDocument();
  });

  it("desabilita confirmação quando há erros bloqueantes", async () => {
    mockedExtract.mockResolvedValue("texto");
    mockedParse.mockReturnValue(validResult(["TOTAL_DIVERGENTE:2:1"]));

    render(<ImportAgendaPage />);
    fireEvent.change(screen.getByLabelText("Arquivo PDF"), {
      target: {
        files: [new File(["pdf"], "agenda.pdf", { type: "application/pdf" })],
      },
    });

    const button = await screen.findByRole("button", { name: "Confirmar importação" });
    expect(button).toBeDisabled();
    expect(screen.getByText(/TOTAL_DIVERGENTE/)).toBeInTheDocument();
  });

  it("só envia replace=true após confirmação explícita de substituição", async () => {
    mockedExtract.mockResolvedValue("texto");
    mockedParse.mockReturnValue(validResult());

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        response(409, {
          error: "AGENDA_JA_EXISTE",
          message: "Já existe uma agenda para esta loja e data.",
        }),
      )
      .mockImplementationOnce(() =>
        response(200, {
          agenda: { id: "agenda-1" },
          appointments: [],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<ImportAgendaPage />);
    fireEvent.change(screen.getByLabelText("Arquivo PDF"), {
      target: {
        files: [new File(["pdf"], "agenda.pdf", { type: "application/pdf" })],
      },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Confirmar importação" }),
    );

    expect(
      await screen.findByText("Já existe uma agenda para esta loja e data."),
    ).toBeInTheDocument();

    const firstBody = JSON.parse(
      String(fetchMock.mock.calls[0][1]?.body),
    ) as Record<string, unknown>;
    expect(firstBody).not.toHaveProperty("replace");

    fireEvent.click(screen.getByRole("button", { name: "Substituir agenda" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const secondBody = JSON.parse(
      String(fetchMock.mock.calls[1][1]?.body),
    ) as Record<string, unknown>;
    expect(secondBody.replace).toBe(true);
  });
});
