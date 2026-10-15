import { RealtimeHub } from "./realtime/RealtimeHub";
import { app } from "./app";
import { closePastOpenAgendas } from "./services/agenda-maintenance";
var worker_default = {
  fetch: app.fetch,
  async scheduled(controller, env, _ctx) {
    await closePastOpenAgendas(env.DB, new Date(controller.scheduledTime));
  }
};
export {
  RealtimeHub,
  worker_default as default
};
