-- Migration 015: Médias Parciais — início da média escolhido manualmente
--
-- A média de cada abastecida é, por padrão, (KM dela − KM da abastecida anterior) /
-- litros dela. Quando o motorista não completou o tanque, a média fica errada; o admin
-- escolhe na tela "Médias Parciais" uma abastecida anterior como início, e as do meio
-- passam a fazer parte dessa média. A escolha fica gravada na abastecida final.
alter table public.fuelings add column if not exists "mediaInicioId" integer
  references public.fuelings(id) on delete set null;

comment on column public.fuelings."mediaInicioId" is
  'Abastecida usada como início da média parcial desta (null = a anterior com KM)';
