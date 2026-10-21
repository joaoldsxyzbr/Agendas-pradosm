import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readCsvText } from "../../frontend/import/readCsvText.js";
import { parseAgendaCsv } from "../../frontend/import/parseAgendaBatch.js";
import { buildImportPayload, canConfirmImport } from "../../frontend/import-agenda.js";

const source = readFileSync(new URL("../fixtures/agenda-todas-lojas-real-sanitizada.csv", import.meta.url));
const sourceWithDock = readFileSync(new URL("../fixtures/agenda-todas-lojas-com-doca-sanitizada.csv", import.meta.url));
const asFile = bytes => new Blob([bytes], { type: "text/csv" });
const checkParsed = parsed => {
  assert.equal(parsed.totalAppointments, 4);
  assert.deepEqual(parsed.agendas.map(a => a.storeCode), ["CD", "F01", "F08"]);
  assert.deepEqual(parsed.blockingErrors, []);
  assert.ok(canConfirmImport({ name: "agenda.csv" }, parsed));
  const payload = buildImportPayload({ name: "agenda.csv" }, parsed);
  assert.equal(payload.agendas.reduce((sum,a)=>sum+a.appointments.length,0),4);
  assert.equal(payload.agendas[0].appointments[0].status, undefined);
};
describe("Compatibilidade CSV do importador — decodificação nativa", () => {
  it("interpreta UTF-8 da agenda exportada", async () => {
    checkParsed(parseAgendaCsv(await readCsvText(asFile(source))));
  });
  it("interpreta CSV ANSI Windows-1252 sem corromper à e Ç", async () => {
    const bytes = Buffer.from(source.toString("utf8"), "latin1");
    const text = await readCsvText(asFile(bytes));
    assert.match(text, /às/);
    assert.match(text, /BIGUAÇU/);
    checkParsed(parseAgendaCsv(text));
  });
  it("interpreta UTF-16LE com BOM", async () => {
    const bytes = Buffer.concat([Buffer.from([0xff,0xfe]), Buffer.from(source.toString("utf8"), "utf16le")]);
    checkParsed(parseAgendaCsv(await readCsvText(asFile(bytes))));
  });
  it("interpreta UTF-16BE com BOM", async () => {
    const le = Buffer.from(source.toString("utf8"), "utf16le");
    const be = Buffer.alloc(le.length + 2);
    be[0] = 0xfe;be[1] = 0xff;
    for(let i=0;i<le.length;i+=2){be[i+2] = le[i+1];be[i+3] = le[i];}
    checkParsed(parseAgendaCsv(await readCsvText(asFile(be))));
  });
  it("mantém suporte a BOM, CR e docas múltiplas", async () => {
    const result = parseAgendaCsv(await readCsvText(asFile(sourceWithDock)));
    assert.deepEqual(result.blockingErrors, []);
    assert.equal(result.totalAppointments, 4);
    assert.deepEqual(result.agendas.map(a=>a.storeCode),["CD DOCA 01","CD DOCA 02","F01","F08"]);
  });
  it("bloqueia CSV sem colunas exigidas e nunca gera payload parcial", () => {
    const parsed = parseAgendaCsv("Qualquer;Coisa\n1;2\n");
    assert.ok(parsed.blockingErrors.includes("FORMATO_CSV_NAO_RECONHECIDO"));
    assert.equal(canConfirmImport({name:"ruim.csv"},parsed),false);
    assert.equal(buildImportPayload({name:"ruim.csv"},parsed),null);
  });
});
