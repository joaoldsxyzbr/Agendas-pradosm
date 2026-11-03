import { apiFetch } from "@/lib/api";

// O React reutiliza o parser oficial, sem duplicar a logica de negocio.
import { parseAgendaCsv, parseAgendaPdfText } from "../../../../../shared/import/parseAgendaBatch.ts";
import { readCsvText } from "../../../../../shared/import/readCsvText.ts";
import { extractPdfText } from "../../../../../shared/import/extractPdfText.ts";

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

// Converte os códigos do parser em mensagens completas, em português claro,
// usando os argumentos que vêm depois do código (contagens, protocolo, loja, datas).
const formatDate = (value: string): string => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match?.[1] && match[2] && match[3] ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

export function importErrorLabel(error: string) {
  const raw = String(error);
  const separator = raw.indexOf(":");
  const code = separator === -1 ? raw : raw.slice(0, separator);
  const args = separator === -1 ? [] : raw.slice(separator + 1).split(":");
  switch (code) {
    case "FILIAL_NAO_IDENTIFICADA":
      return "Filial não identificada no arquivo.";
    case "DATA_NAO_IDENTIFICADA":
      return "Data não identificada no arquivo.";
    case "SEM_AGENDAMENTOS_VALIDOS":
      return "Nenhuma linha de agendamento válida foi encontrada no arquivo.";
    case "REGISTROS_NAO_INTERPRETADOS": {
      const count = Number(args[0] ?? "");
      if (!Number.isInteger(count) || count < 1) {
        return "Há linhas que não puderam ser interpretadas com segurança.";
      }
      const opening = count === 1
        ? "1 linha não pôde ser interpretada"
        : `${count} linhas não puderam ser interpretadas`;
      return `${opening}. Confira horário, filial, fornecedor e tipo dessas linhas.`;
    }
    case "TOTAL_DIVERGENTE": {
      const declared = args[0] ?? "";
      const actual = args[1] ?? "";
      if (!declared || !actual) return "O total informado no arquivo diverge das linhas encontradas.";
      const found = actual === "1" ? "apenas 1 linha válida foi encontrada" : `apenas ${actual} linhas válidas foram encontradas`;
      return `O arquivo informa ${declared} agendamentos, mas ${found}.`;
    }
    case "PROTOCOLO_DUPLICADO": {
      const store = args[0] ?? "";
      const protocol = args[1] ?? "";
      if (!store || !protocol) return "Há um protocolo repetido no arquivo.";
      return `O protocolo ${protocol} aparece mais de uma vez na loja ${store}. Remova a linha repetida do arquivo.`;
    }
    case "DATAS_DIVERGENTES": {
      const dates = (args[0] ?? "").split(",").map(formatDate).filter(item => item.length > 0);
      if (dates.length === 0) return "O arquivo contém mais de uma data de agenda.";
      return `O arquivo mistura agendas de datas diferentes: ${dates.join(", ")}. Importe uma data por vez.`;
    }
    case "DATA_DIVERGENTE": {
      const declared = args[0] ?? "";
      const actual = args[1] ?? "";
      if (!declared || !actual) {
        return "A data das linhas diverge da data informada no filtro do arquivo.";
      }
      return `O filtro do arquivo indica ${formatDate(declared)}, mas as linhas trazem a data ${formatDate(actual)}.`;
    }
    case "FORMATO_CSV_NAO_RECONHECIDO":
      return "O CSV não possui as colunas esperadas da agenda de recebimento.";
    default:
      return raw;
  }
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