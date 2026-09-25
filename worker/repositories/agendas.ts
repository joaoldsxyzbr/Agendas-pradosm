import type {
  ImportAgendaPayload,
  ImportedAppointmentPayload,
} from "../../shared/agenda";

export type StoreLookup = {
  id: string;
  codigo: string;
  nome: string;
};

export type AgendaRecord = {
  id: string;
  loja_id: string;
  data_agenda: string;
  arquivo_original: string;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
};

export type AgendaWithStoreRecord = AgendaRecord & {
  store_code: string;
  store_name: string;
};

export type AgendaSummaryRecord = AgendaWithStoreRecord & {
  total: number;
  aguardando: number;
  recebido: number;
  nao_chegou: number;
  recusado: number;
};

export type AppointmentRecord = {
  id: string;
  agenda_id: string;
  protocolo: string;
  horario_inicio: string;
  horario_fim: string;
  fornecedor: string;
  itens: number | null;
  volumes: number | null;
  paletes: number | null;
  carga_batida: string | null;
  tipo: string | null;
  nfe: string;
  pedidos: string;
  status: "aguardando" | "recebido" | "nao_chegou" | "recusado";
  origem: "importado" | "manual";
  ativo: number;
  criado_em: string;
  atualizado_em: string;
};

export type StatusHistoryRecord = {
  id: string;
  agendamento_id: string;
  usuario_id: string;
  usuario_nome: string;
  status_anterior: string;
  status_novo: string;
  alterado_em: string;
};

const AGENDA_COLUMNS =
  "id, loja_id, data_agenda, arquivo_original, criado_por, criado_em, atualizado_em";

const APPOINTMENT_COLUMNS =
  "id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, itens, volumes, paletes, carga_batida, tipo, nfe, pedidos, status, origem, ativo, criado_em, atualizado_em";

export async function findStoreByCode(
  db: D1Database,
  code: string,
): Promise<StoreLookup | null> {
  return db
    .prepare(
      "SELECT id, codigo, nome FROM lojas WHERE codigo = ? AND ativo = 1 LIMIT 1",
    )
    .bind(code)
    .first<StoreLookup>();
}

export async function findAgendaByStoreDate(
  db: D1Database,
  storeId: string,
  date: string,
): Promise<AgendaRecord | null> {
  return db
    .prepare(
      `SELECT ${AGENDA_COLUMNS} FROM agendas WHERE loja_id = ? AND data_agenda = ? LIMIT 1`,
    )
    .bind(storeId, date)
    .first<AgendaRecord>();
}

export async function findAgendaById(
  db: D1Database,
  id: string,
): Promise<AgendaWithStoreRecord | null> {
  return db
    .prepare(
      `SELECT a.${AGENDA_COLUMNS.replaceAll(", ", ", a.")}, l.codigo AS store_code, l.nome AS store_name
       FROM agendas a
       JOIN lojas l ON l.id = a.loja_id
       WHERE a.id = ?
       LIMIT 1`,
    )
    .bind(id)
    .first<AgendaWithStoreRecord>();
}

