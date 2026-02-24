-- ============================================
-- MIGRATION: Add missing columns
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================

-- TRUCKS: add motorista column
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS motorista text;

-- APP_USERS: add missing columns
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS "temLogin" boolean default false;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS "authEmail" text;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS obs text;

-- FUELINGS: add missing columns
ALTER TABLE public.fuelings ADD COLUMN IF NOT EXISTS "valorLitro" numeric;
ALTER TABLE public.fuelings ADD COLUMN IF NOT EXISTS "tipoComb" text;

-- FREIGHTS: add missing columns for payment splitting
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS "taxaKm" numeric;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS "taxaKmEfetiva" numeric;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS "notaFiscal" text;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS obs text;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS "pagamentoTipo" text default 'integral';
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS "pctAdiantamento" numeric;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS adiantamento numeric default 0;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS saldo numeric default 0;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS recebido boolean default false;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS "adiantamentoRecebido" boolean default false;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS "saldoRecebido" boolean default false;

-- FINES: add missing columns
ALTER TABLE public.fines ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.fines ADD COLUMN IF NOT EXISTS local text;
