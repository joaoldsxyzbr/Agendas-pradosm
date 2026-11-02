-- Etiquetas reutilizáveis por loja, atribuídas a agendamentos individuais.
-- Migration aditiva: não altera tabelas nem dados existentes.
CREATE TABLE IF NOT EXISTS tags_loja (
  id TEXT PRIMARY KEY,
  loja_id TEXT NOT NULL REFERENCES lojas(id),
  nome TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 32),
  cor TEXT NOT NULL CHECK (cor IN ('azul','verde','amarelo','vermelho','roxo','cinza')),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  criado_em TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_loja_nome_ativo
  ON tags_loja(loja_id, nome COLLATE NOCASE) WHERE ativo = 1;
CREATE INDEX IF NOT EXISTS idx_tags_loja_loja
  ON tags_loja(loja_id, ativo);
CREATE TABLE IF NOT EXISTS agendamento_tags (
  agendamento_id TEXT NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags_loja(id),
  PRIMARY KEY (agendamento_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_agendamento_tags_tag ON agendamento_tags(tag_id);
