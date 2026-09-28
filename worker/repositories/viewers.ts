import { hashPassword } from "../lib/password";
import { auditStatement } from "./audit";
import type { UserRecord } from "./users";

export type DashboardViewerRecord = {
  id: string;
  nome: string;
  login: string;
  ativo: number;
  excluido_em: string | null;
};

type DashboardViewerInternal = DashboardViewerRecord & {
  senha_hash: string;
};

const VIEWER_SELECT = `
  SELECT u.id, u.nome, u.login, u.senha_hash, u.ativo, u.excluido_em
  FROM usuarios u
  INNER JOIN usuario_permissoes p ON p.usuario_id = u.id
  WHERE u.perfil = 'admin'
    AND p.dashboard_somente_leitura = 1
`;

export async function isDashboardViewer(
  db: D1Database,
  userId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT 1 AS presente FROM usuario_permissoes WHERE usuario_id = ? AND dashboard_somente_leitura = 1 LIMIT 1",
    )
    .bind(userId)
    .first<{ presente: number }>();

  return row !== null;
}

export async function getUserAccess(
  db: D1Database,
  user: Pick<UserRecord, "id" | "perfil">,
): Promise<"admin" | "dashboard" | "loja"> {
  if (user.perfil === "loja") return "loja";
  return (await isDashboardViewer(db, user.id)) ? "dashboard" : "admin";
}

export async function listDashboardViewers(
  db: D1Database,
): Promise<DashboardViewerRecord[]> {
  const rows = await db
    .prepare(
      `${VIEWER_SELECT}
       AND u.excluido_em IS NULL
       ORDER BY u.nome ASC`,
    )
    .all<DashboardViewerInternal>();

  return rows.results;
}

export async function findDashboardViewerById(
  db: D1Database,
  id: string,
): Promise<DashboardViewerInternal | null> {
  return db
    .prepare(
      `${VIEWER_SELECT}
       AND u.id = ?
       AND u.excluido_em IS NULL
       LIMIT 1`,
    )
    .bind(id)
    .first<DashboardViewerInternal>();
}

export async function createDashboardViewer(
  db: D1Database,
  input: { nome: string; login: string; senha: string },
  actorUserId: string,
): Promise<DashboardViewerRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.senha);

  await db.batch([
    db
      .prepare(
        "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) VALUES (?, NULL, ?, ?, ?, 'admin', 1, ?, ?)",
      )
      .bind(id, input.nome, input.login, passwordHash, now, now),
    db
      .prepare(
        "INSERT INTO usuario_permissoes (usuario_id, dashboard_somente_leitura, criado_em, atualizado_em) VALUES (?, 1, ?, ?)",
      )
      .bind(id, now, now),
    auditStatement(db, {
      userId: actorUserId,
      action: "visualizador_criado",
      entity: "usuario",
      entityId: id,
      after: {
        nome: input.nome,
        login: input.login,
        perfil: "visualizador",
        ativo: true,
        senhaAlterada: true,
      },
      details: "Visualizador do dashboard criado.",
      createdAt: now,
    }),
  ]);

  return (await findDashboardViewerById(db, id))!;
}

export async function updateDashboardViewer(
  db: D1Database,
  current: DashboardViewerInternal,
  input: {
    nome?: string;
    login?: string;
    senha?: string;
    ativo?: boolean;
  },
  actorUserId: string,
): Promise<DashboardViewerRecord> {
  const nome = input.nome ?? current.nome;
  const login = input.login ?? current.login;
  const ativo =
    input.ativo === undefined ? current.ativo : input.ativo ? 1 : 0;
  const passwordHash = input.senha
    ? await hashPassword(input.senha)
    : current.senha_hash;
  const now = new Date().toISOString();

  await db.batch([
    db
      .prepare(
        "UPDATE usuarios SET nome = ?, login = ?, senha_hash = ?, ativo = ?, atualizado_em = ? WHERE id = ? AND perfil = 'admin' AND excluido_em IS NULL",
      )
      .bind(nome, login, passwordHash, ativo, now, current.id),
    db
      .prepare(
        "UPDATE usuario_permissoes SET atualizado_em = ? WHERE usuario_id = ? AND dashboard_somente_leitura = 1",
      )
      .bind(now, current.id),
    auditStatement(db, {
      userId: actorUserId,
      action: "visualizador_atualizado",
      entity: "usuario",
      entityId: current.id,
      before: {
        nome: current.nome,
        login: current.login,
        perfil: "visualizador",
        ativo: current.ativo === 1,
      },
      after: {
        nome,
        login,
        perfil: "visualizador",
        ativo: ativo === 1,
        senhaAlterada: Boolean(input.senha),
      },
      details: "Visualizador do dashboard atualizado.",
      createdAt: now,
    }),
  ]);

  return (await findDashboardViewerById(db, current.id))!;
}

export async function softDeleteDashboardViewer(
  db: D1Database,
  current: DashboardViewerRecord,
  actorUserId: string,
): Promise<boolean> {
  const now = new Date().toISOString();

  const [result] = await db.batch([
    db
      .prepare(
        "UPDATE usuarios SET ativo = 0, excluido_em = ?, atualizado_em = ? WHERE id = ? AND perfil = 'admin' AND excluido_em IS NULL",
      )
      .bind(now, now, current.id),
    auditStatement(db, {
      userId: actorUserId,
      action: "visualizador_removido",
      entity: "usuario",
      entityId: current.id,
      before: {
        nome: current.nome,
        login: current.login,
        perfil: "visualizador",
        ativo: current.ativo === 1,
      },
      after: {
        nome: current.nome,
        login: current.login,
        perfil: "visualizador",
        ativo: false,
        removido: true,
      },
      details: "Visualizador do dashboard removido logicamente.",
      createdAt: now,
    }),
  ]);

  return result.meta.changes > 0;
}
