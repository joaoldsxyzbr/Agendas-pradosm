PRAGMA defer_foreign_keys = true;

CREATE TABLE usuarios_novo (
  id TEXT PRIMARY KEY,
  loja_id TEXT REFERENCES lojas(id),
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'conferente'
    CHECK (papel IN ('admin', 'conferente', 'visualizador')),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  excluido_em TEXT,
  CHECK (papel <> 'conferente' OR loja_id IS NOT NULL)
);

INSERT INTO usuarios_novo (
  id,
  loja_id,
  nome,
  login,
  senha_hash,
  papel,
  ativo,
  criado_em,
  atualizado_em,
  excluido_em
)
SELECT
  id,
  loja_id,
  nome,
  login,
  senha_hash,
  papel,
  ativo,
  criado_em,
  atualizado_em,
  excluido_em
FROM usuarios;

DROP TABLE usuarios;
ALTER TABLE usuarios_novo RENAME TO usuarios;

CREATE UNIQUE INDEX idx_usuarios_login_nocase
  ON usuarios(login COLLATE NOCASE);

CREATE INDEX idx_usuarios_papel_excluido
  ON usuarios(papel, excluido_em);

PRAGMA defer_foreign_keys = false;
