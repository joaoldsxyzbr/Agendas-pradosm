// Repositório de avisos/notificações in-app (spec 2026-11-11, melhorias de
// 12/11/2026). Eventos automáticos entram no MESMO db.batch da operação que
// os origina: operação gravada sem aviso é estado inconsistente (decisão 5).
// Avisos são registro permanente: sem filtro de expiração/inativação — a
// lista é o histórico completo, do mais recente para o mais antigo.

// Filtro de direcionamento por loja: aviso sem linhas em avisos_lojas é de
// todas as lojas; com linhas, só quem tem a loja (ou vê tudo) o enxerga.
function visibilidadePorLoja(loja) {
  return loja
    ? "(SELECT COUNT(*) FROM avisos_lojas x WHERE x.aviso_id = a.id) = 0 " +
        "OR EXISTS (SELECT 1 FROM avisos_lojas x WHERE x.aviso_id = a.id AND x.loja = ?)"
    : "";
}

// Eventos automáticos são do admin/gerente: o conferente recebe apenas os
// avisos publicados pelo admin (decisão de 12/11/2026 — sem ruído de
// operações de lojas alheias no sino de quem confere).
function filtroTipo(verEventos) {
  return verEventos ? "" : "a.tipo = 'aviso'";
}

// Lista os avisos com o estado "lido" do usuário, do mais recente para o
// mais antigo (decisão de 12/11: lista única, sem separação de histórico).
// Limitado aos últimos `limit`. Admin/visualizador (loja null) veem tudo.
export async function listAvisos(db, userId, loja = null, verEventos = true, limit = 50) {
  const filtroLoja = visibilidadePorLoja(loja);
  const tipo = filtroTipo(verEventos);
  const where = [tipo, filtroLoja ? "(" + filtroLoja + ")" : ""].filter(Boolean).join(" AND ");
  // Separador char(31) (unit separator): código de loja com vírgula não pode
  // quebrar o GROUP_CONCAT vindo do D1.
  const lojasSelect =
    "(SELECT GROUP_CONCAT(x.loja, char(31)) FROM avisos_lojas x WHERE x.aviso_id = a.id) AS lojas";
  const rows = await db.prepare(
    `SELECT a.id, a.tipo, a.titulo, a.mensagem, a.criado_em, a.urgente, a.autor,
            ${lojasSelect},
            CASE WHEN l.usuario_id IS NULL THEN 0 ELSE 1 END AS lido
       FROM avisos a
       LEFT JOIN avisos_lidos l ON l.aviso_id = a.id AND l.usuario_id = ?
      ${where ? "WHERE " + where : ""}
      ORDER BY a.criado_em DESC, a.id DESC
      LIMIT ?`
  ).bind(...(loja ? [userId, loja, limit] : [userId, limit])).all();
  const unread = await db.prepare(
    `SELECT COUNT(*) AS total
       FROM avisos a
      WHERE ${where ? where + " AND " : ""}NOT EXISTS (
          SELECT 1 FROM avisos_lidos l
           WHERE l.aviso_id = a.id AND l.usuario_id = ?
        )`
  ).bind(...(loja ? [loja, userId] : [userId])).first();
  return { avisos: rows.results, naoLidos: unread?.total ?? 0 };
}

// Marca um aviso como lido para o usuário — apenas o que ele enxerga (mesmo
// filtro de loja e tipo da listagem). Idempotente: marcar de novo não
// regrava (INSERT OR IGNORE na PK composta); aviso invisível responde igual
// a já lido, sem vazar existência fora do que o usuário vê.
export async function markAvisoLido(db, avisoId, userId, now, loja = null, verEventos = true) {
  const filtroLoja = visibilidadePorLoja(loja);
  const tipo = filtroTipo(verEventos);
  const where = [tipo, filtroLoja ? "(" + filtroLoja + ")" : ""].filter(Boolean).join(" AND ");
  const result = await db.prepare(
    `INSERT OR IGNORE INTO avisos_lidos (aviso_id, usuario_id, lido_em)
      SELECT ?, ?, ? WHERE EXISTS (
        SELECT 1 FROM avisos a WHERE a.id = ?${where ? " AND " + where : ""}
      )`
  ).bind(...(loja ? [avisoId, userId, now, avisoId, loja] : [avisoId, userId, now, avisoId])).run();
  return result?.meta?.changes === 1;
}

