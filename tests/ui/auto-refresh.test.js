import { describe, expect, it, vi } from "vitest";
import { observeGet, hasViewChanged } from "../../public/vanilla/features/auto-refresh.js";

describe("atualizacao automatica sem piscar", () => {
  it("observa somente GETs e nao guarda respostas de mutacoes", async () => {
    const capture = [];
    const api = vi.fn(async () => ({ rows: [1] }));
    const observed = observeGet(api, item => capture.push(item));
    await observed("/api/admin/agendas?date=2026-10-18");
    await observed("/api/admin/appointments/1", { method: "PATCH" });
    expect(capture).toEqual([{ url: "/api/admin/agendas?date=2026-10-18", signature: '{"rows":[1]}' }]);
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("nao re-renderiza quando a consulta traz os mesmos dados", async () => {
    const current = [{ url: "/api/store/today", signature: '{"agenda":1,"status":"aguardando"}' }];
    const api = vi.fn(async () => ({ agenda: 1, status: "aguardando" }));
    expect(await hasViewChanged(current, api)).toBe(false);
    expect(api).toHaveBeenCalledOnce();
  });

  it("re-renderiza quando chega uma mudanca real", async () => {
    const current = [{ url: "/api/store/today", signature: '{"agenda":1,"status":"aguardando"}' }];
    expect(await hasViewChanged(current, async () => ({ agenda: 1, status: "recebido" }))).toBe(true);
  });

  it("nao refaz a tela sem consultas observadas e preserva erros para o chamador", async () => {
    const api = vi.fn();
    expect(await hasViewChanged([], api)).toBe(false);
    expect(api).not.toHaveBeenCalled();
    await expect(hasViewChanged([{ url: "/api/store/today", signature: "{}" }], async () => {
      throw new Error("Sem conexao");
    })).rejects.toThrow("Sem conexao");
  });
});
