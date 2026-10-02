-- Migration 011: Snapshot do fechamento do motorista salvo
--
-- Contexto: ao reexportar o PDF de um fechamento salvo, o sistema recalculava tudo
-- a partir do período (fretes, vales, despesas, prêmios), perdendo os itens que
-- foram desmarcados na hora de gerar o acerto e refletindo qualquer alteração
-- feita depois nos cadastros. Agora o fechamento salvo guarda uma cópia exata
-- dos dados usados no PDF, e o botão de reexportar usa essa cópia.
-- Fechamentos antigos (snapshot null) continuam sendo recalculados como antes.

alter table public.driver_closings
  add column if not exists "snapshot" jsonb;

comment on column public.driver_closings."snapshot" is 'Cópia dos dados do fechamento no momento do salvamento (só itens incluídos), usada para reexportar o PDF sem recalcular';
