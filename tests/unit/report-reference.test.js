import test from "node:test";
import assert from "node:assert/strict";
import { renderReferenceOverview } from "../../frontend/report-reference.js";

const sum={total:10,recebido:6,naoChegou:2,naoCompareceu:1,aguardando:1,recusado:0};
const daily=[
  {date:"2026-10-27",total:4,recebido:2,naoChegou:1,naoCompareceu:1,aguardando:0,recusado:0},
  {date:"2026-10-28",total:6,recebido:4,naoChegou:1,naoCompareceu:0,aguardando:1,recusado:0}
];
const stores=[
  {code:"F01",name:"Centro",total:6,recebido:4},
  {code:"F02",name:"Sul",total:4,recebido:2}
];
test("visão gerencial usa somente números do período, sem valores estáticos",()=>{
  const html=renderReferenceOverview({
    sum,daily,stores,
    occurrences:{rows:[{date:"2026-10-28",storeCode:"F01",supplier:"Fornecedor Teste",occurrenceType:"nao_compareceu",observation:null}]},
    latest:{rows:[{date:"2026-10-28",time:"08:30",storeCode:"F02",supplier:"Entregas",status:"recebido"}]},
    prior:{total:10,recebido:5}
  });
  assert.match(html,/60%/);
  assert.match(html,/6 de 10 agendamentos/);
  assert.match(html,/\+10% p\.p\./);
  assert.match(html,/Evolução dos recebimentos/);
  assert.match(html,/Distribuição das situações/);
  assert.match(html,/Desempenho por loja/);
  assert.match(html,/Não compareceu/);
  assert.match(html,/Fornecedor Teste/);
  assert.match(html,/Últimos agendamentos/);
  assert.match(html,/Entregas/);
});
test("visão gerencial não injeta HTML de fornecedores",()=>{
  const html=renderReferenceOverview({
    sum,daily,stores,
    occurrences:{rows:[{date:"2026-10-28",storeCode:"F01",supplier:"<script>alert(1)</script>",occurrenceType:"nao_recebido",observation:"<img src=x onerror=alert(1)>"}]},
    latest:{rows:[{date:"2026-10-28",time:"10:00",storeCode:"F01",supplier:"<b>Fornecedor</b>",status:"aguardando"}]}
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("<b>Fornecedor</b>"));
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/&lt;b&gt;Fornecedor&lt;\/b&gt;/);
});
test("visão gerencial em período vazio exibe estados vazios",()=>{
  const html=renderReferenceOverview({
    sum:{total:0,recebido:0,naoChegou:0,naoCompareceu:0,aguardando:0,recusado:0},
    daily:[],stores:[],occurrences:{rows:[]},latest:{rows:[]}
  });
  assert.match(html,/Sem agendamentos no período/);
  assert.match(html,/Nenhuma ocorrência no período/);
  assert.match(html,/Nenhum agendamento recente no período/);
  assert.ok(!html.includes("NaN"));
  assert.ok(!html.includes("Infinity"));
});
