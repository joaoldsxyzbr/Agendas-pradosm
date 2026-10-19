const PRESENCE_ONLINE_WINDOW_MS = 3 * 60 * 1e3;
const PRESENCE_SIGNAL_WINDOW_MS = 7 * 60 * 1e3;
function ageMs(value, nowMs) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nowMs - timestamp);
}
function conferentePresenceStatus(lastInteractionAt, lastSignalAt, nowMs = Date.now()) {
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
export {
  PRESENCE_ONLINE_WINDOW_MS,
  PRESENCE_SIGNAL_WINDOW_MS,
  conferentePresenceStatus
};