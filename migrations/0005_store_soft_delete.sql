ALTER TABLE lojas ADD COLUMN excluido_em TEXT;

CREATE INDEX idx_lojas_excluido
  ON lojas(excluido_em);
