ALTER TABLE usuarios ADD COLUMN excluido_em TEXT;

CREATE INDEX idx_usuarios_perfil_excluido
  ON usuarios(perfil, excluido_em);
