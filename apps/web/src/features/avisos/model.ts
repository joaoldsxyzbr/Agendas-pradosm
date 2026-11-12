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

// Carimbo de criação no fuso de Brasília (sem DST).
export function formatAvisoStamp(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(date);
}

// Rótulo curto do público do aviso: null = todas as lojas.
export function rotuloLojasAviso(lojas: string[] | null) {
  if (!lojas) return "Todas as lojas";
  return (lojas.length === 1 ? "Loja " : "Lojas ") + lojas.join(", ");
}
