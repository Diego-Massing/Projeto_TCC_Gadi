-- Migration 012: Caixa de entrada de NF-e (Distribuição DF-e da SEFAZ)
--
-- Contexto: o programa local "Frota NF-e" (tools/frota-nfe) consulta a SEFAZ com o
-- certificado A3 da empresa e envia para cá o XML de cada NF-e emitida contra o
-- CNPJ da Gadi. A tela "Notas recebidas" lê esses XMLs, monta as abastecidas e o
-- admin aprova. Nada é lançado em fuelings sem aprovação.
--
-- status: pendente  -> aguardando revisão
--         aprovada  -> virou abastecida(s) (ids em "fuelingIds")
--         ignorada  -> descartada pelo admin (ex.: nota de peças)
--         ja_lancada-> já existia abastecida cadastrada à mão para essa nota
-- schema: resNFe (resumo, antes da ciência) ou procNFe (XML completo)

create table if not exists public.nfe_inbox (
  id bigint generated always as identity primary key,
  chave text not null unique,
  nsu bigint,
  "schema" text not null,
  xml text not null,
  "emitenteCnpj" text,
  "emitenteNome" text,
  "dataEmissao" timestamptz,
  "valorTotal" numeric,
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'ignorada', 'ja_lancada')),
  "fuelingIds" bigint[],
  "cienciaEnviada" boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nfe_inbox_status_idx on public.nfe_inbox (status);

alter table public.nfe_inbox enable row level security;

create policy read_nfe_inbox on public.nfe_inbox for select
  using ((select public.current_app_role()) = 'admin');
create policy admin_insert_nfe_inbox on public.nfe_inbox for insert
  with check ((select public.current_app_role()) = 'admin');
create policy admin_update_nfe_inbox on public.nfe_inbox for update
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');
create policy admin_delete_nfe_inbox on public.nfe_inbox for delete
  using ((select public.current_app_role()) = 'admin');

-- Rastreia de qual NF-e veio cada abastecida (uma nota com diesel + arla gera duas linhas).
alter table public.fuelings
  add column if not exists "nfeChave" text;

create index if not exists fuelings_nfe_chave_idx on public.fuelings ("nfeChave");

comment on table public.nfe_inbox is 'NF-e recebidas via Distribuição DF-e (programa local com certificado A3), aguardando revisão';
comment on column public.fuelings."nfeChave" is 'Chave de acesso da NF-e que originou a abastecida (null = lançada à mão)';
