-- Migration 016: credenciais dos outros rastreadores (Getrak / New Rastreamento)
--
-- Vários caminhões saíram da Sascar. A tela "KM Rodado" passa a consultar também o
-- Getrak (API v2) e o New Rastreamento. As credenciais ficam no Vault (cadastradas
-- pelo admin no dashboard) e só as edge functions leem, via service_role — mesmo
-- padrão de get_sascar_secrets().
create or replace function public.get_tracker_secrets()
returns table(name text, decrypted_secret text)
language sql
security definer
set search_path = public, vault
as $$
  select s.name, s.decrypted_secret
  from vault.decrypted_secrets s
  where s.name like 'getrak\_%' or s.name like 'newrastr\_%';
$$;

revoke all on function public.get_tracker_secrets() from public, anon, authenticated;
grant execute on function public.get_tracker_secrets() to service_role;
