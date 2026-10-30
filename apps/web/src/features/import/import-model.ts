import { apiFetch } from "@/lib/api";

// O React reutiliza o parser oficial do JS nativo, sem duplicar a logica de negocio.
// @ts-ignore - Modulo JS legado sem declaracoes TS nesta etapa.
import { parseAgendaCsv, parseAgendaPdfText } from "../../../../../frontend/import/parseAgendaBatch.js";
// @ts-ignore - Modulo JS legado sem declaracoes TS nesta etapa.
import { readCsvText } from "../../../../../frontend/import/readCsvText.js";
// @ts-ignore - Extração PDF WASM lazy, já utilizada e testada no sistema original.
import { extractPdfText } from "../../../../../frontend/import/extractPdfText.js";

export const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;

export type ImportedAppointment = {
  protocol: string; supplier: string;
  startTime: string; endTime: string;
  type: string; items?: number | null; volumes?: number | null;
  pallets?: number | null; cargaBatida?: string | null;
  nfe?: string[]; orders?: string[];
  status?: string;
};
export type ImportAgenda = {
  storeCode: string | null; storeName?: string | null;
  date: string | null; appointments: ImportedAppointment[];
  blockingErrors?: string[]; warnings?: string[];
};
export type ImportPreview = {
  date: string | null; totalAppointments: number;
  agendas: ImportAgenda[]; blockingErrors: string[];
  warnings: string[]; source?: string;
};
export type ImportResult = {
  totalAgendas: number; totalAppointments: number;
  created?: number; replaced?: number;
};

const errorLabels: Record<string, string> = {
  FILIAL_NAO_IDENTIFICADA: "Filial não identificada no arquivo.",
  DATA_NAO_IDENTIFICADA: "Data não identificada no arquivo.",
  SEM_AGENDAMENTOS_VALIDOS: "Nenhum agendamento válido foi encontrado.",
  REGISTROS_NAO_INTERPRETADOS: "Há registros que não puderam ser interpretados com segurança.",
  TOTAL_DIVERGENTE: "O total informado no arquivo diverge dos registros encontrados.",
  PROTOCOLO_DUPLICADO: "Há protocolo duplicado na agenda.",
  DATAS_DIVERGENTES: "O arquivo contém mais de uma data de agenda.",
  DATA_DIVERGENTE: "A data dos registros diverge da data informada no filtro do arquivo.",
  FORMATO_CSV_NAO_RECONHECIDO: "O CSV não possui as colunas esperadas da agenda de recebimento.",
};

export function importErrorLabel(error: string) {
  const code = String(error).split(":")[0] ?? "";
  return errorLabels[code] ? `${errorLabels[code]} (${error})` : String(error);
}

export function isCsvAgenda(file: File) {
  return file.type === "text/csv" || file.type === "application/csv"
    || file.name.toLowerCase().endsWith(".csv");
}
export function isPdfAgenda(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function canConfirmImport(file: File | null, preview: ImportPreview | null, submitting = false) {
  return Boolean(file && preview && preview.agendas.length > 0 && preview.totalAppointments > 0 &&
    preview.agendas.every(agenda => agenda.storeCode && agenda.date) &&
    preview.blockingErrors.length === 0 && !submitting);
}

export function buildImportPayload(file: File | null, preview: ImportPreview | null, replace = false) {
  if (!file || !preview) return null;
  const agendas = preview.agendas.flatMap(agenda => {
    if (!agenda.storeCode || !agenda.date) return [];
    return [{
      storeCode: agenda.storeCode,
      date: agenda.date,
      originalFileName: file.name,
      appointments: agenda.appointments.map(({ status: _status, ...appointment }) => appointment),
      ...(replace ? { replace: true } : {}),
    }];
  });
  if (!agendas.length || agendas.length !== preview.agendas.length) return null;
  return { agendas };
}

export async function parseSelectedFile(file: File): Promise<ImportPreview> {
  const parsed: unknown = isCsvAgenda(file)
    ? parseAgendaCsv(await readCsvText(file))
    : parseAgendaPdfText(await extractPdfText(file));
  // Parser oficial já retorna o contrato acima. A validação de gravação continua no Worker.
  return parsed as ImportPreview;
}

export async function submitImport(file: File, preview: ImportPreview, replace = false) {
  const payload = buildImportPayload(file, preview, replace);
  if (!payload || !canConfirmImport(file, preview)) throw new Error("Prévia inválida para importação.");
  return apiFetch<ImportResult>("/api/admin/agendas/import/bulk", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
