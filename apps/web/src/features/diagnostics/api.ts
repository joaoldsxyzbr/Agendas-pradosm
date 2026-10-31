import { z } from "zod";
import { apiFetch } from "@/lib/api";

const diagnosticSchema = z.object({
  id: z.string(),
  user: z.object({ id: z.string(), name: z.string() }).nullable(),
  source: z.enum(["browser", "worker"]),
  level: z.enum(["info", "warning", "error"]),
  event: z.string(),
  operation: z.string(),
  format: z.string().nullable().optional(),
  count: z.number().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  httpStatus: z.number().nullable().optional(),
  correlationId: z.string().nullable().optional(),
  storeId: z.string().nullable().optional(),
  createdAt: z.string(),
});

const auditSchema = z.object({
  id: z.string(),
  action: z.string(),
  entity: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),
  storeId: z.string().nullable().optional(),
  agendaId: z.string().nullable().optional(),
  appointmentId: z.string().nullable().optional(),
  before: z.record(z.string(), z.unknown()).nullable().optional(),
  after: z.record(z.string(), z.unknown()).nullable().optional(),
  details: z.string().nullable().optional(),
  createdAt: z.string(),
  user: z.object({ id: z.string(), name: z.string() }).nullable(),
});

export type DiagnosticRecord = z.infer<typeof diagnosticSchema>;
export type AuditRecord = z.infer<typeof auditSchema>;
export type DiagnosticsTab = "errors" | "operations" | "audit";
export type DiagnosticsFilters = {
  date: string;
  origem: string;
  operacao: string;
  userId: string;
  storeId: string;
};

export const emptyDiagnosticsFilters = (): DiagnosticsFilters => ({
  date: "", origem: "", operacao: "", userId: "", storeId: "",
});

// Mesmos rótulos do frontend atual para manter a leitura dos eventos.
export const EVENT_LABELS: Record<string, string> = {
  IMPORT_SELECTED: "Arquivo selecionado",
  IMPORT_PREVIEW_READY: "Prévia da importação pronta",
  IMPORT_VALIDATION_FAILED: "Arquivo não passou na validação",
  IMPORT_READ_FAILED: "Falha na leitura do arquivo",
  IMPORT_REQUEST_FAILED: "Falha no envio da importação",
  IMPORT_SUCCEEDED: "Importação confirmada",
  IMPORT_DROP_REJECTED: "Arquivo arrastado recusado",
  BROWSER_EXCEPTION: "Erro do JavaScript",
  BROWSER_REJECTION: "Falha assíncrona no navegador",
  WORKER_EXCEPTION: "Erro inesperado no Worker",
};

export const diagnosticsKey = ["admin", "diagnostics"] as const;
export const auditLogKey = ["admin", "audit-log"] as const;

export async function listDiagnosticRecords(filters: DiagnosticsFilters, errorOnly: boolean) {
  const params = new URLSearchParams({ limit: "100" });
  if (errorOnly) params.set("nivel", "error");
  if (filters.date) params.set("date", filters.date);
  if (filters.origem) params.set("origem", filters.origem);
  if (filters.operacao) params.set("operacao", filters.operacao);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.storeId) params.set("storeId", filters.storeId);
  return z.array(diagnosticSchema).parse(await apiFetch<unknown>("/api/admin/diagnostics?" + params));
}

export async function listAuditRecords(filters: DiagnosticsFilters) {
  const params = new URLSearchParams({ limit: "100" });
  if (filters.date) params.set("date", filters.date);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.storeId) params.set("storeId", filters.storeId);
  return z.array(auditSchema).parse(await apiFetch<unknown>("/api/admin/audit?" + params));
}
