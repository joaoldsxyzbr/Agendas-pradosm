import { getDocument } from "pdfjs-dist";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractPdfText,
  PdfExtractionError,
} from "../../src/import/extractPdfText";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: "mock-pdf-worker",
}));

const mockedGetDocument = vi.mocked(getDocument);

function item(str: string, x: number, y: number) {
  return {
    str,
    transform: [1, 0, 0, 1, x, y],
    width: 30,
    height: 10,
    hasEOL: false,
    dir: "ltr",
    fontName: "f1",
  };
}

function fakeFile() {
  return {
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  } as File;
}

describe("extractPdfText", () => {
  beforeEach(() => {
    mockedGetDocument.mockReset();
  });

  it("mantém linhas e colunas do padrão da agenda", async () => {
    const cleanup = vi.fn();
    const destroy = vi.fn().mockResolvedValue(undefined);

    mockedGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getViewport: () => ({ width: 1000 }),
          getTextContent: async () => ({
            items: [
              item("90000001", 20, 800),
              item("24/09/2026", 120, 800),
              item("FORNECEDOR", 240, 800),
              item("5", 420, 800),
              item("2", 475, 800),
              item("1", 530, 800),
              item("-", 610, 800),
              item("Pedido", 730, 800),
              item("-", 805, 800),
              item("50001", 890, 800),
              item("LTDA", 240, 790),
            ],
          }),
          cleanup,
        }),
      }),
      destroy,
    } as never);

    const text = await extractPdfText(fakeFile());
    const lines = text.split("\n");

    expect(lines[0]).toBe(
      "90000001\t24/09/2026\tFORNECEDOR LTDA\t5\t2\t1\t-\tPedido\t-\t50001",
    );
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("agrupa cada registro pela linha do protocolo quando as células ficam desalinhadas", async () => {
    const cleanup = vi.fn();
    const destroy = vi.fn().mockResolvedValue(undefined);

    mockedGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getViewport: () => ({ width: 1000 }),
          getTextContent: async () => ({
            items: [
              item("Protocolo", 50, 900),
              item("Data agenda", 120, 900),
              item("Fornecedor", 240, 900),
              item("Tipo", 730, 900),
              item("N° NFe", 790, 900),
              item("Pedidos", 860, 900),
              item("90000001", 20, 800),
              item("24/09/2026", 120, 804),
              item("08:00 às 08:10", 120, 796),
              item("FORNECEDOR ALFA", 240, 804),
              item("LTDA", 240, 796),
              item("3", 420, 800),
              item("3", 475, 800),
              item("1", 530, 800),
              item("-", 610, 800),
              item("CNPJ", 730, 800),
              item("-", 805, 800),
              item("-", 890, 800),
              item("DISTRIBUIDORA", 240, 782),
              item("24/09/2026", 120, 776),
              item("Nota", 730, 776),
              item("90000002", 20, 772),
              item("08:10 às 08:20", 120, 768),
              item("DE ALIMENTOS", 240, 772),
              item("15", 420, 772),
              item("15", 475, 772),
              item("1", 530, 772),
              item("-", 610, 772),
              item("123456", 791, 772),
              item("654321", 868, 772),
              item("LTDA", 240, 764),
              item("fiscal", 730, 764),
            ],
          }),
          cleanup,
        }),
      }),
      destroy,
    } as never);

    const text = await extractPdfText(fakeFile());
    const lines = text.split("\n");

    expect(lines).toContain(
      "90000001\t24/09/2026 08:00 às 08:10\tFORNECEDOR ALFA LTDA\t3\t3\t1\t-\tCNPJ\t-\t-",
    );
    expect(lines).toContain(
      "90000002\t24/09/2026 08:10 às 08:20\tDISTRIBUIDORA DE ALIMENTOS LTDA\t15\t15\t1\t-\tNota fiscal\t123456\t654321",
    );
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("interpreta agenda com um único registro usando as colunas reais do PDF", async () => {
    const cleanup = vi.fn();
    const destroy = vi.fn().mockResolvedValue(undefined);

    mockedGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getViewport: () => ({ width: 595.28 }),
          getTextContent: async () => ({
            items: [
              item("Protocolo", 48.52, 756),
              item("Data", 99.16, 756),
              item("agenda", 121.07, 756),
              item("Fornecedor", 164.13, 756),
              item("Itens", 276.13, 756),
              item("Vol.", 308.78, 756),
              item("Paletes", 336.84, 756),
              item("Carga", 379.05, 756),
              item("batida", 405.66, 756),
              item("Tipo", 444.03, 756),
              item("N°", 474.06, 756),
              item("NFe", 486.74, 756),
              item("Pedidos", 515.2, 756),
              item("26/09/2026", 105.84, 729),
              item("12483094", 50.31, 724.5),
              item("FRIGORIFICO", 164.13, 724.5),
              item("GESSNER", 209.94, 724.5),
              item("LTDA", 244.13, 724.5),
              item("2", 283.93, 724.5),
              item("5", 314.29, 724.5),
              item("0", 349.42, 724.5),
              item("-", 403.95, 724.5),
              item("CNPJ", 444.77, 724.5),
              item("-", 487.04, 724.5),
              item("-", 529.76, 724.5),
              item("07:30", 99.87, 720),
              item("às", 121.44, 720),
              item("07:40", 131.24, 720),
            ],
          }),
          cleanup,
        }),
      }),
      destroy,
    } as never);

    const text = await extractPdfText(fakeFile());

    expect(text.split("\n")).toContain(
      "12483094\t26/09/2026 07:30 às 07:40\tFRIGORIFICO GESSNER LTDA\t2\t5\t0\t-\tCNPJ\t-\t-",
    );
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("converte falha de leitura em PDF_INVALIDO", async () => {
    mockedGetDocument.mockReturnValue({
      promise: Promise.reject(new Error("arquivo corrompido")),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    await expect(extractPdfText(fakeFile())).rejects.toMatchObject({
      name: PdfExtractionError.name,
      code: "PDF_INVALIDO",
      message: "PDF_INVALIDO",
    });
  });
});
