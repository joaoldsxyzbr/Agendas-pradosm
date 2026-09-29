CREATE UNIQUE INDEX idx_lojas_codigo_nocase
  ON lojas(codigo COLLATE NOCASE);
