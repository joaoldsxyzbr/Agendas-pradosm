// Retenção de dados operacionais antigos.
// Regras: historico_status e historico_agenda com mais de 12 meses;
// auditoria com mais de 24 meses. Diagnósticos seguem o pruneDiagnostics (30 dias).
//
// Invariante de segurança: nenhum registro é purgado sem antes ser exportado
// para o bucket R2 de retenção. Sem binding RETENTION_BUCKET disponível,
// a execução apenas contabiliza, emite alerta e NÃO purga.

const DAY_MS = 86400000;
const HISTORICO_RETENCAO_DIAS = 365;
const AUDITORIA_RETENCAO_DIAS = 730;
const LOTE_EXPORTACAO = 500;
const LIMITE_ALERTA_LINHAS_PADRAO = 500000;

const TABELAS_RETENCAO = [
  { tabela: "historico_status", colunaTempo: "alterado_em", retencaoDias: HISTORICO_RETENCAO_DIAS },
  { tabela: "historico_agenda", colunaTempo: "alterado_em", retencaoDias: HISTORICO_RETENCAO_DIAS },
  { tabela: "auditoria", colunaTempo: "criado_em", retencaoDias: AUDITORIA_RETENCAO_DIAS }
];

// Tabelas de maior volume: base da contagem aproximada para o alerta de tamanho.
const TABELAS_CONTAGEM = [
  "agendamentos",
  "historico_status",
  "historico_agenda",
  "auditoria",
  "agenda_digitacao_fornecedor",
  "diagnosticos"
];

function cortePara(now, dias) {
  return new Date(now.getTime() - dias * DAY_MS).toISOString();
}

async function contar(db, sql, valores = []) {
  const row = await db.prepare(sql).bind(...valores).first();
  return Number(row?.total ?? 0);
}

export async function retentionStatus(db) {
  const agora = new Date();
  const tabelas = [];
  for (const spec of TABELAS_RETENCAO) {
    const corte = cortePara(agora, spec.retencaoDias);
    const total = await contar(db, `SELECT COUNT(*) AS total FROM ${spec.tabela}`);
    const expiradas = await contar(
      db,
      `SELECT COUNT(*) AS total FROM ${spec.tabela} WHERE ${spec.colunaTempo} < ?`,
      [corte]
    );
    tabelas.push({
      tabela: spec.tabela,
      colunaTempo: spec.colunaTempo,
      retencaoDias: spec.retencaoDias,
      corte,
      total,
      expiradas
    });
  }
  return { geradoEm: agora.toISOString(), tabelas };
}

async function purgarTabela(db, bucket, spec, corte, runId) {
  let exportados = 0;
  let purgados = 0;
  let lotes = 0;
  while (true) {
    const resultado = await db.prepare(
      `SELECT * FROM ${spec.tabela} WHERE ${spec.colunaTempo} < ?
         ORDER BY ${spec.colunaTempo}, id LIMIT ${LOTE_EXPORTACAO}`
    ).bind(corte).all();
    const registros = resultado.results ?? [];
    if (!registros.length) break;
    lotes += 1;
    const chave = `retencao/${spec.tabela}/${runId}/${String(lotes).padStart(4, "0")}.json`;
    const corpo = JSON.stringify({
      tabela: spec.tabela,
      corte,
      executadoEm: new Date().toISOString(),
      runId,
      lote: lotes,
      quantidade: registros.length,
      registros
    });
    await bucket.put(chave, corpo, { contentType: "application/json" });
    const ids = registros.map((registro) => registro.id);
    const placeholders = ids.map(() => "?").join(",");
    const exclusao = await db.prepare(
      `DELETE FROM ${spec.tabela} WHERE id IN (${placeholders})`
    ).bind(...ids).run();
    exportados += registros.length;
    purgados += Number(exclusao.meta?.changes ?? ids.length);
  }
  return { exportados, purgados, lotes };
}

export async function runRetention(
  db,
  bucket,
  options: { now?: Date; runId?: string; rowWarningThreshold?: number } = {}
) {
  const agora = options.now ?? new Date();
  const runId = options.runId ?? crypto.randomUUID();
  const limiteAlertaLinhas = options.rowWarningThreshold ?? LIMITE_ALERTA_LINHAS_PADRAO;
  const resumo = {
    runId,
    executadoEm: agora.toISOString(),
    tabelas: [],
    exportacaoPulada: false,
    totalLinhas: 0,
    contagemTabelas: {},
    alertaTamanhoBanco: null
  };

  for (const spec of TABELAS_RETENCAO) {
    const corte = cortePara(agora, spec.retencaoDias);
    const expiradas = await contar(
      db,
      `SELECT COUNT(*) AS total FROM ${spec.tabela} WHERE ${spec.colunaTempo} < ?`,
      [corte]
    );
    if (!expiradas) {
      resumo.tabelas.push({
        tabela: spec.tabela, corte, exportados: 0, purgados: 0, lotes: 0, pendentes: 0
      });
      continue;
    }
    if (!bucket) {
      resumo.exportacaoPulada = true;
      resumo.tabelas.push({
        tabela: spec.tabela, corte, exportados: 0, purgados: 0, lotes: 0,
        pendentes: expiradas, motivo: "SEM_BUCKET_R2"
      });
      continue;
    }
    const estatisticas = await purgarTabela(db, bucket, spec, corte, runId);
    resumo.tabelas.push({ tabela: spec.tabela, corte, ...estatisticas, pendentes: 0 });
  }

  if (resumo.exportacaoPulada) {
    console.error(JSON.stringify({ event: "retention_export_skipped", runId, motivo: "SEM_BUCKET_R2" }));
  }

  let total = 0;
  for (const tabela of TABELAS_CONTAGEM) {
    const quantidade = await contar(db, `SELECT COUNT(*) AS total FROM ${tabela}`);
    resumo.contagemTabelas[tabela] = quantidade;
    total += quantidade;
  }
  resumo.totalLinhas = total;
  if (total >= limiteAlertaLinhas) {
    resumo.alertaTamanhoBanco = {
      nivel: "warning",
      totalLinhas: total,
      limite: limiteAlertaLinhas
    };
    console.error(JSON.stringify({
      event: "db_size_warning", runId, totalLinhas: total,
      limite: limiteAlertaLinhas, tabelas: resumo.contagemTabelas
    }));
  } else {
    console.log(JSON.stringify({
      event: "db_size_report", runId, totalLinhas: total,
      tabelas: resumo.contagemTabelas
    }));
  }
  return resumo;
}
