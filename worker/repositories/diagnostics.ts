// Eventos limitados a códigos estáveis. Nunca armazenar conteúdo de arquivos, URL, stack, mensagens ou tokens.
export const DIAGNOSTIC_EVENTS = Object.freeze([
  "IMPORT_SELECTED", "IMPORT_PREVIEW_READY", "IMPORT_VALIDATION_FAILED",
  "IMPORT_READ_FAILED", "IMPORT_REQUEST_FAILED", "IMPORT_SUCCEEDED",
  "IMPORT_DROP_REJECTED", "BROWSER_EXCEPTION", "BROWSER_REJECTION",
  "WORKER_EXCEPTION"
]);
const eventSet = new Set(DIAGNOSTIC_EVENTS);
const levels = new Set(["info", "warning", "error"]);
const operations = new Set(["importacao", "aplicativo", "api"]);
const formats = new Set(["csv", "pdf", "outro"]);
const sources = new Set(["browser", "worker"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeDiagnostic(input) {
  if (!input || !eventSet.has(input.evento) || !levels.has(input.nivel)
      || !operations.has(input.operacao) || !sources.has(input.origem)) {
    throw new TypeError("Evento de diagnóstico inválido");
  }
  const formato = input.formato == null ? null : input.formato;
  if (formato !== null && !formats.has(formato)) throw new TypeError("Formato inválido");
  const quantidade = input.quantidade == null ? null : input.quantidade;
  if (quantidade !== null && (!Number.isInteger(quantidade) || quantidade < 0 || quantidade > 700)) {
    throw new TypeError("Quantidade inválida");
  }
  const duracaoMs = input.duracaoMs == null ? null : input.duracaoMs;
  if (duracaoMs !== null && (!Number.isInteger(duracaoMs) || duracaoMs < 0 || duracaoMs > 120000)) {
    throw new TypeError("Duração inválida");
  }
  const httpStatus = input.httpStatus == null ? null : input.httpStatus;
  if (httpStatus !== null && (!Number.isInteger(httpStatus) || httpStatus < 100 || httpStatus > 599)) {
    throw new TypeError("Status inválido");
  }
  return {
    origem: input.origem, nivel: input.nivel, evento: input.evento,
    operacao: input.operacao, formato, quantidade, duracaoMs, httpStatus,
    correlacao: uuid.test(input.correlacao ?? "") ? input.correlacao : crypto.randomUUID()
  };
}

export async function recordDiagnostic(db, data) {
  const item = normalizeDiagnostic(data);
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO diagnosticos
    (id, usuario_id, loja_id, origem, nivel, evento, operacao, formato,
     quantidade, duracao_ms, http_status, correlacao, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, data.userId ?? null, data.storeId ?? null, item.origem, item.nivel, item.evento,
    item.operacao, item.formato, item.quantidade, item.duracaoMs, item.httpStatus,
    item.correlacao, new Date().toISOString()
  ).run();
  return { id, correlacao: item.correlacao };
}

export async function recordDiagnosticSafe(db, data) {
  try { return await recordDiagnostic(db, data); }
  catch { console.warn("Diagnostic persistence unavailable", { event: data.evento }); return null; }
}

export async function listDiagnostics(db, filters = {}) {
  const clauses = [], values = [];
  if (filters.nivel) { clauses.push("d.nivel = ?"); values.push(filters.nivel); }
  if (filters.operacao) { clauses.push("d.operacao = ?"); values.push(filters.operacao); }
  if (filters.origem) { clauses.push("d.origem = ?"); values.push(filters.origem); }
  if (filters.userId) { clauses.push("d.usuario_id = ?"); values.push(filters.userId); }
  if (filters.storeId) { clauses.push("d.loja_id = ?"); values.push(filters.storeId); }
  if (filters.date) {
    clauses.push("d.criado_em >= ? AND d.criado_em < ?");
    values.push(filters.date + "T00:00:00.000Z", filters.date + "T23:59:59.999Z");
  }
  const limit = Math.min(200, Math.max(1, filters.limit ?? 100));
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  const result = await db.prepare(`SELECT d.id, d.usuario_id, u.nome AS usuario_nome,
    d.origem, d.nivel, d.evento, d.operacao, d.formato, d.quantidade,
    d.http_status, d.duracao_ms, d.correlacao, d.criado_em, d.loja_id
    FROM diagnosticos d LEFT JOIN usuarios u ON u.id = d.usuario_id
    ${where} ORDER BY d.criado_em DESC, d.id DESC LIMIT ?`
  ).bind(...values, limit).all();
  return result.results;
}

export async function pruneDiagnostics(db, now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 86400000).toISOString();
  await db.prepare("DELETE FROM diagnosticos WHERE criado_em < ?").bind(cutoff).run();
}