import type {
  ImportAgendaPayload,
  ImportedAppointmentPayload,
} from "../../shared/agenda";
import { auditStatement } from "./audit";

export type StoreLookup = {
  id: string;
  codigo: string;
  nome: string;
};

export type AgendaDayStatus = "aberto" | "concluido";

export type AgendaRecord = {
  id: string;
  loja_id: string;
  data_agenda: string;
  arquivo_original: string;
  criado_por: string;
  status_dia: AgendaDayStatus;
  concluido_em: string | null;
  concluido_por: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type AgendaWithStoreRecord = AgendaRecord & {
  store_code: string;
  store_name: string;
  concluido_por_nome: string | null;
};

export type AgendaSummaryRecord = AgendaWithStoreRecord & {
  total: number;
  aguardando: number;
  recebido: number;
  nao_chegou: number;
  recusado: number;
  sem_agenda: number;
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
  trocas: number;
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
  "id, loja_id, data_agenda, arquivo_original, criado_por, status_dia, concluido_em, concluido_por, criado_em, atualizado_em";

const APPOINTMENT_COLUMNS =
  "id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, itens, volumes, paletes, carga_batida, tipo, nfe, pedidos, status, trocas, origem, ativo, criado_em, atualizado_em";

export async function findStoreByCode(
  db: D1Database,
  code: string,
): Promise<StoreLookup | null> {
  return db
    .prepare(
      "SELECT id, codigo, nome FROM lojas WHERE codigo = ? COLLATE NOCASE AND ativo = 1 AND excluido_em IS NULL LIMIT 1",
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
      `SELECT a.${AGENDA_COLUMNS.replaceAll(", ", ", a.")},
              l.codigo AS store_code,
              l.nome AS store_name,
              concluidor.nome AS concluido_por_nome
       FROM agendas a
       JOIN lojas l ON l.id = a.loja_id
       LEFT JOIN usuarios concluidor ON concluidor.id = a.concluido_por
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
    clauses.push("l.codigo = ? COLLATE NOCASE");
    values.push(filters.storeCode);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const statement = db.prepare(
    `SELECT
       a.${AGENDA_COLUMNS.replaceAll(", ", ", a.")},
       l.codigo AS store_code,
       l.nome AS store_name,
       concluidor.nome AS concluido_por_nome,
       SUM(CASE WHEN ag.ativo = 1 THEN 1 ELSE 0 END) AS total,
       SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'aguardando' THEN 1 ELSE 0 END) AS aguardando,
       SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'recebido' THEN 1 ELSE 0 END) AS recebido,
       SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'nao_chegou' THEN 1 ELSE 0 END) AS nao_chegou,
       SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'recusado' THEN 1 ELSE 0 END) AS recusado,
       SUM(CASE WHEN ag.ativo = 1 AND ag.origem = 'manual' THEN 1 ELSE 0 END) AS sem_agenda
     FROM agendas a
     JOIN lojas l ON l.id = a.loja_id
     LEFT JOIN usuarios concluidor ON concluidor.id = a.concluido_por
     LEFT JOIN agendamentos ag ON ag.agenda_id = a.id
     ${where}
     GROUP BY a.id, l.codigo, l.nome, concluidor.nome
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

  statements.push(
    auditStatement(db, {
      userId: createdBy,
      action: "agenda_importada",
      entity: "agenda",
      entityId: agendaId,
      storeId,
      agendaId,
      after: {
        date: input.date,
        originalFileName: input.originalFileName,
        appointmentCount: input.appointments.length,
      },
      details: "Agenda importada.",
      createdAt: now,
    }),
  );

  await db.batch(statements);
  return agendaId;
}

