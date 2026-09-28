ALTER TABLE usuarios
  ADD COLUMN papel TEXT NOT NULL DEFAULT 'conferente'
    CHECK (papel IN ('admin', 'conferente', 'visualizador'));

UPDATE usuarios
SET papel = CASE
  WHEN perfil = 'loja' THEN 'conferente'
  WHEN EXISTS (
    SELECT 1
    FROM usuario_permissoes p
    WHERE p.usuario_id = usuarios.id
      AND p.dashboard_somente_leitura = 1
  ) THEN 'visualizador'
  ELSE 'admin'
END;

CREATE TRIGGER trg_usuarios_legacy_papel
AFTER INSERT ON usuarios
WHEN NEW.perfil = 'admin' AND NEW.papel = 'conferente'
BEGIN
  UPDATE usuarios
  SET papel = 'admin'
  WHERE id = NEW.id;
END;

CREATE TRIGGER trg_usuario_permissoes_legacy_visualizador
AFTER INSERT ON usuario_permissoes
WHEN NEW.dashboard_somente_leitura = 1
BEGIN
  UPDATE usuarios
  SET papel = 'visualizador'
  WHERE id = NEW.usuario_id;
END;
