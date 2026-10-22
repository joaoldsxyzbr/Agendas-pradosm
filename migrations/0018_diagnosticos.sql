-- Eventos técnicos e operacionais separados da auditoria de alterações de negócio.
-- Somente códigos controlados: nunca persistir stack, arquivo, payload, IP, token ou mensagem arbitrária.
CREATE TABLE diagnosticos (
  id TEXT PRIMARY KEY,
  usuario_id TEXT REFERENCES usuarios(id),
  loja_id TEXT REFERENCES lojas(id),
  origem TEXT NOT NULL CHECK (origem IN ('browser', 'worker')),
  nivel TEXT NOT NULL CHECK (nivel IN ('info', 'warning', 'error')),
  evento TEXT NOT NULL,
  operacao TEXT NOT NULL,
  formato TEXT,
  quantidade INTEGER,
  http_status INTEGER,
  correlacao TEXT NOT NULL,
  criado_em TEXT NOT NULL
);
CREATE INDEX idx_diagnosticos_data ON diagnosticos(criado_em DESC);
CREATE INDEX idx_diagnosticos_filtro ON diagnosticos(nivel, operacao, criado_em DESC);
CREATE INDEX idx_diagnosticos_usuario ON diagnosticos(usuario_id, criado_em DESC);
CREATE INDEX idx_diagnosticos_loja ON diagnosticos(loja_id, criado_em DESC);