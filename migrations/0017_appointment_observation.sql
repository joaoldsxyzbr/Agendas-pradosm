ALTER TABLE agendamentos ADD COLUMN observacao TEXT CHECK (observacao IS NULL OR length(observacao) <= 240);
