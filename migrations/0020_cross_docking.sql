-- Dados de Cross-Docking independentes de agendas e de recebimentos.
CREATE TABLE cross_relatorios (
  id TEXT PRIMARY KEY,
  data_operacional TEXT NOT NULL,
  data_relatorio TEXT NOT NULL,
  codigo_relatorio TEXT NOT NULL,
  referencia TEXT,
  arquivo_original TEXT NOT NULL,
  hash_conteudo TEXT NOT NULL UNIQUE,
  lojas INTEGER NOT NULL CHECK (lojas > 0),
  linhas INTEGER NOT NULL CHECK (linhas > 0),
  quantidade_expedicao INTEGER NOT NULL CHECK (quantidade_expedicao >= 0),
  quantidade_separar INTEGER NOT NULL CHECK (quantidade_separar >= 0),
  criado_por TEXT NOT NULL REFERENCES usuarios(id),
  criado_em TEXT NOT NULL
);
CREATE INDEX idx_cross_relatorios_data ON cross_relatorios(data_operacional, criado_em DESC);

CREATE TABLE cross_itens (
  id TEXT PRIMARY KEY,
  relatorio_id TEXT NOT NULL REFERENCES cross_relatorios(id),
  ordem INTEGER NOT NULL,
  loja_numero TEXT NOT NULL,
  loja_nome TEXT NOT NULL,
  departamento TEXT NOT NULL,
  pedido TEXT NOT NULL,
  produto_codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  gtin TEXT NOT NULL,
  expedicao_codigo TEXT NOT NULL,
  embalagem INTEGER NOT NULL,
  quantidade_expedicao INTEGER NOT NULL,
  quantidade_separar INTEGER NOT NULL,
  UNIQUE (relatorio_id, ordem)
);
CREATE INDEX idx_cross_itens_relatorio ON cross_itens(relatorio_id, ordem);
