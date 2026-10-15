-- Migration 021: usuário só-leitura para o backup diário (GitHub Action no repositório
-- privado Diego-Massing/frota-backup).
--
-- backup_ro lê tudo do schema public (BYPASSRLS, senão o RLS esconderia as linhas) e
-- não escreve nada. A senha NÃO fica aqui: foi definida à parte (só o hash SCRAM foi
-- enviado ao banco) e o texto puro está apenas no secret do GitHub. Para trocar a senha,
-- gerar outra, atualizar o secret BACKUP_DB_URL e rodar ALTER ROLE backup_ro PASSWORD.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'backup_ro') then
    create role backup_ro login bypassrls nocreatedb nocreaterole noinherit;
  end if;
end $$;

grant usage on schema public to backup_ro;
grant select on all tables in schema public to backup_ro;
grant select on all sequences in schema public to backup_ro;
alter default privileges for role postgres in schema public grant select on tables to backup_ro;
alter default privileges for role postgres in schema public grant select on sequences to backup_ro;
