-- Avisos e notificações in-app (spec docs/specs/2026-11-11-avisos-notificacoes-design.md).
-- "aviso" é publicado pelo admin; "evento" é gerado automaticamente pelo sistema
-- na mesma transação da operação. avisos_lidos guarda o estado por usuário (badge).
PRAGMA foreign_keys = ON;

CREATE TABLE avisos (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('aviso', 'evento')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  criado_por TEXT REFERENCES usuarios(id),
  criado_em TEXT NOT NULL,
  expira_em TEXT,
  inativo_em TEXT
);

CREATE TABLE avisos_lidos (
  aviso_id TEXT NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  lido_em TEXT NOT NULL,
  PRIMARY KEY (aviso_id, usuario_id)
);

CREATE INDEX idx_avisos_leitura
  ON avisos (inativo_em, criado_em DESC);
