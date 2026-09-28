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

  it("mantem papel unico compativel com escritas legadas", async () => {
    const columns = await db
      .prepare("PRAGMA table_info(usuarios)")
      .all<{ name: string }>();

    expect(columns.results.some((column) => column.name === "papel")).toBe(true);

    const adminId = "role-admin";
    const viewerId = "role-viewer";
    const storeId = "role-store";
    const conferenteId = "role-conferente";

    await db
      .prepare(
        "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind(storeId, "FR01", "Loja Papel", now, now)
      .run();

    await db
      .prepare(
        "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) VALUES (?, NULL, ?, ?, ?, 'admin', 1, ?, ?)",
      )
      .bind(adminId, "Admin Papel", "admin-papel", "hash-admin-original", now, now)
      .run();

    await db
      .prepare(
        "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, 'loja', 1, ?, ?)",
      )
      .bind(
        conferenteId,
        storeId,
        "Conferente Papel",
        "conferente-papel",
        "hash-conferente-original",
        now,
        now,
      )
      .run();

    await db
      .prepare(
        "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) VALUES (?, NULL, ?, ?, ?, 'admin', 1, ?, ?)",
      )
      .bind(viewerId, "Viewer Papel", "viewer-papel", "hash-viewer-original", now, now)
      .run();

    await db
      .prepare(
        "INSERT INTO usuario_permissoes (usuario_id, dashboard_somente_leitura, criado_em, atualizado_em) VALUES (?, 1, ?, ?)",
      )
      .bind(viewerId, now, now)
      .run();

    const admin = await db
      .prepare("SELECT id, senha_hash, papel FROM usuarios WHERE id = ?")
      .bind(adminId)
      .first<{ id: string; senha_hash: string; papel: string }>();
    const conferente = await db
      .prepare("SELECT papel FROM usuarios WHERE id = ?")
      .bind(conferenteId)
      .first<{ papel: string }>();
    const viewer = await db
      .prepare("SELECT id, senha_hash, papel FROM usuarios WHERE id = ?")
      .bind(viewerId)
      .first<{ id: string; senha_hash: string; papel: string }>();

    expect(admin).toMatchObject({
      id: adminId,
      senha_hash: "hash-admin-original",
      papel: "admin",
    });
    expect(conferente?.papel).toBe("conferente");
    expect(viewer).toMatchObject({
      id: viewerId,
      senha_hash: "hash-viewer-original",
      papel: "visualizador",
    });

    const permissionsTable = await db
      .prepare(
        "SELECT 1 AS presente FROM sqlite_master WHERE type = 'table' AND name = 'usuario_permissoes'",
      )
      .first<{ presente: number }>();
    expect(permissionsTable?.presente).toBe(1);

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
        "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) VALUES (?, NULL, ?, ?, ?, 'admin', 1, ?, ?)",
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
