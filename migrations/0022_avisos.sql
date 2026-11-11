-- Avisos publicados por admins e eventos operacionais automáticos,
-- com estado de leitura por usuário (avisos_lidos).
-- Soft delete via inativo_em; expiração opcional (expira_em) filtrada na leitura.
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
  ON avisos(inativo_em, expira_em, criado_em DESC);

CREATE INDEX idx_avisos_lidos_usuario
  ON avisos_lidos(usuario_id);