export async function replaceAgendaImport(
  db: D1Database,
  agenda: AgendaRecord,
  userId: string,
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

  statements.push(
    auditStatement(db, {
      userId,
      action: "agenda_substituida",
      entity: "agenda",
      entityId: agenda.id,
      storeId: agenda.loja_id,
      agendaId: agenda.id,
      before: {
        originalFileName: agenda.arquivo_original,
        importedAppointmentCount: importedExisting.filter((item) => item.ativo === 1).length,
      },
      after: {
        originalFileName: input.originalFileName,
        importedAppointmentCount: input.appointments.length,
      },
      details: "Importação da agenda substituída.",
      createdAt: now,
    }),
  );

  await db.batch(statements);
}



export type AgendaBatchImportEntry = {
  storeId: string;
  existing: AgendaRecord | null;
  input: ImportAgendaPayload;
};

export type AgendaBatchImportResult = {
  agendaId: string;
  storeCode: string;
  date: string;
  replaced: boolean;
  appointmentCount: number;
};

export async function importAgendaBatchAtomic(
  db: D1Database,
  userId: string,
  entries: AgendaBatchImportEntry[],
): Promise<AgendaBatchImportResult[]> {
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  const results: AgendaBatchImportResult[] = [];

  for (const entry of entries) {
    const { existing, input, storeId } = entry;

    if (!existing) {
      const agendaId = crypto.randomUUID();

      statements.push(
        db
          .prepare(
            "INSERT INTO agendas (id, loja_id, data_agenda, arquivo_original, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            agendaId,
            storeId,
            input.date,
            input.originalFileName,
            userId,
            now,
            now,
          ),
      );

      for (const appointment of input.appointments) {
        statements.push(appointmentInsert(db, agendaId, appointment, now));
      }

      statements.push(
        auditStatement(db, {
          userId,
          action: "agenda_importada",
          entity: "agenda",
          entityId: agendaId,
          storeId,
          agendaId,
          after: {
            date: input.date,
            originalFileName: input.originalFileName,
            appointmentCount: input.appointments.length,
            batchImport: true,
          },
          details: "Agenda importada em lote.",
          createdAt: now,
        }),
      );

      results.push({
        agendaId,
        storeCode: input.storeCode,
        date: input.date,
        replaced: false,
        appointmentCount: input.appointments.length,
      });
      continue;
    }

    const existingAppointments = await listAppointmentsByAgenda(
      db,
      existing.id,
      false,
    );
    const importedExisting = existingAppointments.filter(
      (appointment) => appointment.origem !== "manual",
    );
    const byProtocol = new Map(
      importedExisting.map((appointment) => [
        appointment.protocolo,
        appointment,
      ]),
    );
    const incomingProtocols = new Set(
      input.appointments.map((appointment) => appointment.protocol),
    );

    statements.push(
      db
        .prepare(
          "UPDATE agendas SET arquivo_original = ?, atualizado_em = ? WHERE id = ?",
        )
        .bind(input.originalFileName, now, existing.id),
    );

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
        statements.push(appointmentInsert(db, existing.id, appointment, now));
      }
    }

    for (const appointment of importedExisting) {
      if (
        !incomingProtocols.has(appointment.protocolo) &&
        appointment.ativo === 1
      ) {
        statements.push(
          db
            .prepare(
              "UPDATE agendamentos SET ativo = 0, atualizado_em = ? WHERE id = ?",
            )
            .bind(now, appointment.id),
        );
      }
    }

    statements.push(
      auditStatement(db, {
        userId,
        action: "agenda_substituida",
        entity: "agenda",
        entityId: existing.id,
        storeId,
        agendaId: existing.id,
        before: {
          originalFileName: existing.arquivo_original,
          importedAppointmentCount: importedExisting.filter(
            (item) => item.ativo === 1,
          ).length,
        },
        after: {
          originalFileName: input.originalFileName,
          importedAppointmentCount: input.appointments.length,
          batchImport: true,
        },
        details: "Importação da agenda substituída em lote.",
        createdAt: now,
      }),
    );

    results.push({
      agendaId: existing.id,
      storeCode: input.storeCode,
      date: input.date,
      replaced: true,
      appointmentCount: input.appointments.length,
    });
  }

  if (statements.length === 0) {
    throw new Error("Lote de importação sem operações.");
  }

  await db.batch(statements);
  return results;
}

