-- Migration 006: RBAC de verdade no banco (RLS por role) + unifica isolamento por user_id
--
-- Contexto: até aqui, a maioria das tabelas usava `auth.role() = 'authenticated'`,
-- ou seja, QUALQUER conta autenticada tinha acesso total (leitura E escrita) —
-- o RBAC admin/motorista/visualizador só existia no JavaScript do front-end.
-- Além disso, 5 tabelas (tires, tires_history, maintenance_plans, driver_closings,
-- truck_closings) ainda isolavam por `auth.uid() = user_id`, inconsistente com o
-- resto do sistema (que já é compartilhado entre os admins da mesma frota).
--
-- Esta migration:
--   1. Cria funções auxiliares que leem o role/truckId do usuário logado em app_users.
--   2. Reescreve as policies de TODAS as tabelas de negócio para checar o role de verdade.
--   3. Contas autenticadas sem linha em app_users (ex: alguém que se auto-cadastrou pela
--      API) não têm NENHUM acesso — current_app_role() retorna NULL e toda comparação
--      com NULL é falsa.

-- ===== Funções auxiliares (SECURITY DEFINER: leem app_users ignorando a própria RLS) =====

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.app_users WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_app_truck_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT "truckId" FROM public.app_users WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_truck_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_truck_id() TO authenticated;
-- Supabase concede EXECUTE a "anon" por padrão em funções novas do schema public
-- (privilégio default do projeto, não herdado do REVOKE FROM PUBLIC acima) — fecha isso também.
REVOKE EXECUTE ON FUNCTION public.current_app_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_app_truck_id() FROM anon;

-- ===== app_users: admin/visualizador leem tudo; qualquer um lê a própria linha; só admin escreve =====

DROP POLICY IF EXISTS "Authenticated users full access" ON public.app_users;

CREATE POLICY "read_app_users" ON public.app_users FOR SELECT
  USING ((SELECT public.current_app_role()) IN ('admin', 'visualizador') OR user_id = (SELECT auth.uid()));
CREATE POLICY "admin_insert_app_users" ON public.app_users FOR INSERT
  WITH CHECK ((SELECT public.current_app_role()) = 'admin');
CREATE POLICY "admin_update_app_users" ON public.app_users FOR UPDATE
  USING ((SELECT public.current_app_role()) = 'admin') WITH CHECK ((SELECT public.current_app_role()) = 'admin');
CREATE POLICY "admin_delete_app_users" ON public.app_users FOR DELETE
  USING ((SELECT public.current_app_role()) = 'admin');

-- ===== trucks: leitura para qualquer role logado (admin/visualizador/motorista); escrita só admin =====

DROP POLICY IF EXISTS "Authenticated users full access" ON public.trucks;

CREATE POLICY "read_trucks" ON public.trucks FOR SELECT
  USING ((SELECT public.current_app_role()) IS NOT NULL);
CREATE POLICY "admin_insert_trucks" ON public.trucks FOR INSERT
  WITH CHECK ((SELECT public.current_app_role()) = 'admin');
CREATE POLICY "admin_update_trucks" ON public.trucks FOR UPDATE
  USING ((SELECT public.current_app_role()) = 'admin') WITH CHECK ((SELECT public.current_app_role()) = 'admin');
CREATE POLICY "admin_delete_trucks" ON public.trucks FOR DELETE
  USING ((SELECT public.current_app_role()) = 'admin');

-- ===== fuelings / freights: admin+visualizador veem tudo; motorista só o próprio caminhão =====

DROP POLICY IF EXISTS "Authenticated users full access" ON public.fuelings;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.freights;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fuelings', 'freights'] LOOP
    EXECUTE format($f$
      CREATE POLICY "read_%1$s" ON public.%1$s FOR SELECT
        USING (
          (SELECT public.current_app_role()) IN ('admin', 'visualizador')
          OR ((SELECT public.current_app_role()) = 'motorista' AND "truckId" = (SELECT public.current_app_truck_id()))
        );
      CREATE POLICY "write_insert_%1$s" ON public.%1$s FOR INSERT
        WITH CHECK (
          (SELECT public.current_app_role()) = 'admin'
          OR ((SELECT public.current_app_role()) = 'motorista' AND "truckId" = (SELECT public.current_app_truck_id()))
        );
      CREATE POLICY "write_update_%1$s" ON public.%1$s FOR UPDATE
        USING (
          (SELECT public.current_app_role()) = 'admin'
          OR ((SELECT public.current_app_role()) = 'motorista' AND "truckId" = (SELECT public.current_app_truck_id()))
        )
        WITH CHECK (
          (SELECT public.current_app_role()) = 'admin'
          OR ((SELECT public.current_app_role()) = 'motorista' AND "truckId" = (SELECT public.current_app_truck_id()))
        );
      CREATE POLICY "write_delete_%1$s" ON public.%1$s FOR DELETE
        USING (
          (SELECT public.current_app_role()) = 'admin'
          OR ((SELECT public.current_app_role()) = 'motorista' AND "truckId" = (SELECT public.current_app_truck_id()))
        );
    $f$, t);
  END LOOP;
END $$;

-- ===== Tabelas só-admin (leitura admin+visualizador, escrita só admin) =====
-- Inclui as 5 que antes isolavam por user_id (tires, tires_history, maintenance_plans,
-- driver_closings, truck_closings) — unificando com o resto do sistema (mesma frota,
-- visível para os dois admins) — e settings/fines/despesas/miro, que já eram
-- "authenticated only" mas sem checar role de verdade.

DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'fines', 'truck_expenses', 'settings', 'closings',
  'driver_expenses', 'driver_bonuses', 'driver_discounts',
  'driver_closings', 'truck_closings', 'maintenance_plans',
  'tires', 'tires_history', 'miro_cobrancas', 'miro_boletos'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users full access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can CRUD their own data" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage their own truck closings" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_auth_%s" ON public.%I', t, t);

    EXECUTE format($f$
      CREATE POLICY "read_%1$s" ON public.%1$s FOR SELECT
        USING ((SELECT public.current_app_role()) IN ('admin', 'visualizador'));
      CREATE POLICY "admin_insert_%1$s" ON public.%1$s FOR INSERT
        WITH CHECK ((SELECT public.current_app_role()) = 'admin');
      CREATE POLICY "admin_update_%1$s" ON public.%1$s FOR UPDATE
        USING ((SELECT public.current_app_role()) = 'admin') WITH CHECK ((SELECT public.current_app_role()) = 'admin');
      CREATE POLICY "admin_delete_%1$s" ON public.%1$s FOR DELETE
        USING ((SELECT public.current_app_role()) = 'admin');
    $f$, t);
  END LOOP;
END $$;

-- ===== Trava a function auxiliar de closings (pré-existente) que estava com search_path mutável =====
ALTER FUNCTION public.set_truck_closing_user_id() SET search_path = public;
REVOKE ALL ON FUNCTION public.set_truck_closing_user_id() FROM PUBLIC, anon, authenticated;
