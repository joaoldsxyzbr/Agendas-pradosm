// Motivos de não recebimento. Fonte única para Worker e interface ES Modules.
export const OBSERVATION_REASONS = Object.freeze([
  "Sem agenda",
  "Sem pedido",
  "Sem boleto",
  "Prazo de pagamento incorreto",
  "Temperatura acima do OK",
  "Não veio"
]);
export const MAX_OBSERVATION_LENGTH = 250;
export function normalizeObservation(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("Observação inválida.");
  const note = value.trim().replace(/\s+/g, " ");
  if (!note) return null;
  if (note.length > MAX_OBSERVATION_LENGTH) throw new Error("A observação deve ter até 250 caracteres.");
  if (OBSERVATION_REASONS.includes(note)) return note;
  const custom = /^Outros:\s*(.+)$/i.exec(note);
  if (custom && custom[1].trim()) return "Outros: " + custom[1].trim();
  throw new Error("Selecione um motivo ou preencha Personalizado.");
}
export function validateStatusObservation(status, value) {
  const note = normalizeObservation(value);
  if (status === "nao_chegou" && !note) throw new Error("Selecione um motivo para Não recebido.");
  return note;
}