export async function createManualAppointment(
  db: D1Database,
  agenda: AgendaRecord,
  userId: string,
  supplier: string,
  businessHour: string,
): Promise<AppointmentRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.batch([
    db
      .prepare(
        "INSERT INTO agendamentos (id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, itens, volumes, paletes, carga_batida, tipo, nfe, pedidos, status, origem, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 'Sem agenda', '[]', '[]', 'aguardando', 'manual', 1, ?, ?)",
      )
      .bind(
        id,
        agenda.id,
        `manual:${id}`,
        businessHour,
        businessHour,
        supplier,
        now,
        now,
      ),
    auditStatement(db, {
      userId,
      action: "fornecedor_manual_criado",
      entity: "agendamento",
      entityId: id,
      storeId: agenda.loja_id,
      agendaId: agenda.id,
      appointmentId: id,
      after: { supplier, status: "aguardando", origin: "manual", ativo: true },
      details: "Fornecedor sem agenda criado.",
      createdAt: now,
    }),
  ]);

  const appointment = await findAppointmentById(db, id);
  if (!appointment) throw new Error("Fornecedor manual não pôde ser relido.");
  return appointment;
}

export async function updateManualAppointmentSupplier(
  db: D1Database,
  agenda: AgendaRecord,
  appointment: AppointmentRecord,
  userId: string,
  supplier: string,
  adminAdjustmentDetails?: string,
): Promise<AppointmentRecord> {
  if (appointment.origem !== "manual" || appointment.ativo !== 1) {
    throw new Error("Agendamento manual inválido.");
  }
  if (appointment.fornecedor === supplier) return appointment;

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db.prepare(
      "UPDATE agendamentos SET fornecedor = ?, atualizado_em = ? WHERE id = ? AND origem = 'manual' AND ativo = 1",
    ).bind(supplier, now, appointment.id),
    auditStatement(db, {
      userId,
      action: "fornecedor_manual_editado",
      entity: "agendamento",
      entityId: appointment.id,
      storeId: agenda.loja_id,
      agendaId: agenda.id,
      appointmentId: appointment.id,
      before: { supplier: appointment.fornecedor },
      after: { supplier },
      details: "Nome do fornecedor sem agenda alterado.",
      createdAt: now,
    }),
  ];
  const adjustment = agendaAdminAdjustmentStatement(
    db,
    agenda,
    userId,
    adminAdjustmentDetails,
    now,
  );
  if (adjustment) statements.push(adjustment);

  await db.batch(statements);

  const updated = await findAppointmentById(db, appointment.id);
  if (!updated) throw new Error("Fornecedor manual atualizado não pôde ser relido.");
  return updated;
}

export async function softDeleteManualAppointment(
  db: D1Database,
  agenda: AgendaRecord,
  appointment: AppointmentRecord,
  userId: string,
  adminAdjustmentDetails?: string,
): Promise<void> {
  if (appointment.origem !== "manual" || appointment.ativo !== 1) {
    throw new Error("Agendamento manual inválido.");
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db.prepare(
      "UPDATE agendamentos SET ativo = 0, atualizado_em = ? WHERE id = ? AND origem = 'manual' AND ativo = 1",
    ).bind(now, appointment.id),
    auditStatement(db, {
      userId,
      action: "fornecedor_manual_removido",
      entity: "agendamento",
      entityId: appointment.id,
      storeId: agenda.loja_id,
      agendaId: agenda.id,
      appointmentId: appointment.id,
      before: { supplier: appointment.fornecedor, ativo: true },
      after: { supplier: appointment.fornecedor, ativo: false },
      details: "Fornecedor sem agenda removido logicamente.",
      createdAt: now,
    }),
  ];
  const adjustment = agendaAdminAdjustmentStatement(
    db,
    agenda,
    userId,
    adminAdjustmentDetails,
    now,
  );
  if (adjustment) statements.push(adjustment);

  await db.batch(statements);
}


