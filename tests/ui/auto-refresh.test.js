import { describe, expect, it, vi } from "vitest";
import { observeGet, hasViewChanged, incrementalRoot, patchMarkup } from "../../public/vanilla/features/auto-refresh.js";

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
describe("DOM incremental no refresh", () => {
  it("mantem a tela e o scroll, alterando somente os valores realmente modificados", () => {
    const host = document.createElement("main");
    host.innerHTML = '<section class="dashboard"><h1>Recebimento</h1><div class="stats"><strong>3</strong></div><table><tbody><tr data-store-id="a"><td>Loja A</td><td>3</td></tr><tr data-store-id="b"><td>Loja B</td><td>4</td></tr></tbody></table></section>';
    document.body.appendChild(host);
    const heading = host.querySelector("h1");
    const unchanged = host.querySelector('[data-store-id="b"]');
    const cell = host.querySelector('[data-store-id="a"] td:last-child');
    const screen = host.querySelector("section");
    host.scrollTop = 40;
    const proxy = incrementalRoot(host);
    proxy.innerHTML = '<section class="dashboard"><h1>Recebimento</h1><div class="stats"><strong>4</strong></div><table><tbody><tr data-store-id="a"><td>Loja A</td><td>4</td></tr><tr data-store-id="b"><td>Loja B</td><td>4</td></tr></tbody></table></section>';
    expect(host.querySelector("section")).toBe(screen);
    expect(host.querySelector("h1")).toBe(heading);
    expect(host.querySelector('[data-store-id="a"] td:last-child')).toBe(cell);
    expect(host.querySelector('[data-store-id="b"]')).toBe(unchanged);
    expect(cell.textContent).toBe("4");
    expect(host.scrollTop).toBe(40);
    host.remove();
  });

  it("adiciona, remove e reordena agendamentos sem destruir linhas inalteradas", () => {
    const host = document.createElement("div");
    host.innerHTML = '<table><tbody><tr data-appointment-id="a"><td>A</td><td><button>Ver</button></td></tr><tr data-appointment-id="b"><td>B</td><td>1</td></tr></tbody></table>';
    document.body.append(host);
    const a = host.querySelector('[data-appointment-id="a"]');
    const button = a.querySelector("button");
    let clicks = 0;
    button.onclick = () => clicks++;
    patchMarkup(host, '<table><tbody><tr data-appointment-id="b"><td>B</td><td>2</td></tr><tr data-appointment-id="a"><td>A</td><td><button>Ver</button></td></tr><tr data-appointment-id="c"><td>C</td><td>3</td></tr></tbody></table>');
    expect([...host.querySelectorAll("tr")].map(node => node.dataset.appointmentId)).toEqual(["b","a","c"]);
    expect(host.querySelector('[data-appointment-id="a"]')).toBe(a);
    expect(host.querySelector('[data-appointment-id="a"] button')).toBe(button);
    button.click();
    expect(clicks).toBe(1);
    expect(host.querySelector('[data-appointment-id="b"] td:last-child').textContent).toBe("2");
    patchMarkup(host, '<table><tbody><tr data-appointment-id="a"><td>A</td><td><button>Ver</button></td></tr></tbody></table>');
    expect(host.querySelectorAll("tr")).toHaveLength(1);
    expect(host.querySelector('[data-appointment-id="a"]')).toBe(a);
    host.remove();
  });

  it("preserva o campo em foco e repassa metodos de DOM para o elemento real", () => {
    const host = document.createElement("div");
    host.innerHTML = '<form><input value="digitando"><button>Salvar</button></form>';
    document.body.append(host);
    const current = host.querySelector("input");
    current.focus();
    current.value = "texto do usuario";
    const proxy = incrementalRoot(host);
    expect(proxy.querySelector("input")).toBe(current);
    proxy.innerHTML = '<form><input value="novo valor do servidor"><button>Salvar</button></form>';
    expect(host.querySelector("input")).toBe(current);
    expect(document.activeElement).toBe(current);
    expect(current.value).toBe("texto do usuario");
    host.remove();
  });
});
