-- Expansão aditiva de diagnósticos, compatível com Preview que já aplicou 0018.
ALTER TABLE diagnosticos ADD COLUMN loja_id TEXT REFERENCES lojas(id);
ALTER TABLE diagnosticos ADD COLUMN duracao_ms INTEGER;
CREATE INDEX idx_diagnosticos_loja ON diagnosticos(loja_id, criado_em DESC);
