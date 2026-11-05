export { RealtimeHub } from "./realtime/RealtimeHub.ts";
import { app } from "./app.ts";
import { closePastOpenAgendas } from "./services/agenda-maintenance.ts";
import { pruneDiagnostics } from "./repositories/diagnostics.ts";
import { runRetention } from "./services/retention.ts";

export default {
  fetch: app.fetch,
  async scheduled(
    controller,
    env,
    _ctx,
  ) {
    await closePastOpenAgendas(env.DB, new Date(controller.scheduledTime));
    try { await pruneDiagnostics(env.DB, new Date(controller.scheduledTime)); }
    catch { console.warn("Scheduled diagnostics retention unavailable"); }
    try {
      const limiteConfigurado = Number(env.RETENTION_ROW_LIMIT_WARNING);
      const rowWarningThreshold = Number.isFinite(limiteConfigurado) && limiteConfigurado > 0
        ? limiteConfigurado
        : undefined;
      const resumo = await runRetention(env.DB, env.RETENTION_BUCKET ?? null, {
        now: new Date(controller.scheduledTime),
        ...(rowWarningThreshold ? { rowWarningThreshold } : {})
      });
      console.log(JSON.stringify({
        event: "retention_summary",
        runId: resumo.runId,
        exportacaoPulada: resumo.exportacaoPulada,
        totalLinhas: resumo.totalLinhas
      }));
    } catch (error) {
      console.error("Scheduled retention failed", {
        message: error instanceof Error ? error.message : "Erro desconhecido."
      });
    }
  },
};