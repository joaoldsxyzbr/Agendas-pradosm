import { normalizeStoreCode } from "./store.js";
import { z } from "zod";
const CreateStoreInput = z.object({
  codigo: z.string().trim().min(1).max(20).transform(normalizeStoreCode),
  nome: z.string().trim().min(1).max(120)
});
const UpdateStoreInput = z.object({
  id: z.string().uuid(),
  codigo: z.string().trim().min(1).max(20).transform(normalizeStoreCode).optional(),
  nome: z.string().trim().min(1).max(120).optional(),
  ativo: z.boolean().optional()
}).refine(
  (value) => value.codigo !== void 0 || value.nome !== void 0 || value.ativo !== void 0,
  { message: "Nenhuma altera\xE7\xE3o informada." }
);
const UserRoleInput = z.enum(["admin", "conferente", "visualizador"]);
const CreateUserInput = z.object({
  nome: z.string().trim().min(1).max(120),
  login: z.string().trim().min(3).max(100),
  senha: z.string().min(12).max(200),
  papel: UserRoleInput.default("conferente"),
  lojaId: z.string().uuid().optional()
}).superRefine((value, context) => {
  if (value.papel === "conferente" && !value.lojaId) {
    context.addIssue({
      code: "custom",
      path: ["lojaId"],
      message: "Loja \xE9 obrigat\xF3ria para conferente."
    });
  }
});
const RegisterFirstAdminInput = z.object({
  nome: z.string().trim().min(1).max(120),
  login: z.string().trim().min(3).max(100),
  senha: z.string().min(12).max(200)
});
const UpdateUserInput = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(1).max(120).optional(),
  login: z.string().trim().min(3).max(100).optional(),
  senha: z.string().min(12).max(200).optional(),
  papel: UserRoleInput.optional(),
  lojaId: z.string().uuid().optional(),
  ativo: z.boolean().optional()
}).refine(
  (value) => value.nome !== void 0 || value.login !== void 0 || value.senha !== void 0 || value.papel !== void 0 || value.lojaId !== void 0 || value.ativo !== void 0,
  { message: "Nenhuma altera\xE7\xE3o informada." }
);
const CreateStoreUserInput = CreateUserInput;
const UpdateStoreUserInput = UpdateUserInput;
export {
  CreateStoreInput,
  CreateStoreUserInput,
  CreateUserInput,
  RegisterFirstAdminInput,
  UpdateStoreInput,
  UpdateStoreUserInput,
  UpdateUserInput,
  UserRoleInput
};