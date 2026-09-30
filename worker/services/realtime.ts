import {
  REALTIME_PROTOCOL_VERSION,
  type RealtimeAgendaChangedEvent,
  type RealtimeAgendaChangedReason,
} from "../../shared/realtime";
import type { WorkerEnv } from "../env";

export type AgendaChangedInput = {
  agendaId: string;
  storeId: string;
  date: string;
  reason: RealtimeAgendaChangedReason;
};

export async function publishAgendaChanged(
  env: WorkerEnv,
  input: AgendaChangedInput,
): Promise<boolean> {
  if (env.REALTIME_MODE !== "on") return false;

  const event: RealtimeAgendaChangedEvent = {
    version: REALTIME_PROTOCOL_VERSION,
    type: "agenda.changed",
    ...input,
  };

  try {
    const hubId = env.REALTIME_HUB.idFromName("agenda-prado");
    const response = await env.REALTIME_HUB.get(hubId).fetch(
      new Request("https://realtime.internal/internal/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      }),
    );

    if (!response.ok) {
      console.error(
        JSON.stringify({
          event: "realtime_publish_failed",
          type: event.type,
          reason: event.reason,
          status: response.status,
        }),
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "realtime_publish_failed",
        type: event.type,
        reason: event.reason,
      }),
      error,
    );
    return false;
  }
}
