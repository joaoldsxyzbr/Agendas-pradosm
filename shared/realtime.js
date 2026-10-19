const REALTIME_PROTOCOL_VERSION = 1;
const AGENDA_CHANGE_REASONS = Object.freeze([
  "status", "exchanges", "manual", "day-status", "import", "observation"
]);
function isAgendaChangedReason(value) {
  return AGENDA_CHANGE_REASONS.includes(value);
}
export {
  REALTIME_PROTOCOL_VERSION,
  AGENDA_CHANGE_REASONS,
  isAgendaChangedReason
};