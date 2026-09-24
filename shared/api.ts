import { z } from "zod";

export const CreateStoreInput = z.object({
  codigo: z.string().trim().min(1).max(20),
  nome: z.string().trim().min(1).max(120),
});

export const UpdateStoreInput = z
  .object({
    id: z.string().uuid(),
    codigo: z.string().trim().min(1).max(20).optional(),
    nome: z.string().trim().min(1).max(120).optional(),
    ativo: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.codigo !== undefined ||
      value.nome !== undefined ||
      value.ativo !== undefined,
    { message: "Nenhuma alteração informada." },
  );

export const CreateStoreUserInput = z.object({
  nome: z.string().trim().min(1).max(120),
  login: z.string().trim().min(3).max(100),
  senha: z.string().min(8).max(200),
  lojaId: z.string().uuid(),
});

export const RegisterFirstAdminInput = z.object({
  nome: z.string().trim().min(1).max(120),
  login: z.string().trim().min(3).max(100),
  senha: z.string().min(12).max(200),
});

export const UpdateStoreUserInput = z
  .object({
    id: z.string().uuid(),
    nome: z.string().trim().min(1).max(120).optional(),
    login: z.string().trim().min(3).max(100).optional(),
    senha: z.string().min(8).max(200).optional(),
    lojaId: z.string().uuid().optional(),
    ativo: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.nome !== undefined ||
      value.login !== undefined ||
      value.senha !== undefined ||
      value.lojaId !== undefined ||
      value.ativo !== undefined,
    { message: "Nenhuma alteração informada." },
  );