export async function listAdminAgendas(
  db: D1Database,
  filters: { date?: string; storeCode?: string } = {},
): Promise<AgendaSummaryRecord[]> {
  const clauses: string[] = [];
  const values: string[] = [];

  if (filters.date) {
    clauses.push("a.data_agenda = ?");
    values.push(filters.date);
  }

  if (filters.storeCode) {
    clauses.push("l.codigo = ?");
    values.push(filters.storeCode);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const statement = db.prepare(
    `SELECT
       a.${AGENDA_COLUMNS.replaceAll(", ", ", a.")},
       l.codigo AS store_code,
       l.nome AS store_name,
       SUM(CASE WHEN ag.ativo = 1 THEN 1 ELSE 0 END) AS total,
       SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'aguardando' THEN 1 ELSE 0 END) AS aguardando,
       SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'recebido' THEN 1 ELSE 0 END) AS recebido,
       SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'nao_chegou' THEN 1 ELSE 0 END) AS nao_chegou,
       SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'recusado' THEN 1 ELSE 0 END) AS recusado
     FROM agendas a
     JOIN lojas l ON l.id = a.loja_id
     LEFT JOIN agendamentos ag ON ag.agenda_id = a.id
     ${where}
     GROUP BY a.id, l.codigo, l.nome
     ORDER BY a.data_agenda DESC, l.codigo ASC`,
  );

  const result = await (values.length
    ? statement.bind(...values)
    : statement
  ).all<AgendaSummaryRecord>();

  return result.results;
}

export async function listAppointmentsByAgenda(
  db: D1Database,
  agendaId: string,
  activeOnly = true,
): Promise<AppointmentRecord[]> {
  const query = activeOnly
    ? `SELECT ${APPOINTMENT_COLUMNS} FROM agendamentos WHERE agenda_id = ? AND ativo = 1 ORDER BY horario_inicio ASC, protocolo ASC`
    : `SELECT ${APPOINTMENT_COLUMNS} FROM agendamentos WHERE agenda_id = ? ORDER BY horario_inicio ASC, protocolo ASC`;

  const result = await db
    .prepare(query)
    .bind(agendaId)
    .all<AppointmentRecord>();

  return result.results;
}

export async function findAppointmentById(
  db: D1Database,
  id: string,
): Promise<AppointmentRecord | null> {
  return db
    .prepare(
      `SELECT ${APPOINTMENT_COLUMNS} FROM agendamentos WHERE id = ? LIMIT 1`,
    )
    .bind(id)
    .first<AppointmentRecord>();
}

export async function listAppointmentHistory(
  db: D1Database,
  appointmentId: string,
): Promise<StatusHistoryRecord[]> {
  const result = await db
    .prepare(
      `SELECT
         h.id,
         h.agendamento_id,
         h.usuario_id,
         u.nome AS usuario_nome,
         h.status_anterior,
         h.status_novo,
         h.alterado_em
       FROM historico_status h
       JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.agendamento_id = ?
       ORDER BY h.alterado_em ASC, h.id ASC`,
    )
    .bind(appointmentId)
    .all<StatusHistoryRecord>();

  return result.results;
}

function appointmentInsert(
  db: D1Database,
  agendaId: string,
  appointment: ImportedAppointmentPayload,
  now: string,
) {
  return db
    .prepare(
      "INSERT INTO agendamentos (id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, itens, volumes, paletes, carga_batida, tipo, nfe, pedidos, status, origem, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aguardando', 'importado', 1, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      agendaId,
      appointment.protocol,
      appointment.startTime,
      appointment.endTime,
      appointment.supplier,
      appointment.items,
      appointment.volumes,
      appointment.pallets,
      appointment.cargaBatida,
      appointment.type,
      JSON.stringify(appointment.nfe),
      JSON.stringify(appointment.orders),
      now,
      now,
    );
}

export async function createAgendaImport(
  db: D1Database,
  storeId: string,
  createdBy: string,
  input: ImportAgendaPayload,
): Promise<string> {
  const agendaId = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "INSERT INTO agendas (id, loja_id, data_agenda, arquivo_original, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        agendaId,
        storeId,
        input.date,
        input.originalFileName,
        createdBy,
        now,
        now,
      ),
  ];

  for (const appointment of input.appointments) {
    statements.push(appointmentInsert(db, agendaId, appointment, now));
  }

  await db.batch(statements);
  return agendaId;
}

export async function replaceAgendaImport(
  db: D1Database,
  agenda: AgendaRecord,
  input: ImportAgendaPayload,
): Promise<void> {
  const existing = await listAppointmentsByAgenda(db, agenda.id, false);
  const importedExisting = existing.filter(
    (appointment) => appointment.origem !== "manual",
  );
  const byProtocol = new Map(
    importedExisting.map((appointment) => [appointment.protocolo, appointment]),
  );
  const incomingProtocols = new Set(
    input.appointments.map((appointment) => appointment.protocol),
  );
  const now = new Date().toISOString();

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "UPDATE agendas SET arquivo_original = ?, atualizado_em = ? WHERE id = ?",
      )
      .bind(input.originalFileName, now, agenda.id),
  ];

  for (const appointment of input.appointments) {
    const current = byProtocol.get(appointment.protocol);

    if (current) {
      statements.push(
        db
          .prepare(
            "UPDATE agendamentos SET horario_inicio = ?, horario_fim = ?, fornecedor = ?, itens = ?, volumes = ?, paletes = ?, carga_batida = ?, tipo = ?, nfe = ?, pedidos = ?, ativo = 1, atualizado_em = ? WHERE id = ?",
          )
          .bind(
            appointment.startTime,
            appointment.endTime,
            appointment.supplier,
            appointment.items,
            appointment.volumes,
            appointment.pallets,
            appointment.cargaBatida,
            appointment.type,
            JSON.stringify(appointment.nfe),
            JSON.stringify(appointment.orders),
            now,
            current.id,
          ),
      );
    } else {
      statements.push(appointmentInsert(db, agenda.id, appointment, now));
    }
  }

  for (const appointment of importedExisting) {
    if (!incomingProtocols.has(appointment.protocolo) && appointment.ativo === 1) {
      statements.push(
        db
          .prepare(
            "UPDATE agendamentos SET ativo = 0, atualizado_em = ? WHERE id = ?",
          )
          .bind(now, appointment.id),
      );
    }
  }

  await db.batch(statements);
}


