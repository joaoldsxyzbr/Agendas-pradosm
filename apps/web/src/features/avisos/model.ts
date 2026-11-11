import {
  avisoSchema,
  avisosResponseSchema,
  publicarAvisoSchema,
  type Aviso,
  type AvisosResponse,
  type PublicarAvisoInput,
} from "../../../../../shared/avisos.ts";

// Contratos de avisos reaproveitados do shared entre Worker e frontend
// (mesmo padrão do import-model). O zod continua sendo a fonte da verdade.
export { avisoSchema, avisosResponseSchema, publicarAvisoSchema };
export type { Aviso, AvisosResponse, PublicarAvisoInput };

export const avisoPublicadoSchema = avisoSchema;
export type AvisoPublicado = Aviso;

// Carimbo de criação/validade no fuso de Brasília (sem DST).
export function formatAvisoStamp(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(date);
}

// Data escolhida no <input type="date"> vira expiração ISO no fim do dia
// de Brasília (UTC-3 fixo; o Brasil não tem horário de verão).
export function expiraEmFromInput(date: string): string | null {
  if (!date) return null;
  return new Date(`${date}T23:59:59-03:00`).toISOString();
}
