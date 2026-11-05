import type { AppEnv } from "../env.ts";
import { Hono } from "hono";
import { retentionStatus, runRetention } from "../services/retention.ts";

const adminRetentionRoutes = new Hono<AppEnv>();

adminRetentionRoutes.get("/status", async (c) => {
  return c.json(await retentionStatus(c.env.DB));
});

adminRetentionRoutes.post("/run", async (c) => {
  const resumo = await runRetention(c.env.DB, c.env.RETENTION_BUCKET ?? null);
  try {
    await c.env.DB.prepare(
      `INSERT INTO auditoria (
         id, usuario_id, acao, entidade, entidade_id, loja_id, agenda_id,
         agendamento_id, antes, depois, detalhes, criado_em
       )
       VALUES (?, ?, 'retencao_dados_executada', 'sistema', ?, NULL, NULL, NULL,
               NULL, NULL, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      c.get("authUser")?.id ?? null,
      resumo.runId,
      JSON.stringify({
        executadoEm: resumo.executadoEm,
        exportacaoPulada: resumo.exportacaoPulada,
        tabelas: resumo.tabelas.map((t) => ({
          tabela: t.tabela, exportados: t.exportados, purgados: t.purgados, pendentes: t.pendentes
        })),
        totalLinhas: resumo.totalLinhas
      }),
      new Date().toISOString()
    ).run();
  } catch {
    console.warn("Retenção: resumo da execução não gravado na auditoria.");
  }
  return c.json(resumo);
});

export { adminRetentionRoutes };
