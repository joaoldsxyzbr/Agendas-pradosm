import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseAgendaText } from "../../src/import/parseAgendaText";
import {
  extractPdfText,
  normalizeLiteParseText,
  PdfExtractionError,
} from "../../src/import/extractPdfText";

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  parse: vi.fn(),
  construct: vi.fn(),
}));

vi.mock("@llamaindex/liteparse-wasm", () => ({
  default: mocks.init,
  LiteParse: class {
    constructor(options: unknown) {
      mocks.construct(options);
    }

    parse(bytes: Uint8Array) {
      return mocks.parse(bytes);
    }
  },
}));

function fakeFile() {
  return {
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  } as File;
}

const singleAppointmentMarkdown = [
  "Prado Supermercados Filtros: Dia: 26/09/2026 | Filiais: F08 - PORTO BELO | Doca: Todas",
  "Busca: Agendas de recebimento Total: 1",
  "| Protocolo | Data agenda | Fornecedor | Itens | Vol. | Paletes | Carga batida | Tipo | N° NFe | Pedidos |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  "| 12483094 | 26/09/2026<br>07:30 às 07:40 | FRIGORIFICO GESSNER LTDA | 2 | 5 | 0 | - | CNPJ | - | - |",
].join("\n");

describe("extractPdfText com LiteParse", () => {
  beforeEach(() => {
    mocks.init.mockResolvedValue(undefined);
    mocks.parse.mockReset();
    mocks.construct.mockClear();
  });

  it("normaliza tabela Markdown para o TSV esperado pelo parser", () => {
    const text = normalizeLiteParseText(singleAppointmentMarkdown);

    expect(text).toContain(
      "12483094\t26/09/2026 07:30 às 07:40\tFRIGORIFICO GESSNER LTDA\t2\t5\t0\t-\tCNPJ\t-\t-",
    );

    const parsed = parseAgendaText(text);
    expect(parsed.blockingErrors).toEqual([]);
    expect(parsed.storeCode).toBe("F08");
    expect(parsed.date).toBe("2026-09-26");
    expect(parsed.appointments).toEqual([
      expect.objectContaining({
        protocol: "12483094",
        startTime: "07:30",
        endTime: "07:40",
        supplier: "FRIGORIFICO GESSNER LTDA",
        items: 2,
        volumes: 5,
        pallets: 0,
        type: "CNPJ",
      }),
    ]);
  });

  it("usa LiteParse em Markdown e devolve texto normalizado", async () => {
    mocks.parse.mockResolvedValue({ text: singleAppointmentMarkdown });

    const text = await extractPdfText(fakeFile());

    expect(mocks.construct).toHaveBeenCalledWith(
      expect.objectContaining({
        ocrEnabled: false,
        outputFormat: "markdown",
      }),
    );
    expect(mocks.parse).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(text).toContain(
      "12483094\t26/09/2026 07:30 às 07:40\tFRIGORIFICO GESSNER LTDA\t2\t5\t0\t-\tCNPJ\t-\t-",
    );
  });

  it("converte falha de leitura em PDF_INVALIDO", async () => {
    mocks.parse.mockRejectedValue(new Error("arquivo corrompido"));

    await expect(extractPdfText(fakeFile())).rejects.toMatchObject({
      name: PdfExtractionError.name,
      code: "PDF_INVALIDO",
      message: "PDF_INVALIDO",
    });
  });
});
