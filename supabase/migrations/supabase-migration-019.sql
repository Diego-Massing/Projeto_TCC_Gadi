-- Migration 019: Fretes Sugeridos (viagens montadas a partir do GPS da Sascar)
--
-- A Edge Function frete-sugestoes lê as posições do rastreador, acha as paradas de
-- carga/descarga e sugere os fretes do período; o admin aprova (vira frete normal)
-- ou descarta. Aqui ficam só os dados de apoio:
--
-- lugares_frete: coordenadas das cidades que aparecem em origem/destino dos fretes
--   (nome normalizado: minúsculo, sem acento). Serve pra dar nome às paradas e pra
--   comparar com o histórico (carregado/vazio, KM de tabela, valor). pais = BR | EXT.
-- frete_sugestoes_descartadas: sugestões que o admin descartou, pra não voltarem.

create table if not exists public.lugares_frete (
  nome text primary key,
  lat double precision not null,
  lon double precision not null,
  pais text not null default 'BR' check (pais in ('BR', 'EXT'))
);
alter table public.lugares_frete enable row level security;
create policy read_lugares_frete on public.lugares_frete for select
  using ((select public.current_app_role()) in ('admin', 'visualizador'));
create policy admin_write_lugares_frete on public.lugares_frete for all
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');

insert into public.lugares_frete (nome, lat, lon, pais) values
  ('amparo', -22.7088, -46.772, 'BR'),
  ('aruja', -23.3965, -46.32, 'BR'),
  ('bahia blanca', -38.72, -62.27, 'EXT'),
  ('buenos aires', -34.6, -58.38, 'EXT'),
  ('cabreuva', -23.3053, -47.1362, 'BR'),
  ('cacapava', -23.0992, -45.7076, 'BR'),
  ('camacari', -12.6996, -38.3263, 'BR'),
  ('campana', -34.16, -58.96, 'EXT'),
  ('campinas', -22.9053, -47.0659, 'BR'),
  ('canuelas', -35.05, -58.76, 'EXT'),
  ('colon', -32.22, -58.14, 'EXT'),
  ('contagem', -19.9321, -44.0539, 'BR'),
  ('cotia', -23.6022, -46.919, 'BR'),
  ('diadema', -23.6813, -46.6205, 'BR'),
  ('duque de caxias', -22.7858, -43.3049, 'BR'),
  ('esperanza', -31.45, -60.93, 'EXT'),
  ('esteio', -29.852, -51.1841, 'BR'),
  ('extrema', -22.854, -46.3178, 'BR'),
  ('extrema mg', -22.854, -46.3178, 'BR'),
  ('feira', -12.2664, -38.9663, 'BR'),
  ('feira santana', -12.2664, -38.9663, 'BR'),
  ('foz do iguacu', -25.5427, -54.5827, 'BR'),
  ('gravatai', -29.9413, -50.9869, 'BR'),
  ('guarulhos', -23.4538, -46.5333, 'BR'),
  ('ibirite', -20.0252, -44.0569, 'BR'),
  ('indaiatuba', -23.0816, -47.2101, 'BR'),
  ('itajai', -26.9101, -48.6705, 'BR'),
  ('itajuba', -22.4225, -45.4598, 'BR'),
  ('itaquaquecetuba', -23.4835, -46.3457, 'BR'),
  ('itupeva', -23.1526, -47.0593, 'BR'),
  ('jaci', -20.8805, -49.5797, 'BR'),
  ('jundiai', -23.1852, -46.8974, 'BR'),
  ('lages', -27.815, -50.3259, 'BR'),
  ('libres', -29.71, -57.09, 'EXT'),
  ('louveira', -23.0856, -46.9484, 'BR'),
  ('mar del plata', -38.0, -57.55, 'EXT'),
  ('maua', -23.6677, -46.4613, 'BR'),
  ('maule', -35.43, -71.66, 'EXT'),
  ('merlo', -34.67, -58.73, 'EXT'),
  ('mogi mirim', -22.4332, -46.9532, 'BR'),
  ('nova santa rita', -29.8525, -51.2837, 'BR'),
  ('pacheco', -34.46, -58.65, 'EXT'),
  ('pilar', -34.46, -58.91, 'EXT'),
  ('pillar', -34.46, -58.91, 'EXT'),
  ('piracicaba', -22.7338, -47.6476, 'BR'),
  ('ponta grossa', -25.0916, -50.1668, 'BR'),
  ('porto alegre', -30.0318, -51.2065, 'BR'),
  ('pouso alegre', -22.2266, -45.9389, 'BR'),
  ('rafaela', -31.25, -61.49, 'EXT'),
  ('ribeirao pires', -23.7067, -46.4058, 'BR'),
  ('rio de janeiro', -22.9129, -43.2003, 'BR'),
  ('rosario', -32.95, -60.64, 'EXT'),
  ('salto', -23.1996, -47.2931, 'BR'),
  ('santa fe', -31.63, -60.7, 'EXT'),
  ('santiago', -33.45, -70.67, 'EXT'),
  ('santo andre', -23.6737, -46.5432, 'BR'),
  ('santo tome', -28.55, -56.04, 'EXT'),
  ('sao bernardo do campo', -23.6914, -46.5646, 'BR'),
  ('sao borja', -28.6578, -56.0036, 'BR'),
  ('sao carlos', -22.0175, -47.8908, 'BR'),
  ('sao jose dos pinhais', -25.5313, -49.2031, 'BR'),
  ('sao paulo', -23.5329, -46.6395, 'BR'),
  ('sapucaia', -29.8276, -51.145, 'BR'),
  ('senador canedo', -16.7084, -49.0914, 'BR'),
  ('sete lagoas', -19.4569, -44.2413, 'BR'),
  ('trenque', -35.97, -62.73, 'EXT'),
  ('triunfo', -29.9291, -51.7075, 'BR'),
  ('uru - itupeva', -23.1526, -47.0593, 'BR'),
  ('uruguaiana', -29.7614, -57.0853, 'BR'),
  ('uruuguaiana', -29.7614, -57.0853, 'BR')
on conflict (nome) do nothing;

create table if not exists public.frete_sugestoes_descartadas (
  "truckId" bigint not null references public.trucks(id) on delete cascade,
  saida timestamptz not null,
  descartado_em timestamptz not null default now(),
  primary key ("truckId", saida)
);
alter table public.frete_sugestoes_descartadas enable row level security;
create policy read_frete_sug_desc on public.frete_sugestoes_descartadas for select
  using ((select public.current_app_role()) in ('admin', 'visualizador'));
create policy admin_write_frete_sug_desc on public.frete_sugestoes_descartadas for all
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');
