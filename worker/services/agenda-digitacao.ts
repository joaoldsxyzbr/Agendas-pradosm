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

async function listSupplierChecks(db: any, agendaId: string) {
  const result = await db.prepare(
    "SELECT d.fornecedor_chave, d.dados_hash, d.digitado_em, d.digitado_por, u.nome AS digitador_nome " +
    "FROM agenda_digitacao_fornecedor d LEFT JOIN usuarios u ON u.id = d.digitado_por WHERE d.agenda_id = ?"
  ).bind(agendaId).all();
  return new Map(result.results.map((value: any) => [value.fornecedor_chave, value]));
}

async function listAgendaSuppliers(db: any, agendaId: string) {
  const [appointments, saved] = await Promise.all([
    listAppointmentsByAgenda(db, agendaId),
    listSupplierChecks(db, agendaId)
  ]);
  const groups = groupRows(appointments as ImportedRow[]);
  return Promise.all(groups.map(async group => {
    const hash = await fingerprint(group.rows);
    const check: any = saved.get(group.key);
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

function stateConflict() {
  return Object.assign(new Error("A marcação foi alterada; atualize a tela."), { code: "CONFLITO_ESTADO" });
}

async function changeSupplierCheck(db: any, agenda: { id: string; loja_id: string }, userId: string, input: {
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
  ).bind(agenda.id, group.key).first();
  const visibleDate = current?.dados_hash === hash ? current.digitado_em ?? null : null;
  if (visibleDate !== input.expectedDigitadoEm) throw stateConflict();
  if (Boolean(visibleDate) === input.digitado) {
    return { supplier: group.supplier, hash, digitadoEm: visibleDate,
      digitadoPor: visibleDate && current?.digitado_por ? { id: current.digitado_por, name: "" } : null };
  }

  const now = new Date().toISOString();
  const changedAt = input.digitado ? now : null;
  const changedBy = input.digitado ? userId : null;
  const write = db.prepare(
    "INSERT INTO agenda_digitacao_fornecedor " +
    "(agenda_id, fornecedor_chave, fornecedor_nome, dados_hash, digitado_em, digitado_por) " +
    "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(agenda_id, fornecedor_chave) DO UPDATE SET " +
    "fornecedor_nome = excluded.fornecedor_nome, dados_hash = excluded.dados_hash, " +
    "digitado_em = excluded.digitado_em, digitado_por = excluded.digitado_por"
  ).bind(agenda.id, group.key, group.supplier, hash, changedAt, changedBy);
  const audit = auditStatement(db, {
    userId, action: input.digitado ? "fornecedor_agenda_digitado" : "fornecedor_agenda_digitacao_removida",
    entity: "agenda", entityId: agenda.id, agendaId: agenda.id, storeId: agenda.loja_id,
    before: { fornecedor: group.supplier, digitadoEm: visibleDate },
    after: { fornecedor: group.supplier, digitadoEm: changedAt },
    details: "Controle interno de digitação por fornecedor.", createdAt: now
  });
  await db.batch([write, audit]);
  return {
    supplier: group.supplier, hash, digitadoEm: changedAt,
    digitadoPor: changedBy ? { id: userId, name: "Administrador" } : null
  };
}

export { supplierKey, groupRows, fingerprint, listAgendaSuppliers, changeSupplierCheck };
