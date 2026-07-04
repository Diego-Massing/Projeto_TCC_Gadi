-- Migration 007: Taxa de km (R$/km) própria do motorista para cálculo de comissão
--
-- Contexto: a comissão do motorista sobre km rodado usava a mesma taxa R$/km
-- cadastrada na placa (trucks.kmCarregado/kmVazio, ou a padrão global). Isso não
-- serve sempre: o km do frete lançado para a placa pode ser diferente do km que
-- deve valer para a comissão do motorista. Agora cada motorista pode ter sua
-- própria taxa R$/km carregado/vazio; se ficar em branco, continua caindo para a
-- taxa da placa/padrão do sistema (comportamento antigo, sem quebra).

alter table public.app_users
  add column if not exists "valorKmCarregado" numeric,
  add column if not exists "valorKmVazio" numeric;

comment on column public.app_users."valorKmCarregado" is 'R$/km carregado usado só na comissão deste motorista (null = usa taxa da placa/padrão)';
comment on column public.app_users."valorKmVazio" is 'R$/km vazio usado só na comissão deste motorista (null = usa taxa da placa/padrão)';
