const REALTIME_PROTOCOL_VERSION = 1;
const AGENDA_CHANGE_REASONS: readonly string[] = Object.freeze([
  "status", "exchanges", "manual", "day-status", "import", "observation"
]);
function isAgendaChangedReason(value: string): boolean {
  return AGENDA_CHANGE_REASONS.includes(value);
}
export {
  REALTIME_PROTOCOL_VERSION,
  AGENDA_CHANGE_REASONS,
  isAgendaChangedReason
};