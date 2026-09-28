CREATE TABLE usuario_permissoes (
  usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  dashboard_somente_leitura INTEGER NOT NULL DEFAULT 0
    CHECK (dashboard_somente_leitura IN (0, 1)),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE INDEX idx_usuario_permissoes_dashboard
  ON usuario_permissoes(dashboard_somente_leitura);
