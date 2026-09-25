import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const db = (env as unknown as { DB: D1Database }).DB;
const passwordHash =
  "pbkdf2_sha256$100000$AAECAwQFBgcICQoLDA0ODw==$AYxgQLgLfLPsbb0egTJrnCsUalhEK5g5ZPOz/f7bl64=";
const password = "senha-segura-123";
const now = "2026-09-24T12:00:00.000Z";

async function seedAdmin(id: string, login: string) {
  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) VALUES (?, NULL, ?, ?, ?, 'admin', 1, ?, ?)",
    )
    .bind(id, `Admin ${id}`, login, passwordHash, now, now)
    .run();
}

async function seedStoreUser(input: {
  userId: string;
  login: string;
  storeId: string;
  storeCode: string;
}) {
  await db
    .prepare(
      "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(input.storeId, input.storeCode, `Loja ${input.storeCode}`, now, now)
    .run();

  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, 'loja', 1, ?, ?)",
    )
    .bind(
      input.userId,
      input.storeId,
      `Usuário ${input.userId}`,
      input.login,
      passwordHash,
      now,
      now,
    )
    .run();
}

async function login(loginValue: string, senha = password) {
  return exports.default.fetch(
    new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: loginValue, senha }),
    }),
  );
}

function cookiePair(response: Response) {
  const cookie = response.headers.get("Set-Cookie");
  expect(cookie).toBeTruthy();
  return cookie!.split(";")[0];
}

async function adminCookie(id: string, loginValue: string) {
  await seedAdmin(id, loginValue);
  return cookiePair(await login(loginValue));
}

