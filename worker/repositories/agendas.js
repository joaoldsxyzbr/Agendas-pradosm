import { auditStatement } from "./audit.js";
const AGENDA_COLUMNS = "id, loja_id, data_agenda, arquivo_original, criado_por, status_dia, concluido_em, concluido_por, criado_em, atualizado_em";
const APPOINTMENT_COLUMNS = "id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, itens, volumes, paletes, carga_batida, tipo, nfe, pedidos, status, trocas, observacao, origem, ativo, criado_em, atualizado_em";
async function findStoreByCode(db, code) {
  return db.prepare(
    "SELECT id, codigo, nome FROM lojas WHERE codigo = ? COLLATE NOCASE AND ativo = 1 AND excluido_em IS NULL LIMIT 1"
  ).bind(code).first();
}
async function findAgendaByStoreDate(db, storeId, date) {
  return db.prepare(
    `SELECT ${AGENDA_COLUMNS} FROM agendas WHERE loja_id = ? AND data_agenda = ? LIMIT 1`
  ).bind(storeId, date).first();
}
async function findAgendaById(db, id) {
  return db.prepare(
    `SELECT a.${AGENDA_COLUMNS.replaceAll(", ", ", a.")},
              l.codigo AS store_code,
              l.nome AS store_name,
              concluidor.nome AS concluido_por_nome
       FROM agendas a
       JOIN lojas l ON l.id = a.loja_id
       LEFT JOIN usuarios concluidor ON concluidor.id = a.concluido_por
       WHERE a.id = ?
       LIMIT 1`
  ).bind(id).first();
}
async function listAdminAgendas(db, filters = {}) {
  const clauses = [];
  const values = [];
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
     ORDER BY a.data_agenda DESC, l.codigo ASC`
  );
  const result = await (values.length ? statement.bind(...values) : statement).all();
  return result.results;
}
async function listAppointmentsByAgenda(db, agendaId, activeOnly = true) {
  const query = activeOnly ? `SELECT ${APPOINTMENT_COLUMNS} FROM agendamentos WHERE agenda_id = ? AND ativo = 1 ORDER BY horario_inicio ASC, protocolo ASC` : `SELECT ${APPOINTMENT_COLUMNS} FROM agendamentos WHERE agenda_id = ? ORDER BY horario_inicio ASC, protocolo ASC`;
  const result = await db.prepare(query).bind(agendaId).all();
  return result.results;
}
async function findAppointmentById(db, id) {
  return db.prepare(
    `SELECT ${APPOINTMENT_COLUMNS} FROM agendamentos WHERE id = ? LIMIT 1`
  ).bind(id).first();
}
async function listAppointmentHistory(db, appointmentId) {
  const result = await db.prepare(
    `SELECT
         h.id,
         h.agendamento_id,
         h.usuario_id,
         u.nome AS usuario_nome,
         h.status_anterior,
         h.status_novo,
         h.observacao,
         h.alterado_em
       FROM historico_status h
       JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.agendamento_id = ?
       ORDER BY h.alterado_em ASC, h.id ASC`
  ).bind(appointmentId).all();
  return result.results;
}
function appointmentInsert(db, agendaId, appointment, now) {
  return db.prepare(
    "INSERT INTO agendamentos (id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, itens, volumes, paletes, carga_batida, tipo, nfe, pedidos, status, origem, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aguardando', 'importado', 1, ?, ?)"
  ).bind(
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
    now
  );
}
async function createAgendaImport(db, storeId, createdBy, input) {
  const agendaId = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const statements = [
    db.prepare(
      "INSERT INTO agendas (id, loja_id, data_agenda, arquivo_original, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      agendaId,
      storeId,
      input.date,
      input.originalFileName,
      createdBy,
      now,
      now
    )
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
        appointmentCount: input.appointments.length
      },
      details: "Agenda importada.",
      createdAt: now
    })
  );
  await db.batch(statements);
  return agendaId;
}
async function replaceAgendaImport(db, agenda, userId, input) {
  const existing = await listAppointmentsByAgenda(db, agenda.id, false);
  const importedExisting = existing.filter(
    (appointment) => appointment.origem !== "manual"
  );
  const byProtocol = new Map(
    importedExisting.map((appointment) => [appointment.protocolo, appointment])
  );
  const incomingProtocols = new Set(
    input.appointments.map((appointment) => appointment.protocol)
  );
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const statements = [
    db.prepare(
      "UPDATE agendas SET arquivo_original = ?, atualizado_em = ? WHERE id = ?"
    ).bind(input.originalFileName, now, agenda.id)
  ];
  for (const appointment of input.appointments) {
    const current = byProtocol.get(appointment.protocol);
    if (current) {
      statements.push(
        db.prepare(
          "UPDATE agendamentos SET horario_inicio = ?, horario_fim = ?, fornecedor = ?, itens = ?, volumes = ?, paletes = ?, carga_batida = ?, tipo = ?, nfe = ?, pedidos = ?, ativo = 1, atualizado_em = ? WHERE id = ?"
        ).bind(
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
          current.id
        )
      );
    } else {
      statements.push(appointmentInsert(db, agenda.id, appointment, now));
    }
  }
  for (const appointment of importedExisting) {
    if (!incomingProtocols.has(appointment.protocolo) && appointment.ativo === 1) {
      statements.push(
        db.prepare(
          "UPDATE agendamentos SET ativo = 0, atualizado_em = ? WHERE id = ?"
        ).bind(now, appointment.id)
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
        importedAppointmentCount: importedExisting.filter((item) => item.ativo === 1).length
      },
      after: {
        originalFileName: input.originalFileName,
        importedAppointmentCount: input.appointments.length
      },
      details: "Importa\xE7\xE3o da agenda substitu\xEDda.",
      createdAt: now
    })
  );
  await db.batch(statements);
}
class AgendaBatchQueryBudgetError extends Error {
  constructor(statementCount) {
    super(
      `O lote exige ${statementCount} opera\xE7\xF5es de banco e excede o limite seguro.`
    );
    this.name = "AgendaBatchQueryBudgetError";
  }
}
const MAX_BATCH_WRITE_STATEMENTS = 800;
async function importAgendaBatchAtomic(db, userId, entries) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const statements = [];
  const results = [];
  for (const entry of entries) {
    const { existing, input, storeId } = entry;
    if (!existing) {
      const agendaId = crypto.randomUUID();
      statements.push(
        db.prepare(
          "INSERT INTO agendas (id, loja_id, data_agenda, arquivo_original, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          agendaId,
          storeId,
          input.date,
          input.originalFileName,
          userId,
          now,
          now
        )
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
            batchImport: true
          },
          details: "Agenda importada em lote.",
          createdAt: now
        })
      );
      results.push({
        agendaId,
        storeCode: input.storeCode,
        date: input.date,
        replaced: false,
        appointmentCount: input.appointments.length
      });
      continue;
    }
    const existingAppointments = await listAppointmentsByAgenda(
      db,
      existing.id,
      false
    );
    const importedExisting = existingAppointments.filter(
      (appointment) => appointment.origem !== "manual"
    );
    const byProtocol = new Map(
      importedExisting.map((appointment) => [
        appointment.protocolo,
        appointment
      ])
    );
    const incomingProtocols = new Set(
      input.appointments.map((appointment) => appointment.protocol)
    );
    statements.push(
      db.prepare(
        "UPDATE agendas SET arquivo_original = ?, atualizado_em = ? WHERE id = ?"
      ).bind(input.originalFileName, now, existing.id)
    );
    for (const appointment of input.appointments) {
      const current = byProtocol.get(appointment.protocol);
      if (current) {
        statements.push(
          db.prepare(
            "UPDATE agendamentos SET horario_inicio = ?, horario_fim = ?, fornecedor = ?, itens = ?, volumes = ?, paletes = ?, carga_batida = ?, tipo = ?, nfe = ?, pedidos = ?, ativo = 1, atualizado_em = ? WHERE id = ?"
          ).bind(
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
            current.id
          )
        );
      } else {
        statements.push(appointmentInsert(db, existing.id, appointment, now));
      }
    }
    for (const appointment of importedExisting) {
      if (!incomingProtocols.has(appointment.protocolo) && appointment.ativo === 1) {
        statements.push(
          db.prepare(
            "UPDATE agendamentos SET ativo = 0, atualizado_em = ? WHERE id = ?"
          ).bind(now, appointment.id)
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
            (item) => item.ativo === 1
          ).length
        },
        after: {
          originalFileName: input.originalFileName,
          importedAppointmentCount: input.appointments.length,
          batchImport: true
        },
        details: "Importa\xE7\xE3o da agenda substitu\xEDda em lote.",
        createdAt: now
      })
    );
    results.push({
      agendaId: existing.id,
      storeCode: input.storeCode,
      date: input.date,
      replaced: true,
      appointmentCount: input.appointments.length
    });
  }
  if (statements.length === 0) {
    throw new Error("Lote de importa\xE7\xE3o sem opera\xE7\xF5es.");
  }
  if (statements.length > MAX_BATCH_WRITE_STATEMENTS) {
    throw new AgendaBatchQueryBudgetError(statements.length);
  }
  await db.batch(statements);
  return results;
}
async function createManualAppointment(db, agenda, userId, supplier, businessHour, adminAdjustmentDetails) {
  const id = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const statements = [
    db.prepare(
      "INSERT INTO agendamentos (id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, itens, volumes, paletes, carga_batida, tipo, nfe, pedidos, status, origem, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 'Sem agenda', '[]', '[]', 'aguardando', 'manual', 1, ?, ?)"
    ).bind(
      id,
      agenda.id,
      `manual:${id}`,
      businessHour,
      businessHour,
      supplier,
      now,
      now
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
      createdAt: now
    })
  ];
  const adjustment = agendaAdminAdjustmentStatement(
    db,
    agenda,
    userId,
    adminAdjustmentDetails,
    now
  );
  if (adjustment) statements.push(adjustment);
  await db.batch(statements);
  const appointment = await findAppointmentById(db, id);
  if (!appointment) throw new Error("Fornecedor manual n\xE3o p\xF4de ser relido.");
  return appointment;
}
async function updateManualAppointmentSupplier(db, agenda, appointment, userId, supplier, adminAdjustmentDetails) {
  if (appointment.origem !== "manual" || appointment.ativo !== 1) {
    throw new Error("Agendamento manual inv\xE1lido.");
  }
  if (appointment.fornecedor === supplier) return appointment;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const statements = [
    db.prepare(
      "UPDATE agendamentos SET fornecedor = ?, atualizado_em = ? WHERE id = ? AND origem = 'manual' AND ativo = 1"
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
      createdAt: now
    })
  ];
  const adjustment = agendaAdminAdjustmentStatement(
    db,
    agenda,
    userId,
    adminAdjustmentDetails,
    now
  );
  if (adjustment) statements.push(adjustment);
  await db.batch(statements);
  const updated = await findAppointmentById(db, appointment.id);
  if (!updated) throw new Error("Fornecedor manual atualizado n\xE3o p\xF4de ser relido.");
  return updated;
}
async function softDeleteManualAppointment(db, agenda, appointment, userId, adminAdjustmentDetails) {
  if (appointment.origem !== "manual" || appointment.ativo !== 1) {
    throw new Error("Agendamento manual inv\xE1lido.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const statements = [
    db.prepare(
      "UPDATE agendamentos SET ativo = 0, atualizado_em = ? WHERE id = ? AND origem = 'manual' AND ativo = 1"
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
      createdAt: now
    })
  ];
  const adjustment = agendaAdminAdjustmentStatement(
    db,
    agenda,
    userId,
    adminAdjustmentDetails,
    now
  );
  if (adjustment) statements.push(adjustment);
  await db.batch(statements);
}
async function findStoreAgendaByDate(db, storeId, date) {
  return db.prepare(
    `SELECT a.${AGENDA_COLUMNS.replaceAll(", ", ", a.")},
              l.codigo AS store_code,
              l.nome AS store_name,
              concluidor.nome AS concluido_por_nome
       FROM agendas a
       JOIN lojas l ON l.id = a.loja_id
       LEFT JOIN usuarios concluidor ON concluidor.id = a.concluido_por
       WHERE a.loja_id = ? AND a.data_agenda = ?
       LIMIT 1`
  ).bind(storeId, date).first();
}
async function listStoreAgendas(db, storeId) {
  const result = await db.prepare(
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
       ORDER BY a.data_agenda DESC`
  ).bind(storeId).all();
  return result.results;
}
async function findAppointmentForStore(db, appointmentId, storeId) {
  const prefixedColumns = APPOINTMENT_COLUMNS.split(", ").map((column) => `ag.${column}`).join(", ");
  return db.prepare(
    `SELECT ${prefixedColumns}
       FROM agendamentos ag
       JOIN agendas a ON a.id = ag.agenda_id
       WHERE ag.id = ? AND a.loja_id = ? AND ag.ativo = 1
       LIMIT 1`
  ).bind(appointmentId, storeId).first();
}
function agendaAdminAdjustmentStatement(db, agenda, userId, details, changedAt) {
  if (!details || agenda.status_dia !== "concluido") return null;
  return db.prepare(
    "INSERT INTO historico_agenda (id, agenda_id, usuario_id, acao, detalhes, alterado_em) VALUES (?, ?, ?, 'ajuste_admin', ?, ?)"
  ).bind(crypto.randomUUID(), agenda.id, userId, details, changedAt);
}
async function changeAppointmentExchanges(db, appointment, userId, hasExchanges, adminAdjustmentDetails) {
  const exchanges = hasExchanges ? 1 : 0;
  if (appointment.trocas === exchanges) return appointment;
  const agenda = await findAgendaById(db, appointment.agenda_id);
  if (!agenda) throw new Error("Agenda do agendamento n\xE3o encontrada.");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const statements = [
    db.prepare(
      "UPDATE agendamentos SET trocas = ?, atualizado_em = ? WHERE id = ?"
    ).bind(exchanges, now, appointment.id),
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
      details: "Marca\xE7\xE3o de trocas alterada.",
      createdAt: now
    })
  ];
  const adjustment = agendaAdminAdjustmentStatement(
    db,
    agenda,
    userId,
    adminAdjustmentDetails,
    now
  );
  if (adjustment) statements.push(adjustment);
  await db.batch(statements);
  const updated = await findAppointmentById(db, appointment.id);
  if (!updated) {
    throw new Error("Agendamento atualizado n\xE3o p\xF4de ser relido.");
  }
  return updated;
}
async function changeAppointmentStatus(db, appointment, userId, status, adminAdjustmentDetails, observation) {
  const previousObservation = appointment.observacao ?? null;
  // Se for apenas uma troca de status, a observação atual é limpa.
  // O histórico continua preservado para auditoria.
  const nextObservation = observation === undefined
    ? (status === appointment.status ? previousObservation : null)
    : observation;
  if (status === "nao_chegou" && !nextObservation && status !== appointment.status)
    throw new Error("Motivo obrigatório para não recebido.");
  if (appointment.status === status && previousObservation === nextObservation) return appointment;
  const agenda = await findAgendaById(db, appointment.agenda_id);
  if (!agenda) throw new Error("Agenda do agendamento não encontrada.");
  const now = new Date().toISOString();
  const historyId = crypto.randomUUID();
  const statusChanged = appointment.status !== status;
  const statements = [
    db.prepare("UPDATE agendamentos SET status = ?, observacao = ?, atualizado_em = ? WHERE id = ?")
      .bind(status, nextObservation, now, appointment.id),
    db.prepare("INSERT INTO historico_status (id, agendamento_id, usuario_id, status_anterior, status_novo, observacao, alterado_em) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(historyId, appointment.id, userId, appointment.status, status, nextObservation, now),
    auditStatement(db, {
      userId,
      action: statusChanged ? "status_alterado" : "observacao_alterada",
      entity: "agendamento",
      entityId: appointment.id,
      storeId: agenda.loja_id,
      agendaId: agenda.id,
      appointmentId: appointment.id,
      before: { status: appointment.status, observation: previousObservation },
      after: { status, observation: nextObservation },
      details: statusChanged ? "Status do recebimento alterado." : "Observação do recebimento alterada.",
      createdAt: now
    })
  ];
  const adjustment = agendaAdminAdjustmentStatement(
    db, agenda, userId, adminAdjustmentDetails, now
  );
  if (adjustment) statements.push(adjustment);
  await db.batch(statements);
  const updated = await findAppointmentById(db, appointment.id);
  if (!updated) throw new Error("Agendamento atualizado não pôde ser relido.");
  return updated;
}

async function changeAgendaDayStatus(db, agenda, userId, status) {
  if (agenda.status_dia === status) {
    const current = await findAgendaById(db, agenda.id);
    if (!current) throw new Error("Agenda n\xE3o p\xF4de ser relida.");
    return current;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const action = status === "concluido" ? "concluido" : "reaberto";
  await db.batch([
    db.prepare(
      status === "concluido" ? "UPDATE agendas SET status_dia = 'concluido', concluido_em = ?, concluido_por = ?, atualizado_em = ? WHERE id = ?" : "UPDATE agendas SET status_dia = 'aberto', concluido_em = NULL, concluido_por = NULL, atualizado_em = ? WHERE id = ?"
    ).bind(
      ...status === "concluido" ? [now, userId, now, agenda.id] : [now, agenda.id]
    ),
    db.prepare(
      "INSERT INTO historico_agenda (id, agenda_id, usuario_id, acao, detalhes, alterado_em) VALUES (?, ?, ?, ?, NULL, ?)"
    ).bind(crypto.randomUUID(), agenda.id, userId, action, now),
    auditStatement(db, {
      userId,
      action: status === "concluido" ? "dia_concluido" : "dia_reaberto",
      entity: "agenda",
      entityId: agenda.id,
      storeId: agenda.loja_id,
      agendaId: agenda.id,
      before: { dayStatus: agenda.status_dia },
      after: { dayStatus: status },
      details: status === "concluido" ? "Dia conclu\xEDdo pelo conferente ou administrador." : "Dia reaberto para ajustes.",
      createdAt: now
    })
  ]);
  const updated = await findAgendaById(db, agenda.id);
  if (!updated) throw new Error("Agenda atualizada n\xE3o p\xF4de ser relida.");
  return updated;
}
async function listAgendaHistory(db, agendaId) {
  const result = await db.prepare(
    `SELECT id, agenda_id, usuario_id, usuario_nome, acao, detalhes, alterado_em
       FROM (
         SELECT
           h.id,
           h.agenda_id,
           h.usuario_id,
           u.nome AS usuario_nome,
           h.acao,
           h.detalhes,
           h.alterado_em
         FROM historico_agenda h
         LEFT JOIN usuarios u ON u.id = h.usuario_id
         WHERE h.agenda_id = ?

         UNION ALL

         SELECT
           a.id,
           a.agenda_id,
           a.usuario_id,
           u.nome AS usuario_nome,
           'concluido_automaticamente' AS acao,
           a.detalhes,
           a.criado_em AS alterado_em
         FROM auditoria a
         LEFT JOIN usuarios u ON u.id = a.usuario_id
         WHERE a.agenda_id = ?
           AND a.entidade = 'agenda'
           AND a.acao = 'dia_concluido_automaticamente'
       )
       ORDER BY alterado_em ASC, id ASC`
  ).bind(agendaId, agendaId).all();
  return result.results;
}
export {
  AgendaBatchQueryBudgetError,
  changeAgendaDayStatus,
  changeAppointmentExchanges,
  changeAppointmentStatus,
  createAgendaImport,
  createManualAppointment,
  findAgendaById,
  findAgendaByStoreDate,
  findAppointmentById,
  findAppointmentForStore,
  findStoreAgendaByDate,
  findStoreByCode,
  importAgendaBatchAtomic,
  listAdminAgendas,
  listAgendaHistory,
  listAppointmentHistory,
  listAppointmentsByAgenda,
  listStoreAgendas,
  replaceAgendaImport,
  softDeleteManualAppointment,
  updateManualAppointmentSupplier
};