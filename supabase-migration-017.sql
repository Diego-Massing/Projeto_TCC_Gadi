-- Migration 017: KM por dia vindo de rastreadores sem API (New Rastreamento)
--
-- O portal do New Rastreamento não tem API, recusa login feito direto pelo servidor e
-- bloqueia acessos de fora do Brasil (GitHub Actions não alcança). Um programa no PC do
-- admin (tools/km-newrastr, Chrome automático agendado no Windows) lê o "Relatório de
-- Hodômetro" dia a dia e grava aqui. A tela "KM Rodado" soma os dias do período.
--
-- Gravação: km_diario_ingest(segredo, linhas) — o segredo fica só no .env do PC; aqui
-- guardamos apenas o SHA-256 dele (Vault: km_ingest_hash).

create table if not exists public.km_diario (
  placa text not null,
  data date not null,
  km numeric not null,
  fonte text not null,
  parcial boolean not null default false,   -- dia ainda em andamento (será regravado)
  atualizado_em timestamptz not null default now(),
  primary key (placa, data, fonte)
);

alter table public.km_diario enable row level security;
drop policy if exists "read_km_diario" on public.km_diario;
create policy "read_km_diario" on public.km_diario for select
  using ((select public.current_app_role()) in ('admin', 'visualizador'));

-- p_linhas: [{"placa":"TRM0J35","data":"2026-10-12","km":512.4,"parcial":false}, ...]
create or replace function public.km_diario_ingest(p_secret text, p_fonte text, p_linhas jsonb)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare n integer;
begin
  if p_secret is null or encode(digest(p_secret, 'sha256'), 'hex') is distinct from
     (select decrypted_secret from vault.decrypted_secrets where name = 'km_ingest_hash') then
    raise exception 'não autorizado' using errcode = '42501';
  end if;
  insert into public.km_diario (placa, data, km, fonte, parcial, atualizado_em)
  select upper(l->>'placa'), (l->>'data')::date, (l->>'km')::numeric, p_fonte,
         coalesce((l->>'parcial')::boolean, false), now()
  from jsonb_array_elements(p_linhas) l
  on conflict (placa, data, fonte) do update
    set km = excluded.km, parcial = excluded.parcial, atualizado_em = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Último dia completo gravado por placa — o programa continua a partir dele.
create or replace function public.km_diario_status(p_secret text, p_fonte text)
returns table(placa text, ultimo_dia date)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_secret is null or encode(digest(p_secret, 'sha256'), 'hex') is distinct from
     (select decrypted_secret from vault.decrypted_secrets where name = 'km_ingest_hash') then
    raise exception 'não autorizado' using errcode = '42501';
  end if;
  return query
    select k.placa, max(k.data) from public.km_diario k
    where k.fonte = p_fonte and not k.parcial group by k.placa;
end;
$$;

revoke all on function public.km_diario_ingest(text, text, jsonb) from public;
revoke all on function public.km_diario_status(text, text) from public;
grant execute on function public.km_diario_ingest(text, text, jsonb) to anon, authenticated;
grant execute on function public.km_diario_status(text, text) to anon, authenticated;

-- O hash do segredo é cadastrado à parte (não versionado):
--   select vault.create_secret('<sha256 do segredo>', 'km_ingest_hash', '...');
