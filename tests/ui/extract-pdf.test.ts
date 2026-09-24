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
      "90000001\t24/09/2026\tFORNECEDOR\t5\t2\t1\t-\tPedido\t-\t50001",
    );
    expect(lines[1]).toBe("\t\tLTDA\t\t\t\t\t\t\t");
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