function jsonRequest(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  cookie: string,
  body?: unknown,
) {
  return exports.default.fetch(
    new Request(`https://example.com${url}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Cookie: cookie,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

async function createManagedUser(
  cookie: string,
  storeCode: string,
  loginValue: string,
) {
  const storeResponse = await jsonRequest("/api/admin/stores", "POST", cookie, {
    codigo: storeCode,
    nome: `Loja ${storeCode}`,
  });
  expect(storeResponse.status).toBe(201);
  const store = (await storeResponse.json()) as { id: string };

  const userResponse = await jsonRequest("/api/admin/users", "POST", cookie, {
    nome: `Usuário ${storeCode}`,
    login: loginValue,
    senha: password,
    lojaId: store.id,
  });
  expect(userResponse.status).toBe(201);
  const user = (await userResponse.json()) as {
    id: string;
    login: string;
    lojaId: string;
  };

  return { store, user };
}

describe("admin store and user management", () => {
  it("admin cria loja", async () => {
    const cookie = await adminCookie("admin-create-store", "admin-create-store");

    const response = await jsonRequest("/api/admin/stores", "POST", cookie, {
      codigo: "F90",
      nome: "Loja Norte",
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      codigo: "F90",
      nome: "Loja Norte",
      ativo: true,
    });
  });

  it("codigo de loja duplicado retorna 409", async () => {
    const cookie = await adminCookie("admin-dup-store", "admin-dup-store");

    const first = await jsonRequest("/api/admin/stores", "POST", cookie, {
      codigo: "F91",
      nome: "Loja Um",
    });
    expect(first.status).toBe(201);

    const duplicate = await jsonRequest("/api/admin/stores", "POST", cookie, {
      codigo: "F91",
      nome: "Loja Dois",
    });

    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ error: "CODIGO_LOJA_EM_USO" });
  });

  it("admin cria usuário de loja vinculado", async () => {
    const cookie = await adminCookie("admin-create-user", "admin-create-user");

    const storeResponse = await jsonRequest("/api/admin/stores", "POST", cookie, {
      codigo: "F92",
      nome: "Loja Usuário",
    });
    const store = (await storeResponse.json()) as { id: string };

    const response = await jsonRequest("/api/admin/users", "POST", cookie, {
      nome: "Conferente Teste",
      login: "conferente-f92",
      senha: password,
      lojaId: store.id,
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      nome: "Conferente Teste",
      login: "conferente-f92",
      perfil: "loja",
      lojaId: store.id,
      ativo: true,
    });
    expect(body).not.toHaveProperty("senha_hash");
  });

  it("usuário de loja sem lojaId retorna 400", async () => {
    const cookie = await adminCookie("admin-user-no-store", "admin-user-no-store");

    const response = await jsonRequest("/api/admin/users", "POST", cookie, {
      nome: "Sem Loja",
      login: "sem-loja",
      senha: password,
    });

    expect(response.status).toBe(400);
  });

  it("login duplicado retorna 409", async () => {
    const cookie = await adminCookie("admin-dup-login", "admin-dup-login");

    const storeResponse = await jsonRequest("/api/admin/stores", "POST", cookie, {
      codigo: "F93",
      nome: "Loja Login",
    });
    const store = (await storeResponse.json()) as { id: string };

    const first = await jsonRequest("/api/admin/users", "POST", cookie, {
      nome: "Usuário Um",
      login: "login-duplicado",
      senha: password,
      lojaId: store.id,
    });
    expect(first.status).toBe(201);

    const duplicate = await jsonRequest("/api/admin/users", "POST", cookie, {
      nome: "Usuário Dois",
      login: "login-duplicado",
      senha: password,
      lojaId: store.id,
    });

    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ error: "LOGIN_EM_USO" });
  });

  it("usuário de loja recebe 403 nas rotas administrativas", async () => {
    await seedStoreUser({
      userId: "store-admin-denied",
      login: "store-admin-denied",
      storeId: "store-denied",
      storeCode: "F94",
    });
    const cookie = cookiePair(await login("store-admin-denied"));

    const response = await jsonRequest("/api/admin/stores", "POST", cookie, {
      codigo: "F95",
      nome: "Não Pode Criar",
    });

    expect(response.status).toBe(403);
  });

  it("desativação impede novo login", async () => {
    const cookie = await adminCookie("admin-deactivate", "admin-deactivate");

    const storeResponse = await jsonRequest("/api/admin/stores", "POST", cookie, {
      codigo: "F96",
      nome: "Loja Desativação",
    });
    const store = (await storeResponse.json()) as { id: string };

    const userResponse = await jsonRequest("/api/admin/users", "POST", cookie, {
      nome: "Usuário Desativável",
      login: "usuario-desativavel",
      senha: password,
      lojaId: store.id,
    });
    const user = (await userResponse.json()) as { id: string };

    const deactivate = await jsonRequest("/api/admin/users", "PATCH", cookie, {
      id: user.id,
      ativo: false,
    });
    expect(deactivate.status).toBe(200);

    const relogin = await login("usuario-desativavel");
    expect(relogin.status).toBe(401);
  });
  it("admin edita login e senha do usuário", async () => {
    const cookie = await adminCookie("admin-edit-user", "admin-edit-user");
    const { user } = await createManagedUser(
      cookie,
      "F97",
      "usuario-edit-user",
    );

    const update = await jsonRequest("/api/admin/users", "PATCH", cookie, {
      id: user.id,
      nome: "Usuário Editado",
      login: "usuario-editado",
      senha: "nova-senha-segura-123",
      lojaId: user.lojaId,
      ativo: true,
    });

    expect(update.status).toBe(200);
    const body = (await update.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      nome: "Usuário Editado",
      login: "usuario-editado",
      ativo: true,
    });
    expect(body).not.toHaveProperty("senha_hash");
    expect((await login("usuario-edit-user")).status).toBe(401);
    expect(
      (await login("usuario-editado", "nova-senha-segura-123")).status,
    ).toBe(200);
  });

  it("editar sem senha preserva a senha atual", async () => {
    const cookie = await adminCookie(
      "admin-edit-no-password",
      "admin-edit-no-password",
    );
    const { user } = await createManagedUser(
      cookie,
      "F98",
      "usuario-keep-password",
    );

    const update = await jsonRequest("/api/admin/users", "PATCH", cookie, {
      id: user.id,
      nome: "Nome Atualizado",
    });

    expect(update.status).toBe(200);
    expect((await login("usuario-keep-password")).status).toBe(200);
  });

  it("login duplicado na edição retorna 409", async () => {
    const cookie = await adminCookie("admin-edit-dup", "admin-edit-dup");

    const storeResponse = await jsonRequest("/api/admin/stores", "POST", cookie, {
      codigo: "F99",
      nome: "Loja Duplicidade",
    });
    const store = (await storeResponse.json()) as { id: string };

    const firstResponse = await jsonRequest("/api/admin/users", "POST", cookie, {
      nome: "Usuário A",
      login: "usuario-dup-a",
      senha: password,
      lojaId: store.id,
    });
    const first = (await firstResponse.json()) as { id: string; login: string };

    const secondResponse = await jsonRequest("/api/admin/users", "POST", cookie, {
      nome: "Usuário B",
      login: "usuario-dup-b",
      senha: password,
      lojaId: store.id,
    });
    const second = (await secondResponse.json()) as { id: string };

    const update = await jsonRequest("/api/admin/users", "PATCH", cookie, {
      id: second.id,
      login: first.login,
    });

    expect(update.status).toBe(409);
    expect(await update.json()).toMatchObject({ error: "LOGIN_EM_USO" });
  });

  it("exclusão lógica remove da lista e impede login", async () => {
    const cookie = await adminCookie("admin-delete-user", "admin-delete-user");
    const { user } = await createManagedUser(
      cookie,
      "F100",
      "usuario-delete",
    );

    const deleted = await jsonRequest(
      `/api/admin/users/${user.id}`,
      "DELETE",
      cookie,
    );
    expect(deleted.status).toBe(204);

    const list = await exports.default.fetch(
      new Request("https://example.com/api/admin/users", {
        headers: { Cookie: cookie },
      }),
    );
    const users = (await list.json()) as Array<{ id: string }>;
    expect(users.some((item) => item.id === user.id)).toBe(false);
    expect((await login(user.login)).status).toBe(401);

    const stored = await db
      .prepare(
        "SELECT ativo, excluido_em FROM usuarios WHERE id = ? LIMIT 1",
      )
      .bind(user.id)
      .first<{ ativo: number; excluido_em: string | null }>();

    expect(stored?.ativo).toBe(0);
    expect(stored?.excluido_em).toBeTruthy();
  });

  it("DELETE de administrador é rejeitado", async () => {
    const adminId = crypto.randomUUID();
    await seedAdmin(adminId, "admin-protected");
    const cookie = cookiePair(await login("admin-protected"));

    const response = await jsonRequest(
      `/api/admin/users/${adminId}`,
      "DELETE",
      cookie,
    );

    expect(response.status).toBe(404);
    expect((await login("admin-protected")).status).toBe(200);
  });

});
