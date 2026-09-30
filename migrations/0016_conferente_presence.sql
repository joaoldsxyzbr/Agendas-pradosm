CREATE TABLE conferente_presenca (
  usuario_id TEXT PRIMARY KEY,
  loja_id TEXT NOT NULL,
  ultima_interacao_em TEXT,
  ultimo_sinal_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (loja_id) REFERENCES lojas(id)
);

CREATE INDEX idx_conferente_presenca_loja
  ON conferente_presenca(loja_id);
