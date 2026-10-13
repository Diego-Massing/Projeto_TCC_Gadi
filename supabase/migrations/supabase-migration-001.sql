-- =======================================
-- MIGRATION: Fix column mismatches + Add login flag
-- Run this in Supabase SQL Editor
-- =======================================

-- 1. Add missing columns to app_users
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS obs text;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS "temLogin" boolean default false;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS "authEmail" text;

-- 2. Fix driver_expenses: add 'descricao' if missing, make 'tipo' optional
ALTER TABLE public.driver_expenses ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.driver_expenses ADD COLUMN IF NOT EXISTS obs text;
ALTER TABLE public.driver_expenses ALTER COLUMN tipo DROP NOT NULL;
ALTER TABLE public.driver_expenses ALTER COLUMN tipo SET DEFAULT 'outros';

-- 3. Fix driver_bonuses: add 'descricao' column
ALTER TABLE public.driver_bonuses ADD COLUMN IF NOT EXISTS descricao text;

-- 4. Fix driver_discounts: add 'descricao' column
ALTER TABLE public.driver_discounts ADD COLUMN IF NOT EXISTS descricao text;
