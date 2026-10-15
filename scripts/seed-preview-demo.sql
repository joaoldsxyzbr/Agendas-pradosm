-- Apenas para D1 exclusivo do Worker agendas-pradosm-preview.
-- Dados inteiramente fictícios; idempotente e sem senhas utilizáveis.
INSERT OR IGNORE INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em)
VALUES ('99000000-0000-4000-8000-000000000001', 'DEMO', 'Loja Demonstração', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO usuarios
(id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em)
VALUES
('99000000-0000-4000-8000-000000000011', NULL, 'Administrador Demonstração', 'demo-admin', 'preview-demo-no-password', 'admin', 1, datetime('now'), datetime('now')),
('99000000-0000-4000-8000-000000000012', NULL, 'Visualizador Demonstração', 'demo-visualizador', 'preview-demo-no-password', 'visualizador', 1, datetime('now'), datetime('now')),
('99000000-0000-4000-8000-000000000013', '99000000-0000-4000-8000-000000000001', 'Conferente Demonstração', 'demo-conferente', 'preview-demo-no-password', 'conferente', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO agendas
(id, loja_id, data_agenda, arquivo_original, criado_por, criado_em, atualizado_em)
VALUES
('demo-agenda-' || date('now', '-3 hours'), '99000000-0000-4000-8000-000000000001', date('now', '-3 hours'),
 'agenda-ficticia.pdf', '99000000-0000-4000-8000-000000000011', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO agendamentos
(id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, itens, volumes, paletes, carga_batida, tipo, nfe, pedidos, status, ativo, criado_em, atualizado_em, origem, trocas)
VALUES
('demo-1-' || date('now', '-3 hours'), 'demo-agenda-' || date('now', '-3 hours'), 'DEMO-101', '08:00', '08:30',
 'Distribuidora Exemplo', 12, 8, 1, NULL, 'Normal', '[]', '[]', 'aguardando', 1, datetime('now'), datetime('now'), 'importado', 0),
('demo-2-' || date('now', '-3 hours'), 'demo-agenda-' || date('now', '-3 hours'), 'DEMO-102', '09:00', '09:30',
 'Hortifruti Modelo', 6, 4, 0, NULL, 'Normal', '[]', '[]', 'recebido', 1, datetime('now'), datetime('now'), 'importado', 0),
('demo-3-' || date('now', '-3 hours'), 'demo-agenda-' || date('now', '-3 hours'), 'DEMO-103', '10:00', '10:30',
 'Fornecedor de Testes', 10, 6, 1, NULL, 'Normal', '[]', '[]', 'nao_chegou', 1, datetime('now'), datetime('now'), 'importado', 0);
