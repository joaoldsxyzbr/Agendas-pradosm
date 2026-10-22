export { RealtimeHub } from "./realtime/RealtimeHub.js";
import { app } from "./app.js";
import { closePastOpenAgendas } from "./services/agenda-maintenance.js";
import { pruneDiagnostics } from "./repositories/diagnostics.js";

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