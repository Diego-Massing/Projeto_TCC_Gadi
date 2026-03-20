-- Migration 002: Adicionar colunas de despesas fixas na tabela closings
-- Executar no Supabase SQL Editor

ALTER TABLE public.closings ADD COLUMN IF NOT EXISTS "totalDespesasFixas" numeric DEFAULT 0;
ALTER TABLE public.closings ADD COLUMN IF NOT EXISTS "fixedExpenses" jsonb;
