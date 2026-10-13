-- Migration 003: Adiciona campos de desconto na tabela freights
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS desconto numeric DEFAULT 0;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS "descontoObs" text;
