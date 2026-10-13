-- Migration 008: Flag "prêmio de média incluído no acerto" no fechamento do motorista
--
-- Contexto: o fechamento do motorista agora tem um checkbox para incluir ou não
-- o Prêmio de Média km/L no total a pagar (ex: motorista discorda da média, caso
-- em análise, etc). Esse estado precisa ser persistido junto do fechamento salvo,
-- porque o "totalSemVales" do fechamento do motorista alimenta diretamente a
-- despesa de salário no acerto do caminhão (generateTruckClosingByDateRange lê
-- driverClosingInfo.totalSemVales) — se a média não entrar no pagamento do
-- motorista, ela também não pode entrar como despesa no acerto do caminhão, e
-- sem esse flag salvo, reabrir/reexportar o fechamento perderia essa escolha.

alter table public.driver_closings
  add column if not exists "premioMediaIncluido" boolean not null default true;

comment on column public.driver_closings."premioMediaIncluido" is 'Se false, o valor de premioMedia foi excluído de totalPagar/totalSemVales neste fechamento (checkbox desmarcado na tela de fechamento do motorista)';
