import { z } from "zod";

// Contrato da API de avisos/notificações in-app entre Worker e frontend.
// "aviso" é publicado pelo admin; "evento" é gerado pelo sistema.
// Avisos são registro permanente (sem expiração e sem inativação, decisão
// de 12/11/2026); "lojas" null significa todas as lojas.
// Limites de texto são hardening do input (spec 2026-11-11, decisão 9).

export const avisoTipoSchema = z.enum(["aviso", "evento"]);

const avisoLojaCodigo = z
  .string()
  .trim()
  .min(1, "Código de loja inválido.")
  .max(10, "Código de loja inválido.");

export const avisoLojasSchema = z
  .array(avisoLojaCodigo)
  .max(20, "Escolha no máximo 20 lojas.");

export const avisoSchema = z.object({
  id: z.string(),
  tipo: avisoTipoSchema,
  titulo: z.string(),
  mensagem: z.string(),
  criadoEm: z.string(),
  lido: z.boolean(),
  urgente: z.boolean(),
  autor: z.string(),
  lojas: z.array(z.string()).nullable(),
});

export const avisosResponseSchema = z.object({
  avisos: z.array(avisoSchema),
  naoLidos: z.number().int().nonnegative(),
});

// Corpo do POST /api/admin/avisos. "lojas" null (ou omitido) publica para
// todas as lojas; um array publica apenas para as lojas escolhidas.
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
  urgente: z.boolean().optional().default(false),
  lojas: avisoLojasSchema.nullable().optional().default(null),
});

export type AvisoTipo = z.infer<typeof avisoTipoSchema>;
export type Aviso = z.infer<typeof avisoSchema>;
export type AvisosResponse = z.infer<typeof avisosResponseSchema>;
export type PublicarAvisoInput = z.infer<typeof publicarAvisoSchema>;
