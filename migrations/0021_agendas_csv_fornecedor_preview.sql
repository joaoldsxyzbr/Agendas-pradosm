-- Somente preview: campos originais do CSV e controle interno de digitação.
-- Não modifica situação do dia, status operacional ou API do conferente.
ALTER TABLE agendamentos ADD COLUMN csv_campos TEXT;

CREATE TABLE IF NOT EXISTS agenda_digitacao_fornecedor (
  agenda_id TEXT NOT NULL REFERENCES agendas(id),
  fornecedor_chave TEXT NOT NULL,
  fornecedor_nome TEXT NOT NULL,
  dados_hash TEXT NOT NULL,
  digitado_em TEXT,
  digitado_por TEXT REFERENCES usuarios(id),
  PRIMARY KEY (agenda_id, fornecedor_chave)
);
