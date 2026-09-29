import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { CreateStoreInput, UpdateStoreInput } from "../../shared/api";
import { findStoreByCode } from "../../worker/repositories/agendas";

const db = (env as unknown as { DB: D1Database }).DB;
const now = "2026-09-29T15:00:00.000Z";

describe("store code hardening", () => {
  it("normaliza codigo de loja na entrada da API", () => {
    expect(
      CreateStoreInput.parse({ codigo: " f03 ", nome: "Canasvieiras" }).codigo,
    ).toBe("F03");

    expect(
      UpdateStoreInput.parse({
        id: "10000000-0000-4000-8000-000000000099",
        codigo: " f04 ",
      }).codigo,
    ).toBe("F04");
  });

  it("encontra codigo legado sem diferenciar maiusculas e minusculas", async () => {
    await db
      .prepare(
        "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind("store-code-legacy", "f91", "Loja Legada", now, now)
      .run();

    const store = await findStoreByCode(db, "F91");

    expect(store).toMatchObject({
      id: "store-code-legacy",
      codigo: "f91",
    });
  });

  it("impede codigos duplicados apenas por diferenca de caixa", async () => {
    await db
      .prepare(
        "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind("store-code-upper", "F92", "Loja Upper", now, now)
      .run();

    await expect(
      db
        .prepare(
          "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
        )
        .bind("store-code-lower", "f92", "Loja Lower", now, now)
        .run(),
    ).rejects.toThrow();
  });
});
