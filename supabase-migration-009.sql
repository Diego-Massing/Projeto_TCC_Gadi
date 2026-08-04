-- Migration 009: Associar frete diretamente a um motorista (além da placa)
--
-- Contexto: o fechamento do motorista descobria fretes/abastecimentos só
-- via user.truckId (placa vinculada no cadastro). Isso quebra em troca de
-- motorista no meio do mês numa mesma placa (não dá pra saber quais fretes
-- foram de qual motorista) e em motorista reserva/sem placa fixa (fica sem
-- fretes/abastecimentos, fechamento não tem como ser gerado). Agora cada
-- frete pode ser marcado com o motorista que rodou (opcional, além da
-- placa) e o fechamento do motorista soma: fretes da placa dele (como
-- hoje) + fretes marcados diretamente pra ele em qualquer placa.
--
-- Fretes continuam aparecendo no fechamento da placa (generateTruckClosingByDateRange)
-- independente da tag de motorista — essa tabela não muda, fechamento de
-- caminhão é e continua sendo só por truckId.

alter table public.freights
  add column if not exists "userId" bigint;

comment on column public.freights."userId" is 'Motorista (app_users.id) que rodou este frete — opcional, complementa truckId. Usado pra atribuir o frete a um motorista específico independente de qual placa está vinculada ao cadastro dele hoje (troca de motorista na mesma placa, motorista sem placa fixa).';

-- ===== RLS: motorista sem truckId também precisa poder ver/lançar frete marcado pra ele =====

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.app_users WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_app_user_id() FROM anon;

DROP POLICY IF EXISTS "read_freights" ON public.freights;
DROP POLICY IF EXISTS "write_insert_freights" ON public.freights;
DROP POLICY IF EXISTS "write_update_freights" ON public.freights;
DROP POLICY IF EXISTS "write_delete_freights" ON public.freights;

CREATE POLICY "read_freights" ON public.freights FOR SELECT
  USING (
    (SELECT public.current_app_role()) IN ('admin', 'visualizador')
    OR (
      (SELECT public.current_app_role()) = 'motorista'
      AND (
        "truckId" = (SELECT public.current_app_truck_id())
        OR "userId" = (SELECT public.current_app_user_id())
      )
    )
  );
CREATE POLICY "write_insert_freights" ON public.freights FOR INSERT
  WITH CHECK (
    (SELECT public.current_app_role()) = 'admin'
    OR (
      (SELECT public.current_app_role()) = 'motorista'
      AND (
        "truckId" = (SELECT public.current_app_truck_id())
        OR "userId" = (SELECT public.current_app_user_id())
      )
    )
  );
CREATE POLICY "write_update_freights" ON public.freights FOR UPDATE
  USING (
    (SELECT public.current_app_role()) = 'admin'
    OR (
      (SELECT public.current_app_role()) = 'motorista'
      AND (
        "truckId" = (SELECT public.current_app_truck_id())
        OR "userId" = (SELECT public.current_app_user_id())
      )
    )
  )
  WITH CHECK (
    (SELECT public.current_app_role()) = 'admin'
    OR (
      (SELECT public.current_app_role()) = 'motorista'
      AND (
        "truckId" = (SELECT public.current_app_truck_id())
        OR "userId" = (SELECT public.current_app_user_id())
      )
    )
  );
CREATE POLICY "write_delete_freights" ON public.freights FOR DELETE
  USING (
    (SELECT public.current_app_role()) = 'admin'
    OR (
      (SELECT public.current_app_role()) = 'motorista'
      AND (
        "truckId" = (SELECT public.current_app_truck_id())
        OR "userId" = (SELECT public.current_app_user_id())
      )
    )
  );