export async function createManualAppointment(
  db: D1Database,
  agendaId: string,
  supplier: string,
  businessHour: string,
): Promise<AppointmentRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      "INSERT INTO agendamentos (id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, itens, volumes, paletes, carga_batida, tipo, nfe, pedidos, status, origem, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 'Sem agenda', '[]', '[]', 'aguardando', 'manual', 1, ?, ?)",
    )
    .bind(
      id,
      agendaId,
      `manual:${id}`,
      businessHour,
      businessHour,
      supplier,
      now,
      now,
    )
    .run();

  const appointment = await findAppointmentById(db, id);
  if (!appointment) {
    throw new Error("Fornecedor manual não pôde ser relido.");
  }

  return appointment;
}


export async function findStoreAgendaByDate(
  db: D1Database,
  storeId: string,
  date: string,
): Promise<AgendaWithStoreRecord | null> {
  return db
    .prepare(
      `SELECT a.${AGENDA_COLUMNS.replaceAll(", ", ", a.")}, l.codigo AS store_code, l.nome AS store_name
       FROM agendas a
       JOIN lojas l ON l.id = a.loja_id
       WHERE a.loja_id = ? AND a.data_agenda = ?
       LIMIT 1`,
    )
    .bind(storeId, date)
    .first<AgendaWithStoreRecord>();
}

export async function listStoreAgendas(
  db: D1Database,
  storeId: string,
): Promise<AgendaSummaryRecord[]> {
  const result = await db
    .prepare(
      `SELECT
         a.${AGENDA_COLUMNS.replaceAll(", ", ", a.")},
         l.codigo AS store_code,
         l.nome AS store_name,
         SUM(CASE WHEN ag.ativo = 1 THEN 1 ELSE 0 END) AS total,
         SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'aguardando' THEN 1 ELSE 0 END) AS aguardando,
         SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'recebido' THEN 1 ELSE 0 END) AS recebido,
         SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'nao_chegou' THEN 1 ELSE 0 END) AS nao_chegou,
         SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'recusado' THEN 1 ELSE 0 END) AS recusado
       FROM agendas a
       JOIN lojas l ON l.id = a.loja_id
       LEFT JOIN agendamentos ag ON ag.agenda_id = a.id
       WHERE a.loja_id = ?
       GROUP BY a.id, l.codigo, l.nome
       ORDER BY a.data_agenda DESC`,
    )
    .bind(storeId)
    .all<AgendaSummaryRecord>();

  return result.results;
}

export async function findAppointmentForStore(
  db: D1Database,
  appointmentId: string,
  storeId: string,
): Promise<AppointmentRecord | null> {
  const prefixedColumns = APPOINTMENT_COLUMNS.split(", ")
    .map((column) => `ag.${column}`)
    .join(", ");

  return db
    .prepare(
      `SELECT ${prefixedColumns}
       FROM agendamentos ag
       JOIN agendas a ON a.id = ag.agenda_id
       WHERE ag.id = ? AND a.loja_id = ? AND ag.ativo = 1
       LIMIT 1`,
    )
    .bind(appointmentId, storeId)
    .first<AppointmentRecord>();
}

export async function changeAppointmentStatus(
  db: D1Database,
  appointment: AppointmentRecord,
  userId: string,
  status: AppointmentRecord["status"],
): Promise<AppointmentRecord> {
  if (appointment.status === status) return appointment;

  const now = new Date().toISOString();
  const historyId = crypto.randomUUID();

  await db.batch([
    db
      .prepare(
        "UPDATE agendamentos SET status = ?, atualizado_em = ? WHERE id = ?",
      )
      .bind(status, now, appointment.id),
    db
      .prepare(
        "INSERT INTO historico_status (id, agendamento_id, usuario_id, status_anterior, status_novo, alterado_em) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        historyId,
        appointment.id,
        userId,
        appointment.status,
        status,
        now,
      ),
  ]);

  const updated = await findAppointmentById(db, appointment.id);
  if (!updated) {
    throw new Error("Agendamento atualizado não pôde ser relido.");
  }

  return updated;
}
