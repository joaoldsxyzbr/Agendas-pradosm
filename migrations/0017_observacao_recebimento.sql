-- Expansão não destrutiva: observações de recebimentos.
ALTER TABLE agendamentos ADD COLUMN observacao TEXT;
ALTER TABLE historico_status ADD COLUMN observacao TEXT;
