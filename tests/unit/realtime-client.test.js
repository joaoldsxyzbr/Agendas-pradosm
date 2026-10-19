import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRealtimeClient, isRealtimeServerEvent, PING_INTERVAL_MS, PONG_TIMEOUT_MS } from "../../frontend/realtime.js";
import { createStorePresence, HEARTBEAT_MS, REALTIME_IDLE_MS } from "../../frontend/presence.js";
import { isAgendaChangedReason } from "../../shared/realtime.js";
import { readFileSync } from "node:fs";

class Socket {
  static OPEN = 1; static CONNECTING = 0; static instances = [];
  constructor(url) { this.url = url; this.readyState = 0; this.sent = []; Socket.instances.push(this); }
  send(data) { this.sent.push(data); }
  close(code = 1000) { this.readyState = 3; this.onclose?.({ code }); }
  open() { this.readyState = 1; this.onopen?.(); }
  message(data) { this.onmessage?.({ data }); }
}
function clock() {
  let id = 0;
  const entries = new Map();
  return {
    entries,
    setInterval(fn, ms) { const key = ++id; entries.set(key, { fn, ms }); return key; },
    clearInterval(key) { entries.delete(key); },
    setTimeout(fn, ms) { const key = ++id; entries.set(key, { fn, ms }); return key; },
    clearTimeout(key) { entries.delete(key); }
  };
}
function events() {
  const handlers = new Map();
  return {
    addEventListener(type, callback) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(callback);
    },
    removeEventListener(type, callback) { handlers.get(type)?.delete(callback); }
  };
}

describe("WebSocket da main em ES Modules", () => {
  it("conserva o protocolo e rejeita eventos inválidos", () => {
    assert.equal(PING_INTERVAL_MS, 30000);
    assert.equal(PONG_TIMEOUT_MS, 10000);
    assert.equal(isRealtimeServerEvent({ version: 1, type: "realtime.ready" }), true);
    assert.equal(isRealtimeServerEvent({ version: 2, type: "realtime.ready" }), false);
    assert.equal(isRealtimeServerEvent({ version: 1, type: "presence.changed", storeId: "F03", status: "online" }), true);
    assert.equal(isRealtimeServerEvent({ version: 1, type: "presence.changed", storeId: "F03", status: "desconhecido" }), false);
    const event = { version: 1, type: "agenda.changed", agendaId: "agenda1", storeId: "loja1", date: "2026-10-19", reason: "observation" };
    assert.equal(isAgendaChangedReason("observation"), true);
    assert.equal(isAgendaChangedReason("desconhecido"), false);
    assert.equal(isRealtimeServerEvent(event), true);
    assert.equal(isRealtimeServerEvent({ ...event, reason: "desconhecido" }), false);
    const hub = readFileSync(new URL("../../worker/realtime/RealtimeHub.js", import.meta.url), "utf8");
    assert.match(hub, /isAgendaChangedReason/);
    assert.match(hub, /shared\/realtime\.js/);
  });
  it("estabelece conexão, entrega eventos e limpa timers ao sair", async () => {
    Socket.instances.length = 0;
    const timers = clock();
    const client = createRealtimeClient({
      request: async () => ({ mode: "on", protocolVersion: 1 }),
      Socket, location: { href: "https://agenda.example/app", protocol: "https:" }, timers
    });
    const received = [];
    client.onEvent(event => received.push(event));
    await client.start("user1");
    const socket = Socket.instances[0];
    assert.equal(socket.url, "wss://agenda.example/api/realtime");
    socket.open();
    socket.message(JSON.stringify({ version: 1, type: "realtime.ready" }));
    assert.equal(client.state.status, "connected");
    socket.message(JSON.stringify({ version: 1, type: "presence.changed", storeId: "a", status: "online" }));
    socket.message(JSON.stringify({ version: 1, type: "agenda.changed", agendaId: "agenda1", storeId: "loja1", date: "2026-10-19", reason: "observation" }));
    assert.equal(received.at(-1).reason, "observation");
    assert.equal(received.at(-1).type, "presence.changed");
    assert.equal(client.send({ version: 1, type: "presence.heartbeat" }), true);
    client.stop();
    assert.equal(timers.entries.size, 0);
    assert.equal(client.send({ version: 1, type: "presence.heartbeat" }), false);
  });
  it("não tenta reconectar após revogação 4003", async () => {
    Socket.instances.length = 0;
    const timers = clock();
    const client = createRealtimeClient({
      request: async () => ({ mode: "on", protocolVersion: 1 }),
      Socket, location: { href: "https://agenda.example/app", protocol: "https:" }, timers
    });
    await client.start("user1");
    Socket.instances[0].close(4003);
    assert.equal(client.state.status, "disabled");
    assert.equal(timers.entries.size, 0);
    client.stop();
  });
});

describe("Presença do conferente", () => {
  it("mantém heartbeat, estado ausente e logout sem vazamento de timers", async () => {
    const timers = clock();
    const win = { ...events(), ...timers };
    const doc = { ...events(), visibilityState: "visible" };
    const requests = [], outgoing = [];
    let tick = 1000000;
    let change = () => {};
    const realtime = {
      state: { mode: "off", status: "disabled" },
      send(message) { outgoing.push(message); return true; },
      onStatus(fn) { change = fn; return () => { change = () => {}; }; }
    };
    const presence = createStorePresence({
      realtime, win, doc, now: () => tick,
      request: async (path, init) => { requests.push([path, init.method]); }
    });
    presence.start();
    await Promise.resolve();
    assert.equal(HEARTBEAT_MS, 120000);
    assert.equal(REALTIME_IDLE_MS, 30000);
    assert.ok(requests.some(([url, method]) => url === "/api/store/presence" && method === "POST"));
    realtime.state = { mode: "on", status: "connected" }; change();
    assert.ok(outgoing.some(x => x.type === "presence.set" && x.status === "online"));
    tick += 31000;
    for (const timer of [...timers.entries.values()]) if (timer.ms === 5000) timer.fn();
    assert.ok(outgoing.some(x => x.type === "presence.set" && x.status === "away"));
    await presence.disconnect();
    assert.ok(requests.some(([, method]) => method === "DELETE"));
    presence.stop();
    assert.equal(timers.entries.size, 0);
  });
});