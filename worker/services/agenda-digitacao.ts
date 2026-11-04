import { auditStatement } from "../repositories/audit.ts";
import { listAppointmentsByAgenda } from "../repositories/agendas.ts";

function supplierKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

function parseArray(raw: string | null): string[] {
  try {
    const result = JSON.parse(raw ?? "[]");
    return Array.isArray(result) ? result.filter(v => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function parseCsvFields(raw: string | null): Record<string, string> {
  try {
    const value = JSON.parse(raw ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter(([key, cell]) => typeof key === "string" && typeof cell === "string")) as Record<string, string>
      : {};
  } catch {
    return {};
  }
}

type ImportedRow = {
  id: string; protocolo: string; fornecedor: string; horario_inicio: string; horario_fim: string;
  itens: number | null; volumes: number | null; paletes: number | null; carga_batida: string | null;
  tipo: string | null; nfe: string | null; pedidos: string | null; csv_campos: string | null;
  origem: string; ativo: number;
};

function groupRows(rows: ImportedRow[]) {
  const groups = new Map<string, { key: string; supplier: string; rows: ImportedRow[] }>();
  for (const row of rows) {
    if (row.origem === "manual") continue;
    const key = supplierKey(row.fornecedor);
    if (!key) continue;
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { key, supplier: row.fornecedor, rows: [row] });
  }
  return [...groups.values()].sort((a, b) => a.supplier.localeCompare(b.supplier, "pt-BR"));
}

async function fingerprint(rows: ImportedRow[]): Promise<string> {
  const canonical = [...rows].sort((a, b) => a.protocolo.localeCompare(b.protocolo)).map(row => [
    row.protocolo, row.fornecedor, row.horario_inicio, row.horario_fim,
    row.itens, row.volumes, row.paletes, row.carga_batida, row.tipo,
    parseArray(row.nfe), parseArray(row.pedidos), parseCsvFields(row.csv_campos)
  ]);
  const bytes = new TextEncoder().encode(JSON.stringify(canonical));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, "0")).join("");
}

function appointmentForAdmin(row: ImportedRow) {
  return {
    id: row.id,
    protocol: row.protocolo,
    supplier: row.fornecedor,
    startTime: row.horario_inicio,
    endTime: row.horario_fim,
    items: row.itens,
    volumes: row.volumes,
    pallets: row.paletes,
    cargaBatida: row.carga_batida,
    type: row.tipo,
    nfe: parseArray(row.nfe),
    orders: parseArray(row.pedidos),
    csvFields: parseCsvFields(row.csv_campos)
  };
}

type SupplierCheck = {
  fornecedor_chave: string;
  dados_hash: string;
  digitado_em: string | null;
  digitado_por: string | null;
  digitador_nome: string | null;
};

async function listSupplierChecks(db: D1Database, agendaId: string) {
  const result = await db.prepare(
    "SELECT d.fornecedor_chave, d.dados_hash, d.digitado_em, d.digitado_por, u.nome AS digitador_nome " +
    "FROM agenda_digitacao_fornecedor d LEFT JOIN usuarios u ON u.id = d.digitado_por WHERE d.agenda_id = ?"
  ).bind(agendaId).all<SupplierCheck>();
  return new Map((result.results ?? []).map(value => [value.fornecedor_chave, value] as const));
}

async function listAgendaSuppliers(db: D1Database, agendaId: string) {
  const [appointments, saved] = await Promise.all([
    listAppointmentsByAgenda(db, agendaId),
    listSupplierChecks(db, agendaId)
  ]);
  const groups = groupRows(appointments as ImportedRow[]);
  return Promise.all(groups.map(async group => {
    const hash = await fingerprint(group.rows);
    const check = saved.get(group.key);
    const valid = check?.dados_hash === hash;
    return {
      supplier: group.supplier,
      hash,
      digitadoEm: valid ? check.digitado_em ?? null : null,
      digitadoPor: valid && check.digitado_por
        ? { id: check.digitado_por, name: check.digitador_nome ?? "Administrador" } : null,
      appointments: group.rows.map(appointmentForAdmin)
    };
  }));
}

/**
 * Resumo do dia em duas leituras D1, sem solicitar os detalhes de cada loja.
 * O hash é o mesmo usado para validar o check no fornecedor expandido:
 * marcações de um CSV substituído não são contadas se os dados mudaram.
 */
