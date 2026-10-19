import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adminShell,storeShell } from "../../migration/frontend/shell.js";
import { reportChartConfig } from "../../migration/frontend/report-chart.js";
import { reportInfo } from "../../migration/frontend/report-info.js";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
describe("Chart.js e Lucide Static em JavaScript puro",()=>{
  it("mantém versões fixas e todas as dependências no package-lock",()=>{
    const pkg=JSON.parse(read("../../package.json"));
    const lock=JSON.parse(read("../../package-lock.json"));
    assert.equal(pkg.dependencies["chart.js"],"4.5.1");
    assert.equal(pkg.dependencies["lucide-static"],"1.57.0");
    assert.equal(lock.packages["node_modules/chart.js"].version,"4.5.1");
    assert.equal(lock.packages["node_modules/lucide-static"].version,"1.57.0");
    assert.equal(lock.packages["node_modules/@kurkle/color"].version,"0.3.4");
    assert.equal(lock.packages[""].dependencies["chart.js"],"4.5.1");
    assert.equal(lock.packages[""].dependencies["lucide-static"],"1.57.0");
  });
  it("usa ícones SVG locais nos dois perfis e na ajuda",()=>{
    const admin=adminShell({nome:"Admin",papel:"admin"},"/admin/reports");
    const viewer=adminShell({nome:"Viewer",papel:"visualizador"},"/admin/reports");
    const store=storeShell({nome:"Conferente",lojaNome:"F01"});
    for(const icon of ["layout-dashboard.svg","chart-no-axes-column-increasing.svg","store.svg","users.svg"])
      assert.match(admin,new RegExp(icon.replace(".","\\.")));
    assert.match(viewer,/chart-no-axes-column-increasing\.svg/);
    assert.doesNotMatch(viewer,/users\.svg/);
    assert.match(store,/clipboard-check\.svg/);
    assert.match(reportInfo("Comparativo por loja"),/\/vendor\/lucide\/info\.svg/);
  });
  it("gera séries empilhadas com valores corretos",()=>{
    const cfg=reportChartConfig([
      {date:"2026-10-18",recebido:3,naoChegou:1,aguardando:2,semConferencia:0,recusado:0},
      {date:"2026-10-19",recebido:7,naoChegou:0,aguardando:0,semConferencia:1,recusado:1}
    ]);
    assert.equal(cfg.type,"bar");
    assert.deepEqual(cfg.data.labels,["18/10","19/10"]);
    assert.deepEqual(cfg.data.datasets.map(d=>d.data),[[3,7],[1,0],[2,0],[0,1],[0,1]]);
    assert.equal(cfg.options.scales.x.stacked,true);
    assert.equal(cfg.options.scales.y.stacked,true);
    assert.equal(cfg.options.animation,false);
  });
  it("empacota bibliotecas locais sem CDN, com fallback e liberação do gráfico",()=>{
    const build=read("../../scripts/build-native.mjs");
    const reports=read("../../migration/frontend/reports.js");
    const loader=read("../../migration/frontend/report-chart.js");
    assert.match(build,/node_modules\/chart\.js\/dist\/chart\.umd\.min\.js/);
    assert.match(build,/node_modules\/lucide-static\/icons/);
    assert.match(read("../../index.html"),/\/src\/vendor-ui\.css/);
    assert.match(build,/"vendor-ui\.css"/);
    assert.match(loader,/script\.src = "\/vendor\/chart\.umd\.min\.js"/);
    assert.match(reports,/data-report-native-chart/);
    assert.match(reports,/mountReportChart\(root,daily/);
    assert.match(reports,/disposeChart\(\)/);
    assert.doesNotMatch(read("../../index.html"),/https?:\/\/(?:cdn|unpkg|jsdelivr)/i);
  });
});