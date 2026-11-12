-- Melhorias nos avisos (protótipo aprovado em 12/11/2026):
-- urgência, direcionamento por loja e autor visível.
-- Avisos são registro permanente: as colunas expira_em e inativo_em de 0022
-- deixam de ser usadas pelo código (sem expiração e sem inativação), mas
-- permanecem no schema para preservar a história já gravada.
PRAGMA foreign_keys = ON;

ALTER TABLE avisos ADD COLUMN urgente INTEGER NOT NULL DEFAULT 0 CHECK (urgente IN (0, 1));
ALTER TABLE avisos ADD COLUMN autor TEXT NOT NULL DEFAULT 'Sistema';

-- Direcionamento por loja: sem linhas em avisos_lojas o aviso é de todas as
-- lojas; com linhas, só as lojas listadas (e admin/visualizador) o veem.
CREATE TABLE avisos_lojas (
  aviso_id TEXT NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,
  loja TEXT NOT NULL,
  PRIMARY KEY (aviso_id, loja)
);