async function listDigitacaoProgressByDate(db: D1Database, date: string) {
  const [appointments, checks] = await Promise.all([
    db.prepare(
      "SELECT ag.id, ag.agenda_id, ag.protocolo, ag.fornecedor, ag.horario_inicio, " +
      "ag.horario_fim, ag.itens, ag.volumes, ag.paletes, ag.carga_batida, " +
      "ag.tipo, ag.nfe, ag.pedidos, ag.csv_campos, ag.origem, ag.ativo " +
      // Ordem fixa apenas neste resumo diário: o D1 da preview (04/11) usava
      // SCAN ag (7.329 rows_read para COUNT da data). Dirigir pela agenda
      // utiliza idx_agendamentos_agenda_horario (387 rows_read no COUNT),
      // sem migration ou mudança na seleção das linhas.
      "FROM agendas a CROSS JOIN agendamentos ag ON ag.agenda_id = a.id " +
      "WHERE a.data_agenda = ? AND ag.ativo = 1"
    ).bind(date).all<ImportedRow & { agenda_id: string }>(),
    db.prepare(
      "SELECT d.agenda_id, d.fornecedor_chave, d.dados_hash, d.digitado_em " +
      "FROM agenda_digitacao_fornecedor d JOIN agendas a ON a.id = d.agenda_id " +
      "WHERE a.data_agenda = ?"
    ).bind(date).all<Pick<SupplierCheck, "fornecedor_chave" | "dados_hash" | "digitado_em"> & { agenda_id: string }>()
  ]);
  const byAgenda = new Map<string, ImportedRow[]>();
  for (const row of appointments.results ?? []) {
    const rows = byAgenda.get(row.agenda_id) ?? [];
    rows.push(row);
    byAgenda.set(row.agenda_id, rows);
  }
  const saved = new Map<string, { dados_hash: string; digitado_em: string | null }>();
  for (const check of checks.results ?? []) {
    saved.set(JSON.stringify([check.agenda_id, check.fornecedor_chave]), check);
  }
  const progress = new Map<string, { digitadas: number; fornecedores: number }>();
  await Promise.all([...byAgenda].map(async ([agendaId, rows]) => {
    const groups = groupRows(rows);
    const valid = await Promise.all(groups.map(async group => {
      const check = saved.get(JSON.stringify([agendaId, group.key]));
      return Boolean(check?.digitado_em && check.dados_hash === await fingerprint(group.rows));
    }));
    progress.set(agendaId, { digitadas: valid.filter(Boolean).length, fornecedores: groups.length });
  }));
  return progress;
}

function stateConflict() {
  return Object.assign(new Error("A marcação foi alterada; atualize a tela."), { code: "CONFLITO_ESTADO" });
}

async function changeSupplierCheck(db: D1Database, agenda: { id: string; loja_id: string }, userId: string, input: {
  supplier: string; hash: string; digitado: boolean; expectedDigitadoEm?: string | null;
}) {
  const rows = await listAppointmentsByAgenda(db, agenda.id);
  const group = groupRows(rows as ImportedRow[]).find(item => item.key === supplierKey(input.supplier));
  if (!group) return null;
  const hash = await fingerprint(group.rows);
  if (hash !== input.hash) throw stateConflict();

  const current = await db.prepare(
    "SELECT dados_hash, digitado_em, digitado_por FROM agenda_digitacao_fornecedor " +
    "WHERE agenda_id = ? AND fornecedor_chave = ? LIMIT 1"
  ).bind(agenda.id, group.key).first<Pick<SupplierCheck, "dados_hash" | "digitado_em" | "digitado_por">>();
  const visibleDate = current?.dados_hash === hash ? current.digitado_em ?? null : null;
  if (visibleDate !== input.expectedDigitadoEm) throw stateConflict();
  if (Boolean(visibleDate) === input.digitado) {
    return { supplier: group.supplier, hash, digitadoEm: visibleDate,
      digitadoPor: visibleDate && current?.digitado_por ? { id: current.digitado_por, name: "" } : null };
  }

  const now = new Date().toISOString();
  const changedAt = input.digitado ? now : null;
  const changedBy = input.digitado ? userId : null;
  // Gravação otimista: uma segunda sessão não pode sobrescrever o check lido.
  // A auditoria usa changes() e só existe quando o UPDATE/INSERT realmente venceu.
  const write = current
    ? db.prepare(
        "UPDATE agenda_digitacao_fornecedor SET fornecedor_nome = ?, dados_hash = ?, " +
        "digitado_em = ?, digitado_por = ? WHERE agenda_id = ? AND fornecedor_chave = ? " +
        "AND dados_hash = ? AND digitado_em IS ?"
      ).bind(group.supplier, hash, changedAt, changedBy, agenda.id, group.key,
        current.dados_hash, current.digitado_em)
    : db.prepare(
        "INSERT INTO agenda_digitacao_fornecedor " +
        "(agenda_id, fornecedor_chave, fornecedor_nome, dados_hash, digitado_em, digitado_por) " +
        "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(agenda_id, fornecedor_chave) DO NOTHING"
      ).bind(agenda.id, group.key, group.supplier, hash, changedAt, changedBy);
  const audit = auditStatement(db, {
    onlyIfPreviousWrite: true,
    userId, action: input.digitado ? "fornecedor_agenda_digitado" : "fornecedor_agenda_digitacao_removida",
    entity: "agenda", entityId: agenda.id, agendaId: agenda.id, storeId: agenda.loja_id,
    before: { fornecedor: group.supplier, digitadoEm: visibleDate },
    after: { fornecedor: group.supplier, digitadoEm: changedAt },
    details: "Controle interno de digitação por fornecedor.", createdAt: now
  });
  const results = await db.batch([write, audit]);
  if (Number(results?.[0]?.meta?.changes ?? 0) !== 1) throw stateConflict();
  return {
    supplier: group.supplier, hash, digitadoEm: changedAt,
    digitadoPor: changedBy ? { id: userId, name: "Administrador" } : null
  };
}

export { supplierKey, groupRows, fingerprint, listAgendaSuppliers, listDigitacaoProgressByDate, changeSupplierCheck };
