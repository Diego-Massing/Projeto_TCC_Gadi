-- Migration 020: liga cada usuário do app à sua conta de login (app_users.auth_uid)
--
-- As funções de papel (current_app_role/truck_id/user_id) procuravam o usuário por
-- app_users.user_id = auth.uid(), mas user_id é quem CADASTROU a linha (sempre o admin
-- que criou), não a conta de login. Resultado: o Leonardo ficava sem papel nenhum (zero
-- acesso), e o Diego só era admin porque a linha dele era a primeira da tabela — com
-- LIMIT 1 sem ordem, editar o cadastro dele podia trocar o papel pelo de um motorista.
--
-- Agora: auth_uid = conta de login do usuário (única), preenchida pelo authEmail e
-- mantida por trigger (ao salvar o usuário no app e ao criar a conta no Auth).
-- Usuário desativado (ativo = false) perde o acesso.

alter table public.app_users
  add column if not exists auth_uid uuid unique references auth.users(id) on delete set null;

update public.app_users a set auth_uid = u.id
from auth.users u
where a."authEmail" is not null and lower(u.email) = lower(trim(a."authEmail"));

-- Ao salvar um usuário no app: liga (ou desliga) a conta conforme o e-mail de acesso.
create or replace function public.app_users_set_auth_uid()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new."authEmail" is null or trim(new."authEmail") = '' then
    new.auth_uid := null;
  else
    new.auth_uid := (select u.id from auth.users u where lower(u.email) = lower(trim(new."authEmail")));
  end if;
  return new;
end;
$$;
revoke all on function public.app_users_set_auth_uid() from public, anon, authenticated;

drop trigger if exists app_users_set_auth_uid on public.app_users;
create trigger app_users_set_auth_uid
  before insert or update of "authEmail" on public.app_users
  for each row execute function public.app_users_set_auth_uid();

-- Conta criada no Auth depois do cadastro no app: liga pelo e-mail.
create or replace function public.auth_user_link_app_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.app_users set auth_uid = new.id
  where auth_uid is null and lower(trim("authEmail")) = lower(new.email);
  return new;
end;
$$;
revoke all on function public.auth_user_link_app_user() from public, anon, authenticated;

drop trigger if exists auth_user_link_app_user on auth.users;
create trigger auth_user_link_app_user
  after insert or update of email on auth.users
  for each row execute function public.auth_user_link_app_user();

create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.app_users where auth_uid = auth.uid() and ativo is not false;
$$;

create or replace function public.current_app_truck_id()
returns bigint language sql stable security definer set search_path = public as $$
  select "truckId" from public.app_users where auth_uid = auth.uid() and ativo is not false;
$$;

create or replace function public.current_app_user_id()
returns bigint language sql stable security definer set search_path = public as $$
  select id from public.app_users where auth_uid = auth.uid() and ativo is not false;
$$;

drop policy if exists read_app_users on public.app_users;
create policy read_app_users on public.app_users for select
  using ((select public.current_app_role()) in ('admin', 'visualizador')
         or auth_uid = (select auth.uid()));
