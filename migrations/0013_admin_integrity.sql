CREATE TRIGGER trg_usuarios_preserva_ultimo_admin_update
BEFORE UPDATE OF papel, ativo, excluido_em ON usuarios
FOR EACH ROW
WHEN OLD.papel = 'admin'
  AND OLD.ativo = 1
  AND OLD.excluido_em IS NULL
  AND NOT (
    NEW.papel = 'admin'
    AND NEW.ativo = 1
    AND NEW.excluido_em IS NULL
  )
  AND (
    SELECT COUNT(*)
    FROM usuarios
    WHERE papel = 'admin'
      AND ativo = 1
      AND excluido_em IS NULL
  ) <= 1
BEGIN
  SELECT RAISE(ABORT, 'ULTIMO_ADMIN_ATIVO');
END;

CREATE TRIGGER trg_usuarios_preserva_ultimo_admin_delete
BEFORE DELETE ON usuarios
FOR EACH ROW
WHEN OLD.papel = 'admin'
  AND OLD.ativo = 1
  AND OLD.excluido_em IS NULL
  AND (
    SELECT COUNT(*)
    FROM usuarios
    WHERE papel = 'admin'
      AND ativo = 1
      AND excluido_em IS NULL
  ) <= 1
BEGIN
  SELECT RAISE(ABORT, 'ULTIMO_ADMIN_ATIVO');
END;
