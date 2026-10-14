-- Migration 018: remove trucks.motorista (texto livre)
--
-- O motorista do caminhão agora vem do usuário motorista ativo vinculado à placa
-- (app_users."truckId"), pra não precisar cadastrar em dois lugares. A coluna não é
-- mais lida nem gravada pelo app; nenhuma view/função/trigger depende dela.

alter table public.trucks drop column if exists motorista;
