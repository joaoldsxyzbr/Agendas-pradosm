PRAGMA foreign_keys = ON;

CREATE TABLE lojas (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE usuarios (
  id TEXT PRIMARY KEY,
  loja_id TEXT REFERENCES lojas(id),
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'loja')),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  CHECK ((perfil = 'admin') OR (perfil = 'loja' AND loja_id IS NOT NULL))
);

CREATE TABLE agendas (
  id TEXT PRIMARY KEY,
  loja_id TEXT NOT NULL REFERENCES lojas(id),
  data_agenda TEXT NOT NULL,
  arquivo_original TEXT NOT NULL,
  criado_por TEXT NOT NULL REFERENCES usuarios(id),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  UNIQUE (loja_id, data_agenda)
);

CREATE TABLE agendamentos (
  id TEXT PRIMARY KEY,
  agenda_id TEXT NOT NULL REFERENCES agendas(id),
  protocolo TEXT NOT NULL,
  horario_inicio TEXT NOT NULL,
  horario_fim TEXT NOT NULL,
  fornecedor TEXT NOT NULL,
  itens INTEGER,
  volumes INTEGER,
  paletes INTEGER,
  carga_batida TEXT,
  tipo TEXT,
  nfe TEXT NOT NULL DEFAULT '[]',
  pedidos TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando','recebido','nao_chegou','recusado')),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  UNIQUE (agenda_id, protocolo)
);

CREATE TABLE historico_status (
  id TEXT PRIMARY KEY,
  agendamento_id TEXT NOT NULL REFERENCES agendamentos(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  status_anterior TEXT NOT NULL,
  status_novo TEXT NOT NULL,
  alterado_em TEXT NOT NULL
);

CREATE INDEX idx_agendas_loja_data ON agendas(loja_id, data_agenda);
CREATE INDEX idx_agendamentos_agenda_horario ON agendamentos(agenda_id, horario_inicio);
CREATE INDEX idx_historico_agendamento ON historico_status(agendamento_id, alterado_em);
