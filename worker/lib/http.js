import { createMiddleware } from "hono/factory";
const MAX_IMPORT_JSON_BYTES = 1024 * 1024;
const MUTATION_METHODS = /* @__PURE__ */ new Set(["POST", "PUT", "PATCH", "DELETE"]);
function isSensitiveApiPath(path) {
  return path.startsWith("/api/auth/") || path.startsWith("/api/admin/") || path.startsWith("/api/store/") || path.startsWith("/api/diagnostics/");
}
function isMutationOriginProtectedPath(path) {
  return path.startsWith("/api/admin/") || path.startsWith("/api/store/") || path.startsWith("/api/diagnostics/") || path === "/api/auth/bootstrap-register" || path === "/api/auth/login" || path === "/api/auth/logout" || path === "/api/auth/quick-login";
}
function originMatchesRequest(requestUrl, origin) {
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}
function requestTooLarge(c) {
  return c.json(
    {
      error: "REQUISICAO_MUITO_GRANDE",
      message: "O arquivo processado excede o limite permitido para importação."
    },
    413
  );
}
const apiSecurityHeaders = createMiddleware(async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );
  if (new URL(c.req.url).protocol === "https:") {
    c.header("Strict-Transport-Security", "max-age=31536000");
  }
  if (isSensitiveApiPath(c.req.path)) {
    c.header("Cache-Control", "no-store");
  }
});
const validateMutationOrigin = createMiddleware(
  async (c, next) => {
    if (!MUTATION_METHODS.has(c.req.method.toUpperCase()) || !isMutationOriginProtectedPath(c.req.path)) {
      await next();
      return;
    }
    const origin = c.req.header("Origin");
    const fetchSite = c.req.header("Sec-Fetch-Site");
    // Complementa Origin quando Fetch Metadata detecta uma requisicao cross-site.
    if ((origin && !originMatchesRequest(c.req.url, origin)) || fetchSite === "cross-site") {
      return c.json(
        {
          error: "ORIGEM_INVALIDA",
          message: "Origem da requisição não permitida."
        },
        403
      );
    }
    await next();
  }
);
const limitAgendaImportBody = createMiddleware(
  async (c, next) => {
    if (c.req.method.toUpperCase() !== "POST" || c.req.path !== "/api/admin/agendas/import" && c.req.path !== "/api/admin/agendas/import/bulk") {
      await next();
      return;
    }
    const contentLength = Number(c.req.header("Content-Length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMPORT_JSON_BYTES) {
      return requestTooLarge(c);
    }
    const bytes = (await c.req.raw.clone().arrayBuffer()).byteLength;
    if (bytes > MAX_IMPORT_JSON_BYTES) {
      return requestTooLarge(c);
    }
    await next();
  }
);
function internalServerError(c) {
  return c.json(
    {
      error: "ERRO_INTERNO",
      message: "Não foi possível concluir a operação."
    },
    500
  );
}
export {
  MAX_IMPORT_JSON_BYTES,
  apiSecurityHeaders,
  internalServerError,
  limitAgendaImportBody,
  originMatchesRequest,
  validateMutationOrigin
};