-- Migration 014: MIRO — boletos independentes dos descontos + conferência mensal
--
-- Antes: os descontos selecionados geravam uma "cobrança" com 4 boletos (total ÷ 4).
-- Agora: os boletos são lançados livremente (quantidade e valor variáveis) e, no fim
-- do mês, uma conferência compara o saldo de boletos com os descontos selecionados.
-- Os descontos conferidos ficam solucionados (freights."miroCobrancaId" = conferência).
--
-- Saldo MIRO = Σ boletos emitidos − Σ descontos solucionados (sempre calculado, nada
-- guardado). Positivo = crédito para o próximo mês; negativo = falta, cobre com um
-- boleto complementar. miro_cobrancas passa a ser a tabela das conferências.

-- Boleto existe sem conferência; "cobrancaId" só indica em qual conferência ele entrou.
alter table public.miro_boletos alter column semana drop not null;
alter table public.miro_boletos add column if not exists emissao date;
alter table public.miro_boletos add column if not exists complementar boolean default false;

-- Desfazer uma conferência solta os boletos em vez de apagá-los.
alter table public.miro_boletos drop constraint if exists "miro_boletos_cobrancaId_fkey";
alter table public.miro_boletos add constraint "miro_boletos_cobrancaId_fkey"
  foreign key ("cobrancaId") references public.miro_cobrancas(id) on delete set null;

-- Foto da conferência no momento do fechamento (histórico não muda se algo for editado depois).
alter table public.miro_cobrancas add column if not exists data date;
alter table public.miro_cobrancas add column if not exists "saldoAnterior" numeric default 0;
alter table public.miro_cobrancas add column if not exists "totalBoletos" numeric default 0;
alter table public.miro_cobrancas add column if not exists "saldoFinal" numeric default 0;
