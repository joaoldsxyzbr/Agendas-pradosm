PRAGMA foreign_keys = ON;

INSERT INTO lojas (
  id, codigo, nome, ativo, criado_em, atualizado_em, excluido_em
) VALUES (
  '10000000-0000-4000-8000-000000000001',
  'F05',
  'Pagani E2E',
  1,
  '2026-09-29T12:00:00.000Z',
  '2026-09-29T12:00:00.000Z',
  NULL
);

INSERT INTO usuarios (
  id, loja_id, nome, login, senha_hash, papel, ativo,
  criado_em, atualizado_em, excluido_em
) VALUES
(
  '20000000-0000-4000-8000-000000000001',
  NULL,
  'Admin E2E',
  'admin-e2e',
  'pbkdf2_sha256$100000$AAECAwQFBgcICQoLDA0ODw==$AYxgQLgLfLPsbb0egTJrnCsUalhEK5g5ZPOz/f7bl64=',
  'admin',
  1,
  '2026-09-29T12:00:00.000Z',
  '2026-09-29T12:00:00.000Z',
  NULL
),
(
  '20000000-0000-4000-8000-000000000002',
  NULL,
  'Visualizador E2E',
  'viewer-e2e',
  'pbkdf2_sha256$100000$AAECAwQFBgcICQoLDA0ODw==$AYxgQLgLfLPsbb0egTJrnCsUalhEK5g5ZPOz/f7bl64=',
  'visualizador',
  1,
  '2026-09-29T12:00:00.000Z',
  '2026-09-29T12:00:00.000Z',
  NULL
),
(
  '20000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  'Conferente E2E',
  'conferente-e2e',
  'pbkdf2_sha256$100000$AAECAwQFBgcICQoLDA0ODw==$AYxgQLgLfLPsbb0egTJrnCsUalhEK5g5ZPOz/f7bl64=',
  'conferente',
  1,
  '2026-09-29T12:00:00.000Z',
  '2026-09-29T12:00:00.000Z',
  NULL
);

INSERT INTO agendas (
  id,
  loja_id,
  data_agenda,
  arquivo_original,
  criado_por,
  criado_em,
  atualizado_em,
  status_dia,
  concluido_em,
  concluido_por
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '2026-09-29',
  'agenda-e2e.pdf',
  '20000000-0000-4000-8000-000000000001',
  '2026-09-29T12:00:00.000Z',
  '2026-09-29T12:00:00.000Z',
  'concluido',
  '2026-09-29T12:30:00.000Z',
  '20000000-0000-4000-8000-000000000003'
);

INSERT INTO agendamentos (
  id,
  agenda_id,
  protocolo,
  horario_inicio,
  horario_fim,
  fornecedor,
  itens,
  volumes,
  paletes,
  carga_batida,
  tipo,
  nfe,
  pedidos,
  status,
  ativo,
  criado_em,
  atualizado_em,
  origem,
  trocas
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'E2E-001',
  '08:00',
  '09:00',
  'Fornecedor E2E',
  2,
  4,
  1,
  NULL,
  'Normal',
  '[]',
  '[]',
  'recebido',
  1,
  '2026-09-29T12:00:00.000Z',
  '2026-09-29T12:00:00.000Z',
  'importado',
  0
);
