export type ConferentePresenceStatus = "online" | "away" | "offline";

export const PRESENCE_ONLINE_WINDOW_MS = 3 * 60 * 1000;
export const PRESENCE_SIGNAL_WINDOW_MS = 7 * 60 * 1000;

function ageMs(value: string | null, nowMs: number) {
  if (!value) return Number.POSITIVE_INFINITY;

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;

  return Math.max(0, nowMs - timestamp);
}

export function conferentePresenceStatus(
  lastInteractionAt: string | null,
  lastSignalAt: string | null,
  nowMs = Date.now(),
): ConferentePresenceStatus {
  const signalAge = ageMs(lastSignalAt, nowMs);

  if (signalAge > PRESENCE_SIGNAL_WINDOW_MS) {
    return "offline";
  }

  const interactionAge = ageMs(lastInteractionAt, nowMs);
  if (interactionAge <= PRESENCE_ONLINE_WINDOW_MS) {
    return "online";
  }

  return "away";
}
