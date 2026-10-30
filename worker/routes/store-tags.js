import { Hono } from "hono";
import { z } from "zod";
import { auditStatement } from "../repositories/audit.js";
import { findAgendaById, findAppointmentForStore, findStoreAgendaByDate } from "../repositories/agendas.js";
import { publishAgendaChanged } from "../services/realtime.js";

export const storeTagsRoutes = new Hono();
const TagInput = z.object({
  name: z.string().trim().min(1).max(32),
  color: z.enum(["azul", "verde", "amarelo", "vermelho", "roxo", "cinza"])
});
const AssignmentInput = z.object({
  tagIds: z.array(z.string().uuid()).max(5)
});
const DateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function userForTags(c) {
  const user = c.get("authUser");
  return user?.papel === "conferente" && user.lojaId ? user : null;
}
function denied(c) {
  return c.json({ error: "ACESSO_NEGADO", message: "Acesso não permitido." }, 403);
}
function tagJson(tag) {
  return { id: tag.id, name: tag.nome, color: tag.cor };
}
async function storeTags(db, storeId) {
  const rows = await db.prepare(
    "SELECT id, nome, cor FROM tags_loja WHERE loja_id = ? AND ativo = 1 ORDER BY nome COLLATE NOCASE, id"
  ).bind(storeId).all();
  return rows.results.map(tagJson);
}

storeTagsRoutes.get("", async c => {
  const user = userForTags(c);
  if (!user) return denied(c);
  return c.json(await storeTags(c.env.DB, user.lojaId));
});

storeTagsRoutes.post("", async c => {
  const user = userForTags(c);
  if (!user) return denied(c);
  const parsed = TagInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "REQUISICAO_INVALIDA", message: "Informe um nome de até 32 caracteres e uma cor válida." }, 400);
  const { name, color } = parsed.data;
  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) AS total FROM tags_loja WHERE loja_id = ? AND ativo = 1"
  ).bind(user.lojaId).first();
  if (Number(count?.total || 0) >= 100) return c.json({ error: "LIMITE_TAGS", message: "Limite de 100 tags por loja." }, 409);
  const id = crypto.randomUUID(), now = new Date().toISOString();
  try {
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO tags_loja (id, loja_id, nome, cor, criado_em) VALUES (?, ?, ?, ?, ?)").bind(id, user.lojaId, name, color, now),
      auditStatement(c.env.DB, { userId:user.id, action:"tag_criada", entity:"tag", entityId:id,
        storeId:user.lojaId, after:{name,color}, createdAt:now })
    ]);
    return c.json({ id, name, color }, 201);
  } catch (error) {
    if (String(error?.message || "").includes("UNIQUE constraint failed"))
      return c.json({ error:"TAG_DUPLICADA", message:"Já existe uma tag com este nome." }, 409);
    throw error;
  }
});

storeTagsRoutes.delete("/:id", async c => {
  const user = userForTags(c);
  if (!user) return denied(c);
  const tag = await c.env.DB.prepare(
    "SELECT id,nome,cor FROM tags_loja WHERE id = ? AND loja_id = ? AND ativo = 1"
  ).bind(c.req.param("id"), user.lojaId).first();
  if (!tag) return c.json({ error:"TAG_NAO_ENCONTRADA", message:"Tag não encontrada." },404);
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE tags_loja SET ativo = 0 WHERE id = ? AND loja_id = ? AND ativo = 1").bind(tag.id,user.lojaId),
    auditStatement(c.env.DB, {userId:user.id, action:"tag_arquivada",entity:"tag",entityId:tag.id,
      storeId:user.lojaId,before:tagJson(tag),createdAt:now,onlyIfPreviousWrite:true})
  ]);
  return c.body(null,204);
});

storeTagsRoutes.get("/agenda/:date", async c => {
  const user = userForTags(c);
  if (!user) return denied(c);
  const parsed = DateInput.safeParse(c.req.param("date"));
  if (!parsed.success) return c.json({error:"REQUISICAO_INVALIDA",message:"Data inválida."},400);
  const tags = await storeTags(c.env.DB,user.lojaId);
  const agenda = await findStoreAgendaByDate(c.env.DB,user.lojaId,parsed.data);
  const assignments = {};
  if (agenda) {
    const rows = await c.env.DB.prepare(
      `SELECT at.agendamento_id, t.id, t.nome, t.cor
         FROM agendamento_tags at
         JOIN tags_loja t ON t.id = at.tag_id
         JOIN agendamentos a ON a.id = at.agendamento_id
         WHERE a.agenda_id = ? AND a.ativo = 1 AND t.loja_id = ?
         ORDER BY t.nome COLLATE NOCASE, t.id`
    ).bind(agenda.id,user.lojaId).all();
    for (const row of rows.results) {
      (assignments[row.agendamento_id] ||= []).push(tagJson(row));
    }
  }
  return c.json({tags,assignments});
});

storeTagsRoutes.put("/appointments/:id", async c => {
  const user = userForTags(c);
  if (!user) return denied(c);
  const parsed = AssignmentInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || new Set(parsed.data?.tagIds || []).size !== parsed.data?.tagIds.length)
    return c.json({error:"REQUISICAO_INVALIDA",message:"Selecione até cinco tags diferentes."},400);
  const appointment = await findAppointmentForStore(c.env.DB,c.req.param("id"),user.lojaId);
  if (!appointment) return c.json({error:"AGENDAMENTO_NAO_ENCONTRADO",message:"Agendamento não encontrado."},404);
  const agenda = await findAgendaById(c.env.DB,appointment.agenda_id);
  if (!agenda || agenda.loja_id !== user.lojaId) return denied(c);
  if (agenda.status_dia !== "aberto") return c.json({error:"DIA_CONCLUIDO",message:"Este dia está concluído."},409);
  const ids = parsed.data.tagIds;
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const owned = await c.env.DB.prepare(
      `SELECT id FROM tags_loja WHERE loja_id = ? AND ativo = 1 AND id IN (${placeholders})`
    ).bind(user.lojaId,...ids).all();
    if (owned.results.length !== ids.length)
      return c.json({error:"TAG_INVALIDA",message:"Uma das tags não está disponível para esta loja."},400);
  }
  const now = new Date().toISOString();
  const statements = [
    c.env.DB.prepare("DELETE FROM agendamento_tags WHERE agendamento_id = ?").bind(appointment.id),
    ...ids.map(id => c.env.DB.prepare(
      "INSERT INTO agendamento_tags (agendamento_id, tag_id) VALUES (?, ?)"
    ).bind(appointment.id,id)),
    auditStatement(c.env.DB, {userId:user.id,action:"tags_agendamento_alteradas",entity:"agendamento",
      entityId:appointment.id,storeId:user.lojaId,agendaId:agenda.id,appointmentId:appointment.id,
      after:{tagIds:ids},createdAt:now})
  ];
  await c.env.DB.batch(statements);
  const current = await c.env.DB.prepare(
    `SELECT t.id, t.nome, t.cor FROM agendamento_tags at
     JOIN tags_loja t ON t.id=at.tag_id
     WHERE at.agendamento_id=? AND t.loja_id=? ORDER BY t.nome COLLATE NOCASE`
  ).bind(appointment.id,user.lojaId).all();
  await publishAgendaChanged(c.env,{agendaId:agenda.id,storeId:agenda.loja_id,date:agenda.data_agenda,reason:"tags"});
  return c.json({tags:current.results.map(tagJson)});
});
