import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import {
  conferentePresenceStatus,
  type ConferentePresenceStatus,
} from "../lib/presence";
import {
  clearConferentePresence,
  listActiveConferentePresence,
  touchConferentePresence,
} from "../repositories/presence";

export const storePresenceRoutes = new Hono<AppEnv>();
export const adminPresenceRoutes = new Hono<AppEnv>();

const StorePresenceInput = z.object({
  interacted: z.boolean(),
});

function presenceRank(status: ConferentePresenceStatus) {
  switch (status) {
    case "online":
      return 2;
    case "away":
      return 1;
    case "offline":
      return 0;
  }
}

storePresenceRoutes.post("/", async (c) => {
  const user = c.get("authUser");
  if (user.papel !== "conferente" || !user.lojaId) {
    return c.json(
      { error: "ACESSO_NEGADO", message: "Acesso não permitido." },
      403,
    );
  }

  const parsed = StorePresenceInput.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Presença inválida." },
      400,
    );
  }

  const now = new Date().toISOString();
  await touchConferentePresence(c.env.DB, {
    userId: user.id,
    storeId: user.lojaId,
    interacted: parsed.data.interacted,
    now,
  });

  return c.json({ ok: true, recordedAt: now });
});

storePresenceRoutes.delete("/", async (c) => {
  const user = c.get("authUser");
  if (user.papel !== "conferente" || !user.lojaId) {
    return c.json(
      { error: "ACESSO_NEGADO", message: "Acesso não permitido." },
      403,
    );
  }

  await clearConferentePresence(c.env.DB, user.id);
  return c.body(null, 204);
});

adminPresenceRoutes.get("/", async (c) => {
  const rows = await listActiveConferentePresence(c.env.DB);
  const nowMs = Date.now();
  const byStore = new Map<
    string,
    {
      storeId: string;
      status: ConferentePresenceStatus;
      lastInteractionAt: string | null;
      lastSeenAt: string;
    }
  >();

  for (const row of rows) {
    const status = conferentePresenceStatus(
      row.ultima_interacao_em,
      row.ultimo_sinal_em,
      nowMs,
    );
    const current = byStore.get(row.loja_id);

    if (
      !current ||
      presenceRank(status) > presenceRank(current.status) ||
      (status === current.status &&
        row.ultimo_sinal_em > current.lastSeenAt)
    ) {
      byStore.set(row.loja_id, {
        storeId: row.loja_id,
        status,
        lastInteractionAt: row.ultima_interacao_em,
        lastSeenAt: row.ultimo_sinal_em,
      });
    }
  }

  return c.json(
    [...byStore.values()].map(({ storeId, status }) => ({
      storeId,
      status,
    })),
  );
});
