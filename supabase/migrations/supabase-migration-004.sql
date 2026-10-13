-- Migration 004: MIRO Transportes — controle de descontos e cobranças
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS "isMiro" boolean DEFAULT false;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS "miroCobrancaId" integer DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.miro_cobrancas (
    id serial PRIMARY KEY,
    referencia text NOT NULL,
    "totalDesconto" numeric DEFAULT 0,
    obs text,
    "createdAt" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.miro_boletos (
    id serial PRIMARY KEY,
    "cobrancaId" integer REFERENCES public.miro_cobrancas(id) ON DELETE CASCADE,
    semana integer NOT NULL,
    "numeroBoleto" text,
    valor numeric DEFAULT 0,
    vencimento date,
    pago boolean DEFAULT false,
    obs text
);

-- RLS: allow authenticated users to access miro tables
ALTER TABLE public.miro_cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miro_boletos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_auth_miro_cobrancas" ON public.miro_cobrancas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_auth_miro_boletos" ON public.miro_boletos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
