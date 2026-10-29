import test from "node:test";
import assert from "node:assert/strict";
import { renderReferenceOverview, lastSevenCalendarDays } from "../../frontend/report-reference.js";

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
  assert.match(html,/\+10 p\.p\./);
  assert.match(html,/Evolução dos recebimentos/);
  assert.match(html,/Distribuição das situações/);
  assert.match(html,/Desempenho por loja/);
  assert.match(html,/Não compareceu/);
  assert.match(html,/Fornecedor Teste/);
  assert.match(html,/Agendamentos recentes por data de entrega/);
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


test("sete painéis resumidos possuem ajuda contextual e explicam a ordem por data",()=>{
  const html=renderReferenceOverview({sum,daily,stores,occurrences:{rows:[]},latest:{rows:[]}});
  const expected=[
    "Taxa de recebimento","Evolução dos recebimentos","Distribuição das situações",
    "Desempenho por loja","Agendamentos por situação (por dia)",
    "Ocorrências recentes","Agendamentos recentes por data de entrega"
  ];
  assert.equal((html.match(/class="report-reference-card /g)||[]).length,7);
  assert.equal((html.match(/data-report-info/g)||[]).length,7);
  for(const name of expected)assert.ok(html.includes('aria-label="Sobre: '+name+'"'),name);
  assert.match(html,/Não são necessariamente os últimos cadastrados no sistema/);
  assert.match(html,/aria-expanded="false"/);
});


test("gráfico mostra últimos sete dias corridos do filtro, inclusive datas vazias e virada de mês",()=>{
  const dates=lastSevenCalendarDays(daily,{start:"2026-10-24",end:"2026-10-30"});
  assert.deepEqual(dates.map(x=>x.date),[
    "2026-10-24","2026-10-25","2026-10-26","2026-10-27",
    "2026-10-28","2026-10-29","2026-10-30"
  ]);
  assert.equal(dates[0].total,0);
  assert.equal(dates[3].total,4);
  assert.equal(dates[4].total,6);
  const short=lastSevenCalendarDays([],{start:"2026-10-30",end:"2026-11-02"});
  assert.deepEqual(short.map(x=>x.date),["2026-10-30","2026-10-31","2026-11-01","2026-11-02"]);
  assert.ok(short.every(x=>x.total===0));
  const html=renderReferenceOverview({
    sum,daily,stores,occurrences:{rows:[]},latest:{rows:[]},
    start:"2026-10-24",end:"2026-10-30"
  });
  assert.equal((html.match(/class="report-reference-day"/g)||[]).length,7);
  assert.equal((html.match(/class="report-reference-zero"/g)||[]).length,5);
  assert.match(html,/24\/10: 0 agendamentos/);
  assert.match(html,/30\/10: 0 agendamentos/);
});

test("cards exibem dados relevantes sem tabela de largura fixa ou rolagem horizontal",()=>{
  const html=renderReferenceOverview({
    sum,daily,stores,start:"2026-10-22",end:"2026-10-28",
    occurrences:{rows:[{date:"2026-10-28",storeCode:"F01",supplier:"Fornecedor Teste",occurrenceType:"nao_recebido",observation:"Portão fechado"}]},
    latest:{rows:[{date:"2026-10-28",time:"08:30",storeCode:"F02",supplier:"Distribuidora Exemplo",status:"aguardando"}]}
  });
  assert.doesNotMatch(html,/report-reference-table-scroll/);
  assert.match(html,/report-reference-compact-list/);
  assert.match(html,/Motivo: Portão fechado/);
  assert.match(html,/Origem: Conferente/);
  assert.match(html,/28\/10 · 08:30/);
  assert.match(html,/Ordenados pela data e hora da entrega/);
  assert.match(html,/Agendamentos recentes por data de entrega/);
});
