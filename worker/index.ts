export { RealtimeHub } from "./realtime/RealtimeHub.ts";
import { app } from "./app.ts";
import { closePastOpenAgendas } from "./services/agenda-maintenance.ts";
import { pruneDiagnostics } from "./repositories/diagnostics.ts";

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
  },
};