CREATE TABLE auditoria (
  id TEXT PRIMARY KEY,
  usuario_id TEXT REFERENCES usuarios(id),
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  loja_id TEXT REFERENCES lojas(id),
  agenda_id TEXT REFERENCES agendas(id),
  agendamento_id TEXT REFERENCES agendamentos(id),
  antes TEXT,
  depois TEXT,
  detalhes TEXT,
  criado_em TEXT NOT NULL
);

CREATE INDEX idx_auditoria_entidade
ON auditoria(entidade, entidade_id, criado_em);

CREATE INDEX idx_auditoria_agenda
ON auditoria(agenda_id, criado_em);

CREATE INDEX idx_auditoria_usuario
ON auditoria(usuario_id, criado_em);

CREATE INDEX idx_auditoria_criado_em
ON auditoria(criado_em);
