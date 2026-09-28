import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const db = (env as unknown as { DB: D1Database }).DB;
const now = "2026-09-24T12:00:00.000Z";

describe("D1 schema", () => {
  it("impede duas lojas com o mesmo codigo", async () => {
    await db
      .prepare(
        "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind("store-1", "F99", "Loja Teste", now, now)
      .run();

    await expect(
      db
        .prepare(
          "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
        )
        .bind("store-2", "F99", "Outra Loja", now, now)
        .run(),
    ).rejects.toThrow();
  });

  it("marca agendamentos existentes como importados por padrão", async () => {
    const columns = await db
      .prepare("PRAGMA table_info(agendamentos)")
      .all<{ name: string; dflt_value: string | null }>();

    const origin = columns.results.find((column) => column.name === "origem");
    expect(origin).toBeDefined();
    expect(origin?.dflt_value).toContain("importado");
  });

  it("mantem papel unico sem tabela ou gatilhos legados", async () => {
    const columns = await db
      .prepare("PRAGMA table_info(usuarios)")
      .all<{ name: string }>();

    expect(columns.results.some((column) => column.name === "papel")).toBe(true);
    expect(columns.results.some((column) => column.name === "perfil")).toBe(false);

    const permissionsTable = await db
      .prepare(
        "SELECT 1 AS presente FROM sqlite_master WHERE type = 'table' AND name = 'usuario_permissoes'",
      )
      .first<{ presente: number }>();
    expect(permissionsTable).toBeNull();

    const legacyTriggers = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name IN ('trg_usuarios_legacy_papel', 'trg_usuario_permissoes_legacy_visualizador')",
      )
      .all<{ name: string }>();
    expect(legacyTriggers.results).toEqual([]);

    const adminId = "role-admin-final";
    await db
      .prepare(
        "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, NULL, ?, ?, ?, 'admin', 1, ?, ?)",
      )
      .bind(adminId, "Admin Final", "admin-final", "hash-admin-original", now, now)
      .run();

    const admin = await db
      .prepare("SELECT id, senha_hash, papel FROM usuarios WHERE id = ?")
      .bind(adminId)
      .first<{ id: string; senha_hash: string; papel: string }>();

    expect(admin).toMatchObject({
      id: adminId,
      senha_hash: "hash-admin-original",
      papel: "admin",
    });

    await expect(
      db
        .prepare("UPDATE usuarios SET papel = 'gestor' WHERE id = ?")
        .bind(adminId)
        .run(),
    ).rejects.toThrow();
  });

  it("rejeita status fora do conjunto permitido", async () => {
    await db
      .prepare(
        "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind("store-status", "F98", "Loja Status", now, now)
      .run();

    await db
      .prepare(
        "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, NULL, ?, ?, ?, 'admin', 1, ?, ?)",
      )
      .bind("admin-status", "Admin Teste", "admin-status", "hash", now, now)
      .run();

    await db
      .prepare(
        "INSERT INTO agendas (id, loja_id, data_agenda, arquivo_original, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "agenda-status",
        "store-status",
        "2026-09-24",
        "agenda-teste.pdf",
        "admin-status",
        now,
        now,
      )
      .run();

    await expect(
      db
        .prepare(
          "INSERT INTO agendamentos (id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, status, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "appointment-status",
          "agenda-status",
          "99999999",
          "08:00",
          "08:10",
          "Fornecedor Teste",
          "status_invalido",
          now,
          now,
        )
        .run(),
    ).rejects.toThrow();
  });
});
