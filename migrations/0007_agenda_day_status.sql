ALTER TABLE agendas
ADD COLUMN status_dia TEXT NOT NULL DEFAULT 'aberto'
CHECK (status_dia IN ('aberto', 'concluido'));

ALTER TABLE agendas
ADD COLUMN concluido_em TEXT;

ALTER TABLE agendas
ADD COLUMN concluido_por TEXT REFERENCES usuarios(id);

CREATE TABLE historico_agenda (
  id TEXT PRIMARY KEY,
  agenda_id TEXT NOT NULL REFERENCES agendas(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  acao TEXT NOT NULL CHECK (acao IN ('concluido', 'reaberto', 'ajuste_admin')),
  detalhes TEXT,
  alterado_em TEXT NOT NULL
);

CREATE INDEX idx_historico_agenda
ON historico_agenda(agenda_id, alterado_em);
