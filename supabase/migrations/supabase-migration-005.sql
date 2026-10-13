-- Migration 005: Integração Sascar/Michelin (KM automático + relatório de KM rodado)
--
-- Não altera o schema de tabelas — usa "trucks.placa" (já existente) para casar
-- com os veículos da Sascar e "trucks.kmAtual" (já existente) para guardar o hodômetro.
--
-- Pré-requisitos manuais (fora deste arquivo, feitos uma vez via SQL Editor / MCP):
--   1. Extensões: pg_cron, pg_net
--   2. Secrets no Supabase Vault: sascar_user, sascar_pass, sascar_cron_secret, sascar_anon_key
--   3. Deploy das Edge Functions supabase/functions/sascar-sync e sascar-km-report
--
-- A function abaixo expõe os secrets do Vault apenas para as Edge Functions (service_role),
-- nunca para o cliente (anon/authenticated).

CREATE OR REPLACE FUNCTION public.get_sascar_secrets()
RETURNS TABLE(name text, decrypted_secret text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT s.name, s.decrypted_secret
  FROM vault.decrypted_secrets s
  WHERE s.name IN ('sascar_user', 'sascar_pass', 'sascar_cron_secret');
$$;

REVOKE ALL ON FUNCTION public.get_sascar_secrets() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sascar_secrets() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_sascar_secrets() TO service_role;

-- Cron job: atualiza o kmAtual de todos os caminhões via Sascar, todo dia às 03:00 (horário do servidor).
-- Substitua a URL do projeto se for rodar em outro ambiente Supabase.
SELECT cron.schedule(
  'sascar-sync-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gqoefhecnsayjxyoutzo.supabase.co/functions/v1/sascar-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sascar_anon_key'),
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sascar_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