// Marca todos os avisos visíveis ao usuário como lidos ("Marcar todos" do
// painel). Idempotente por aviso (INSERT OR IGNORE); respeita o
// direcionamento por loja e o filtro de tipo (conferente só marca o que vê).
// Retorna quantos viraram lidos agora.
export async function markTodosAvisosLidos(db, userId, now, loja = null, verEventos = true) {
  const filtroLoja = visibilidadePorLoja(loja);
  const tipo = filtroTipo(verEventos);
  const where = [tipo, filtroLoja ? "(" + filtroLoja + ")" : ""].filter(Boolean).join(" AND ");
  const result = await db.prepare(
    `INSERT OR IGNORE INTO avisos_lidos (aviso_id, usuario_id, lido_em)
      SELECT a.id, ?, ? FROM avisos a
      ${where ? "WHERE " + where + " AND " : "WHERE "}NOT EXISTS (
        SELECT 1 FROM avisos_lidos l
         WHERE l.aviso_id = a.id AND l.usuario_id = ?
      )`
  ).bind(...(loja ? [userId, now, loja, userId] : [userId, now, userId])).run();
  return result?.meta?.changes ?? 0;
}

// Mapeia a linha do D1 para o contrato camelCase do frontend (shared/avisos.ts).
export function avisoJson(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    titulo: row.titulo,
    mensagem: row.mensagem,
    criadoEm: row.criado_em,
    lido: row.lido === 1,
    urgente: row.urgente === 1,
    autor: row.autor ?? "Sistema",
    lojas: row.lojas ? String(row.lojas).split("\u001f") : null
  };
}

// Statements de INSERT do aviso publicado pelo admin (com urgência, autor e
// direcionamento por loja); entram no mesmo batch da auditoria
// (aviso_publicado) na rota. O `id` opcional permite casar o INSERT com o
// entityId gravado na auditoria.
export function publishAvisoStatements(db, { id, titulo, mensagem, criadoPor, autor, criadoEm, urgente, lojas }) {
  const avisoId = id ?? crypto.randomUUID();
  const statements = [
    db.prepare(
      "INSERT INTO avisos (id, tipo, titulo, mensagem, criado_por, criado_em, urgente, autor) VALUES (?, 'aviso', ?, ?, ?, ?, ?, ?)"
    ).bind(avisoId, titulo, mensagem, criadoPor, criadoEm, urgente ? 1 : 0, autor)
  ];
  for (const loja of lojas ?? []) {
    statements.push(
      db.prepare("INSERT INTO avisos_lojas (aviso_id, loja) VALUES (?, ?)").bind(avisoId, loja)
    );
  }
  return statements;
}

// Statement reutilizável do evento automático, para dentro do db.batch da
// operação. `guardAuditId`: só grava o aviso se a auditoria da operação
// registrou (padrão onlyIfPreviousWrite — falha silenciosa se a operação
// não alterou nada). Urgência 0 e autor 'Sistema' vêm do DEFAULT de 0023.
export function avisoEventoStatement(db, { titulo, mensagem, criadoEm, guardAuditId = null }) {
  const id = crypto.randomUUID();
  if (guardAuditId) {
    return db.prepare(
      "INSERT INTO avisos (id, tipo, titulo, mensagem, criado_por, criado_em) " +
      "SELECT ?, 'evento', ?, ?, NULL, ? WHERE EXISTS (SELECT 1 FROM auditoria WHERE id = ?)"
    ).bind(id, titulo, mensagem, criadoEm, guardAuditId);
  }
  return db.prepare(
    "INSERT INTO avisos (id, tipo, titulo, mensagem, criado_por, criado_em) VALUES (?, 'evento', ?, ?, NULL, ?)"
  ).bind(id, titulo, mensagem, criadoEm);
}
