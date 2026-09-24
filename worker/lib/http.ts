import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";

export const MAX_IMPORT_JSON_BYTES = 1024 * 1024;

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isSensitiveApiPath(path: string) {
  return (
    path.startsWith("/api/auth/") ||
    path.startsWith("/api/admin/agendas") ||
    path.startsWith("/api/admin/appointments") ||
    path.startsWith("/api/store/")
  );
}

function isAuthenticatedMutationPath(path: string) {
  return path.startsWith("/api/admin/") || path.startsWith("/api/store/");
}

function originMatchesRequest(requestUrl: string, origin: string) {
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

function requestTooLarge(c: Context<AppEnv>) {
  return c.json(
    {
      error: "REQUISICAO_MUITO_GRANDE",
      message: "O arquivo processado excede o limite permitido para importação.",
    },
    413,
  );
}

export const apiSecurityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next();

  c.header("X-Content-Type-Options", "nosniff");

  if (isSensitiveApiPath(c.req.path)) {
    c.header("Cache-Control", "no-store");
  }
});

export const validateMutationOrigin = createMiddleware<AppEnv>(
  async (c, next) => {
    if (
      !MUTATION_METHODS.has(c.req.method.toUpperCase()) ||
      !isAuthenticatedMutationPath(c.req.path)
    ) {
      await next();
      return;
    }

    const origin = c.req.header("Origin");

    // Clientes não-browser podem não enviar Origin. Em navegadores, quando o
    // cabeçalho existe, ele precisa corresponder à origem do próprio Worker.
    if (origin && !originMatchesRequest(c.req.url, origin)) {
      return c.json(
        {
          error: "ORIGEM_INVALIDA",
          message: "Origem da requisição não permitida.",
        },
        403,
      );
    }

    await next();
  },
);

export const limitAgendaImportBody = createMiddleware<AppEnv>(
  async (c, next) => {
    if (
      c.req.method.toUpperCase() !== "POST" ||
      c.req.path !== "/api/admin/agendas/import"
    ) {
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
  },
);

export function internalServerError(c: Context<AppEnv>) {
  return c.json(
    {
      error: "ERRO_INTERNO",
      message: "Não foi possível concluir a operação.",
    },
    500,
  );
}
