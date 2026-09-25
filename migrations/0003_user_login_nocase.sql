CREATE UNIQUE INDEX idx_usuarios_login_nocase
  ON usuarios(login COLLATE NOCASE);
