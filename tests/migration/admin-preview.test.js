import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");

describe("Popup administrativo: contrato com a main",()=>{
  const popup=source("../../migration/frontend/admin-agenda-preview.js");
  const modal=source("../../migration/frontend/admin-manual-dialog.js");
  it("abre consulta sem autorizar edição automaticamente",()=>{
    assert.match(popup,/let reopening=false,search="",list=null,manualClose=null/);
    assert.match(popup,/editMode=false/);
    assert.match(popup,/const effectiveEditable=\(\)=>canEdit&&editMode/);
    assert.match(popup,/Somente leitura/);
    assert.match(popup,/Editar agenda/);
    assert.match(popup,/Sair da edição/);
  });
  it("preserva reabertura, fornecedor manual e status/trocas por perfis",()=>{
    assert.match(popup,/canReopen&&editMode&&completed/);
    assert.match(popup,/status:"aberto"/);
    assert.match(popup,/appointmentApiBase:"\/api\/admin\/appointments"/);
    assert.match(popup,/highlightPositiveExchanges:true/);
    assert.match(popup,/onDeleteManual:effectiveEditable\(\)\?item=>openManual\(item,true\):null/);
    for(const endpoint of ["/api/admin/appointments/","/api/admin/agendas/",
      'method:"DELETE"','method:editing?"PATCH":"POST"']) assert.ok(modal.includes(endpoint),endpoint);
  });
  it("atualiza conteúdo sem recriar backdrop a cada evento WebSocket",()=>{
    assert.match(popup,/event\.type==="agenda.changed"/);
    assert.match(popup,/load\(true\)/);
    assert.match(popup,/if\(list\)list\.update\(filtered,opts\)/);
    assert.match(popup,/agenda-preview-modal/);
    assert.match(popup,/Visualização do conferente/);
    assert.doesNotMatch(popup,/PREVIEW_DEMO_LOGIN|observacao/);
  });
});
