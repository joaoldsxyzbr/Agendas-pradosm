// Nunca envia URL, stack, payload, nome de arquivo, fornecedor ou texto de exceções.
const EVENTS = new Set([
  "IMPORT_SELECTED", "IMPORT_PREVIEW_READY", "IMPORT_VALIDATION_FAILED",
  "IMPORT_READ_FAILED", "IMPORT_REQUEST_FAILED", "IMPORT_SUCCEEDED",
  "IMPORT_DROP_REJECTED", "BROWSER_EXCEPTION", "BROWSER_REJECTION"
]);
const FORMATS = new Set(["csv", "pdf", "outro"]);
const LEVELS = new Set(["info", "warning", "error"]);
const OPERATIONS = new Set(["importacao", "aplicativo", "api"]);

export function newCorrelationId() {
  return crypto.randomUUID();
}

export function safeDiagnosticPayload(evento, input = {}) {
  if (!EVENTS.has(evento)) return null;
  const payload = {
    evento,
    nivel: LEVELS.has(input.nivel) ? input.nivel : "error",
    operacao: OPERATIONS.has(input.operacao) ? input.operacao : "aplicativo",
    correlacao: /^[0-9a-f-]{36}$/i.test(input.correlacao ?? "") ?
      input.correlacao : newCorrelationId()
  };
  if (FORMATS.has(input.formato)) payload.formato = input.formato;
  if (Number.isInteger(input.quantidade) && input.quantidade >= 0 && input.quantidade <= 700) {
    payload.quantidade = input.quantidade;
  }
  if (Number.isInteger(input.duracaoMs) && input.duracaoMs >= 0 && input.duracaoMs <= 120000) {
    payload.duracaoMs = input.duracaoMs;
  }
  if (Number.isInteger(input.httpStatus) && input.httpStatus >= 100 && input.httpStatus <= 599) {
    payload.httpStatus = input.httpStatus;
  }
  return payload;
}

export function sendDiagnostic(evento, options = {}, fetcher = (...args) => fetch(...args)) {
  const payload = safeDiagnosticPayload(evento, options);
  if (!payload) return Promise.resolve(false);
  try {
    return Promise.resolve(fetcher("/api/diagnostics/events", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })).then(response => Boolean(response?.ok)).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

export function installBrowserDiagnostics(win, getUser, reporter = sendDiagnostic) {
  const latest = new Map();
  const emit = evento => {
    if (!getUser()) return;
    const time = Date.now();
    if (time - (latest.get(evento) ?? 0) < 5000) return;
    latest.set(evento, time);
    void reporter(evento, { nivel: "error", operacao: "aplicativo" });
  };
  const error = () => emit("BROWSER_EXCEPTION");
  const rejection = () => emit("BROWSER_REJECTION");
  win.addEventListener("error", error);
  win.addEventListener("unhandledrejection", rejection);
  return () => {
    win.removeEventListener("error", error);
    win.removeEventListener("unhandledrejection", rejection);
  };
}