import { normalizeStoreCode } from "./store";
import { z } from "zod";

export const CreateStoreInput = z.object({
  codigo: z.string().trim().min(1).max(20).transform(normalizeStoreCode),
  nome: z.string().trim().min(1).max(120),
});

export const UpdateStoreInput = z
  .object({
    id: z.string().uuid(),
    codigo: z.string().trim().min(1).max(20).transform(normalizeStoreCode).optional(),
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

export const UserRoleInput = z.enum(["admin", "conferente", "visualizador"]);

export const CreateUserInput = z
  .object({
    nome: z.string().trim().min(1).max(120),
    login: z.string().trim().min(3).max(100),
    senha: z.string().min(12).max(200),
    papel: UserRoleInput.default("conferente"),
    lojaId: z.string().uuid().optional(),
  })
  .superRefine((value, context) => {
    if (value.papel === "conferente" && !value.lojaId) {
      context.addIssue({
        code: "custom",
        path: ["lojaId"],
        message: "Loja é obrigatória para conferente.",
      });
    }
  });

export const RegisterFirstAdminInput = z.object({
  nome: z.string().trim().min(1).max(120),
  login: z.string().trim().min(3).max(100),
  senha: z.string().min(12).max(200),
});

export const UpdateUserInput = z
  .object({
    id: z.string().uuid(),
    nome: z.string().trim().min(1).max(120).optional(),
    login: z.string().trim().min(3).max(100).optional(),
    senha: z.string().min(12).max(200).optional(),
    papel: UserRoleInput.optional(),
    lojaId: z.string().uuid().optional(),
    ativo: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.nome !== undefined ||
      value.login !== undefined ||
      value.senha !== undefined ||
      value.papel !== undefined ||
      value.lojaId !== undefined ||
      value.ativo !== undefined,
    { message: "Nenhuma alteração informada." },
  );

// Aliases temporários para consumidores antigos durante o rollout.
export const CreateStoreUserInput = CreateUserInput;
export const UpdateStoreUserInput = UpdateUserInput;
