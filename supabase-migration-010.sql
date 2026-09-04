-- Migration 010: Inativar motoristas (soft status) sem perder histórico
--
-- Contexto: hoje todo usuário com role='motorista' aparece pra sempre nos
-- selects de cadastro de frete e de fechamento, mesmo depois que ele sai da
-- empresa. A única forma de removê-lo era excluir o registro, o que quebra
-- o histórico (fretes, fechamentos, despesas referenciam app_users.id).
-- Agora existe uma coluna "ativo" (default true) — motoristas inativados
-- somem dos selects de disponibilidade, mas continuam no cadastro e em
-- todo o histórico já lançado.

alter table public.app_users
  add column if not exists ativo boolean default true;

comment on column public.app_users.ativo is 'Motorista disponível para novo cadastro de frete e fechamento. false = inativado (histórico preservado, mas não aparece mais como opção). Não afeta admin/visualizador.';