export async function findStoreAgendaByDate(
  db: D1Database,
  storeId: string,
  date: string,
): Promise<AgendaWithStoreRecord | null> {
  return db
    .prepare(
      `SELECT a.${AGENDA_COLUMNS.replaceAll(", ", ", a.")},
              l.codigo AS store_code,
              l.nome AS store_name,
              concluidor.nome AS concluido_por_nome
       FROM agendas a
       JOIN lojas l ON l.id = a.loja_id
       LEFT JOIN usuarios concluidor ON concluidor.id = a.concluido_por
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
         concluidor.nome AS concluido_por_nome,
         SUM(CASE WHEN ag.ativo = 1 THEN 1 ELSE 0 END) AS total,
         SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'aguardando' THEN 1 ELSE 0 END) AS aguardando,
         SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'recebido' THEN 1 ELSE 0 END) AS recebido,
         SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'nao_chegou' THEN 1 ELSE 0 END) AS nao_chegou,
         SUM(CASE WHEN ag.ativo = 1 AND ag.status = 'recusado' THEN 1 ELSE 0 END) AS recusado,
         SUM(CASE WHEN ag.ativo = 1 AND ag.origem = 'manual' THEN 1 ELSE 0 END) AS sem_agenda
       FROM agendas a
       JOIN lojas l ON l.id = a.loja_id
       LEFT JOIN usuarios concluidor ON concluidor.id = a.concluido_por
       LEFT JOIN agendamentos ag ON ag.agenda_id = a.id
       WHERE a.loja_id = ?
       GROUP BY a.id, l.codigo, l.nome, concluidor.nome
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

function agendaAdminAdjustmentStatement(
  db: D1Database,
  agenda: AgendaRecord,
  userId: string,
  details: string | undefined,
  changedAt: string,
): D1PreparedStatement | null {
  if (!details || agenda.status_dia !== "concluido") return null;

  return db
    .prepare(
      "INSERT INTO historico_agenda (id, agenda_id, usuario_id, acao, detalhes, alterado_em) VALUES (?, ?, ?, 'ajuste_admin', ?, ?)",
    )
    .bind(crypto.randomUUID(), agenda.id, userId, details, changedAt);
}

export async function changeAppointmentExchanges(
  db: D1Database,
  appointment: AppointmentRecord,
  userId: string,
  hasExchanges: boolean,
  adminAdjustmentDetails?: string,
): Promise<AppointmentRecord> {
  const exchanges = hasExchanges ? 1 : 0;
  if (appointment.trocas === exchanges) return appointment;

  const agenda = await findAgendaById(db, appointment.agenda_id);
  if (!agenda) throw new Error("Agenda do agendamento não encontrada.");

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "UPDATE agendamentos SET trocas = ?, atualizado_em = ? WHERE id = ?",
      )
      .bind(exchanges, now, appointment.id),
    auditStatement(db, {
      userId,
      action: "trocas_alteradas",
      entity: "agendamento",
      entityId: appointment.id,
      storeId: agenda.loja_id,
      agendaId: agenda.id,
      appointmentId: appointment.id,
      before: { hasExchanges: appointment.trocas === 1 },
      after: { hasExchanges },
      details: "Marcação de trocas alterada.",
      createdAt: now,
    }),
  ];
  const adjustment = agendaAdminAdjustmentStatement(
    db,
    agenda,
    userId,
    adminAdjustmentDetails,
    now,
  );
  if (adjustment) statements.push(adjustment);

  await db.batch(statements);

  const updated = await findAppointmentById(db, appointment.id);
  if (!updated) {
    throw new Error("Agendamento atualizado não pôde ser relido.");
  }

  return updated;
}

export async function changeAppointmentStatus(
  db: D1Database,
  appointment: AppointmentRecord,
  userId: string,
  status: AppointmentRecord["status"],
  adminAdjustmentDetails?: string,
): Promise<AppointmentRecord> {
  if (appointment.status === status) return appointment;

  const agenda = await findAgendaById(db, appointment.agenda_id);
  if (!agenda) throw new Error("Agenda do agendamento não encontrada.");

  const now = new Date().toISOString();
  const historyId = crypto.randomUUID();

  const statements: D1PreparedStatement[] = [
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
    auditStatement(db, {
      userId,
      action: "status_alterado",
      entity: "agendamento",
      entityId: appointment.id,
      storeId: agenda.loja_id,
      agendaId: agenda.id,
      appointmentId: appointment.id,
      before: { status: appointment.status },
      after: { status },
      details: "Status do recebimento alterado.",
      createdAt: now,
    }),
  ];
  const adjustment = agendaAdminAdjustmentStatement(
    db,
    agenda,
    userId,
    adminAdjustmentDetails,
    now,
  );
  if (adjustment) statements.push(adjustment);

  await db.batch(statements);

  const updated = await findAppointmentById(db, appointment.id);
  if (!updated) {
    throw new Error("Agendamento atualizado não pôde ser relido.");
  }

  return updated;
}


export type AgendaEventRecord = {
  id: string;
  agenda_id: string;
  usuario_id: string;
  usuario_nome: string;
  acao: "concluido" | "reaberto" | "ajuste_admin";
  detalhes: string | null;
  alterado_em: string;
};

export async function changeAgendaDayStatus(
  db: D1Database,
  agenda: AgendaRecord,
  userId: string,
  status: AgendaDayStatus,
): Promise<AgendaWithStoreRecord> {
  if (agenda.status_dia === status) {
    const current = await findAgendaById(db, agenda.id);
    if (!current) throw new Error("Agenda não pôde ser relida.");
    return current;
  }

  const now = new Date().toISOString();
  const action = status === "concluido" ? "concluido" : "reaberto";

  await db.batch([
    db
      .prepare(
        status === "concluido"
          ? "UPDATE agendas SET status_dia = 'concluido', concluido_em = ?, concluido_por = ?, atualizado_em = ? WHERE id = ?"
          : "UPDATE agendas SET status_dia = 'aberto', concluido_em = NULL, concluido_por = NULL, atualizado_em = ? WHERE id = ?",
      )
      .bind(
        ...(status === "concluido"
          ? [now, userId, now, agenda.id]
          : [now, agenda.id]),
      ),
    db
      .prepare(
        "INSERT INTO historico_agenda (id, agenda_id, usuario_id, acao, detalhes, alterado_em) VALUES (?, ?, ?, ?, NULL, ?)",
      )
      .bind(crypto.randomUUID(), agenda.id, userId, action, now),
    auditStatement(db, {
      userId,
      action: status === "concluido" ? "dia_concluido" : "dia_reaberto",
      entity: "agenda",
      entityId: agenda.id,
      storeId: agenda.loja_id,
      agendaId: agenda.id,
      before: { dayStatus: agenda.status_dia },
      after: { dayStatus: status },
      details:
        status === "concluido"
          ? "Dia concluído pelo conferente ou administrador."
          : "Dia reaberto para ajustes.",
      createdAt: now,
    }),
  ]);

  const updated = await findAgendaById(db, agenda.id);
  if (!updated) throw new Error("Agenda atualizada não pôde ser relida.");
  return updated;
}

export async function listAgendaHistory(
  db: D1Database,
  agendaId: string,
): Promise<AgendaEventRecord[]> {
  const result = await db
    .prepare(
      `SELECT h.id, h.agenda_id, h.usuario_id, u.nome AS usuario_nome,
              h.acao, h.detalhes, h.alterado_em
       FROM historico_agenda h
       JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.agenda_id = ?
       ORDER BY h.alterado_em ASC, h.id ASC`,
    )
    .bind(agendaId)
    .all<AgendaEventRecord>();

  return result.results;
}
