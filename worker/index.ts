import { app } from "./app";
import type { WorkerEnv } from "./env";
import { closePastOpenAgendas } from "./services/agenda-maintenance";

export default {
  fetch: app.fetch,
  async scheduled(
    controller: ScheduledController,
    env: WorkerEnv,
    _ctx: ExecutionContext,
  ) {
    await closePastOpenAgendas(env.DB, new Date(controller.scheduledTime));
  },
} satisfies ExportedHandler<WorkerEnv>;
