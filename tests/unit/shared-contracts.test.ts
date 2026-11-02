import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeStoreCode } from "../../shared/store.ts";
import { BUSINESS_TIME_ZONE, businessDate, businessTime } from "../../shared/time.ts";
import { REALTIME_PROTOCOL_VERSION } from "../../shared/realtime.ts";
import { parseAgendaText } from "../../shared/import/parseAgendaText.ts";
import { parseAgendaCsv, parseAgendaPdfText } from "../../shared/import/parseAgendaBatch.ts";

describe("Contratos preservados na migração JS puro", () => {
  it("normalização de códigos de loja", () => {
    assert.equal(normalizeStoreCode("  loja 01  "), "LOJA 01");
  });
  it("data/hora de Brasília e protocolo de tempo real", () => {
    assert.equal(BUSINESS_TIME_ZONE, "America/Sao_Paulo");
    assert.equal(businessDate(new Date("2026-10-18T03:00:00Z")), "2026-10-18");
    assert.equal(businessTime(new Date("2026-10-18T12:35:00Z")), "09:35");
    assert.equal(REALTIME_PROTOCOL_VERSION, 1);
  });
  it("parsings inválidos preservam lista de erros e avisos", () => {
    const parsed = [
      parseAgendaText("texto sem agenda"),
      parseAgendaCsv("texto sem colunas reconhecidas"),
      parseAgendaPdfText("texto sem agenda")
    ];
    for (const item of parsed) {
      assert.ok(Array.isArray(item.blockingErrors));
      assert.ok(Array.isArray(item.warnings));
    }
    assert.ok(Array.isArray(parsed[1].agendas));
    assert.ok(Array.isArray(parsed[2].agendas));
  });
});