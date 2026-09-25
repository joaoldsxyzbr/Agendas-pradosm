ALTER TABLE agendamentos
ADD COLUMN origem TEXT NOT NULL DEFAULT 'importado'
CHECK (origem IN ('importado', 'manual'));
