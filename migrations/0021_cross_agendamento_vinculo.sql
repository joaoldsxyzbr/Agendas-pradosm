-- P1: vínculo opcional (compatibilidade com Cross legado) à agenda e ao agendamento da CD Doca 01.
-- Somente relatórios novos usam estes campos; nenhum relatório existente é alterado.
ALTER TABLE cross_relatorios ADD COLUMN agenda_id TEXT REFERENCES agendas(id);
ALTER TABLE cross_relatorios ADD COLUMN agendamento_id TEXT REFERENCES agendamentos(id);
ALTER TABLE cross_relatorios ADD COLUMN versao INTEGER NOT NULL DEFAULT 1 CHECK (versao >= 1);
ALTER TABLE cross_relatorios ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1));

-- Apenas um relatório ativo por agendamento. Versões antigas permanecem consultáveis.
CREATE UNIQUE INDEX idx_cross_agendamento_versao
  ON cross_relatorios(agendamento_id, versao) WHERE agendamento_id IS NOT NULL;
CREATE UNIQUE INDEX idx_cross_agendamento_ativo
  ON cross_relatorios(agendamento_id) WHERE agendamento_id IS NOT NULL AND ativo = 1;
CREATE INDEX idx_cross_agenda_ativo
  ON cross_relatorios(agenda_id, ativo, criado_em DESC);

-- Proteção D1: ninguém pode vincular Cross a agendamento de outra doca, dia ou agenda.
CREATE TRIGGER trg_cross_vinculo_insert
BEFORE INSERT ON cross_relatorios
WHEN NEW.agenda_id IS NOT NULL OR NEW.agendamento_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM agendamentos ag
    JOIN agendas a ON a.id = ag.agenda_id
    JOIN lojas l ON l.id = a.loja_id
    WHERE ag.id = NEW.agendamento_id
      AND a.id = NEW.agenda_id
      AND a.data_agenda = NEW.data_operacional
      AND ag.ativo = 1
      AND l.codigo = 'CD DOCA 01' COLLATE NOCASE
      AND l.ativo = 1 AND l.excluido_em IS NULL
  ) THEN RAISE(ABORT, 'CROSS_AGENDAMENTO_INVALIDO') END;
END;

CREATE TRIGGER trg_cross_vinculo_update
BEFORE UPDATE OF agenda_id, agendamento_id, data_operacional ON cross_relatorios
WHEN NEW.agenda_id IS NOT NULL OR NEW.agendamento_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM agendamentos ag
    JOIN agendas a ON a.id = ag.agenda_id
    JOIN lojas l ON l.id = a.loja_id
    WHERE ag.id = NEW.agendamento_id
      AND a.id = NEW.agenda_id
      AND a.data_agenda = NEW.data_operacional
      AND l.codigo = 'CD DOCA 01' COLLATE NOCASE
      AND l.ativo = 1 AND l.excluido_em IS NULL
  ) THEN RAISE(ABORT, 'CROSS_AGENDAMENTO_INVALIDO') END;
END;
