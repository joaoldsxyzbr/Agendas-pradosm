import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  agendaCalendarDays, parseAgendaDate, toIsoDate
} from "../../frontend/agenda-date-picker.js";
import {
  millisecondsUntilNextBusinessDate, createBusinessDateMonitor
} from "../../frontend/business-date.js";

describe("Calendário da agenda da main", () => {
  it("mantém exatamente 42 dias, dias fora do mês e seleção", () => {
    const feb = agendaCalendarDays(2028, 2, "2028-02-29", "2028-02-28");
    assert.equal(feb.length, 42);
    assert.equal(feb.find(day => day.iso === "2028-02-29").selected, true);
    assert.equal(feb.find(day => day.iso === "2028-02-28").today, true);
    assert.ok(feb.some(day => day.outside));
    assert.deepEqual(parseAgendaDate("2028-02-29"), { year: 2028, month: 2, day: 29 });
    assert.equal(toIsoDate(2028, 2, 9), "2028-02-09");
  });
  it("passa corretamente de dezembro para janeiro", () => {
    const jan = agendaCalendarDays(2027, 1, "2027-01-01", "2027-01-01");
    assert.ok(jan.some(day => day.iso.startsWith("2026-12-") && day.outside));
  });
});
describe("Virada do dia operacional em America/Sao_Paulo", () => {
  it("agenda renovação após a meia-noite local", () => {
    assert.equal(millisecondsUntilNextBusinessDate(new Date("2026-10-18T02:59:59Z")), 1000);
    assert.equal(millisecondsUntilNextBusinessDate(new Date("2026-10-18T03:00:00Z")), 86400000);
  });
  it("notifica o próximo dia e limpa temporizador e ouvintes", () => {
    const listeners = new Map();
    const tasks = new Map();
    let seq = 0;
    let now = new Date("2026-10-18T02:59:58Z");
    const timers = {
      setTimeout(fn) { const id = ++seq; tasks.set(id, fn); return id; },
      clearTimeout(id) { tasks.delete(id); },
      addEventListener(name, fn) { listeners.set(name, fn); },
      removeEventListener(name) { listeners.delete(name); }
    };
    const doc = {
      visibilityState: "visible",
      addEventListener(name, fn) { listeners.set(name, fn); },
      removeEventListener(name) { listeners.delete(name); }
    };
    const received = [];
    const monitor = createBusinessDateMonitor({
      now: () => now, timers, doc, onChange: date => received.push(date)
    });
    monitor.start();
    assert.equal(monitor.today, "2026-10-17");
    now = new Date("2026-10-18T03:00:02Z");
    [...tasks.values()][0]();
    assert.deepEqual(received, ["2026-10-18"]);
    assert.equal(monitor.today, "2026-10-18");
    monitor.stop();
    assert.equal(tasks.size, 0);
    assert.equal(listeners.size, 0);
  });
});