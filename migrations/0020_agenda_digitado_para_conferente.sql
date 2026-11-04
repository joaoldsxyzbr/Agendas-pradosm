-- Marcação interna do administrador: agenda já digitada/repassada para o conferente.
-- Uso exclusivo da tela de Agendas (administração); invisível para o conferente.
ALTER TABLE agendas
ADD COLUMN digitado_em TEXT;

ALTER TABLE agendas
ADD COLUMN digitado_por TEXT REFERENCES usuarios(id);
