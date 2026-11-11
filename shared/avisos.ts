import { z } from "zod";

// Contrato da API de avisos/notificações in-app entre Worker e frontend.
// "aviso" é publicado pelo admin; "evento" é gerado pelo sistema.
// Limites de texto são hardening do input (spec 2026-11-11, decisão 9 complementar).

export const avisoTipoSchema = z.enum(["aviso", "evento"]);

export const avisoSchema = z.object({
  id: z.string(),
  tipo: avisoTipoSchema,
  titulo: z.string(),
  mensagem: z.string(),
  criadoEm: z.string(),
  expiraEm: z.string().nullable(),
  lido: z.boolean(),
});

export const avisosResponseSchema = z.object({
  avisos: z.array(avisoSchema),
  naoLidos: z.number().int().nonnegative(),
});

// Corpo do POST /api/admin/avisos. expiraEm opcional (ISO 8601); sem expiração
// o aviso fica visível até ser inativado (soft delete).
export const publicarAvisoSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, "Informe o título do aviso.")
    .max(200, "Título acima do limite de 200 caracteres."),
  mensagem: z
    .string()
    .trim()
    .min(1, "Informe a mensagem do aviso.")
    .max(2000, "Mensagem acima do limite de 2000 caracteres."),
  expiraEm: z.string().datetime({ offset: true }).nullable().optional(),
});

export type AvisoTipo = z.infer<typeof avisoTipoSchema>;
export type Aviso = z.infer<typeof avisoSchema>;
export type AvisosResponse = z.infer<typeof avisosResponseSchema>;
export type PublicarAvisoInput = z.infer<typeof publicarAvisoSchema>;
