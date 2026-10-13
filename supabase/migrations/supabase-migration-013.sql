-- Migration 013: entrada de NF-e por e-mail e por upload
--
-- A consulta à SEFAZ (DistDFe) não traz as notas dos postos, mas o Brambila manda o
-- XML de cada nota por e-mail. Um Google Apps Script na conta Gmail da Gadi
-- (tools/gmail-nfe) envia esses XMLs para nfe_ingest(); o admin também pode subir
-- XMLs pela tela "Notas recebidas" (nfe_upload). As duas usam _nfe_store, que lê a
-- nota, confere que o destinatário é a Gadi e grava em nfe_inbox (chave única =
-- nota repetida é ignorada).

alter table public.nfe_inbox add column if not exists origem text;
comment on column public.nfe_inbox.origem is 'email (Apps Script do Gmail), upload (tela do app) ou sefaz';

-- Segredo que o Apps Script usa para chamar nfe_ingest. Gerado aqui dentro, ninguém
-- precisa ver o valor no código: o admin copia do Vault (Supabase → Vault) para as
-- propriedades do script.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'nfe_ingest_secret',
  'Segredo do Apps Script do Gmail que envia NF-e para nfe_ingest()')
where not exists (select 1 from vault.secrets where name = 'nfe_ingest_secret');

-- Retorna 'nova', 'repetida' ou 'ignorada: <motivo>' (XML inválido, nota de outro
-- destinatário, não autorizada). Não lança erro nesses casos para o script seguir
-- com os outros e-mails.
create or replace function public._nfe_store(p_xml text, p_origem text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ns constant text[][] := array[array['n', 'http://www.portalfiscal.inf.br/nfe']];
  doc xml;
  v_chave text;
  v_dest text;
  v_cstat text;
  v_id bigint;
begin
  if p_xml is null or length(p_xml) > 1000000 then
    return 'ignorada: XML vazio ou grande demais';
  end if;

  begin
    -- tira BOM e a declaração <?xml ...?> (o Postgres recusa encoding declarado)
    doc := xmlparse(document regexp_replace(p_xml, '^﻿?\s*<\?xml[^>]*\?>', ''));
  exception when others then
    return 'ignorada: XML inválido';
  end;

  v_chave := replace((xpath('//n:infNFe/@Id', doc, ns))[1]::text, 'NFe', '');
  v_dest  := (xpath('//n:infNFe/n:dest/n:CNPJ/text()', doc, ns))[1]::text;
  v_cstat := (xpath('//n:protNFe/n:infProt/n:cStat/text()', doc, ns))[1]::text;

  if v_chave is null or length(v_chave) <> 44 then return 'ignorada: não é NF-e'; end if;
  if v_dest is distinct from '13126912000156' then return 'ignorada: destinatário não é a Gadi'; end if;
  if v_cstat is not null and v_cstat not in ('100', '150') then return 'ignorada: nota não autorizada'; end if;

  insert into public.nfe_inbox (chave, "schema", xml, origem, "emitenteCnpj", "emitenteNome", "dataEmissao", "valorTotal")
  values (
    v_chave,
    case when v_cstat is null then 'NFe' else 'procNFe' end,
    p_xml,
    p_origem,
    (xpath('//n:infNFe/n:emit/n:CNPJ/text()', doc, ns))[1]::text,
    (xpath('//n:infNFe/n:emit/n:xNome/text()', doc, ns))[1]::text,
    ((xpath('//n:infNFe/n:ide/n:dhEmi/text()', doc, ns))[1]::text)::timestamptz,
    ((xpath('//n:infNFe/n:total/n:ICMSTot/n:vNF/text()', doc, ns))[1]::text)::numeric
  )
  on conflict (chave) do nothing
  returning id into v_id;

  return case when v_id is null then 'repetida' else 'nova' end;
end;
$$;

revoke all on function public._nfe_store(text, text) from public, anon, authenticated;

-- Chamada pelo Apps Script (sem login; autoriza pelo segredo do Vault).
create or replace function public.nfe_ingest(p_secret text, p_xml text, p_origem text default 'email')
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or p_secret is distinct from
     (select decrypted_secret from vault.decrypted_secrets where name = 'nfe_ingest_secret') then
    raise exception 'não autorizado' using errcode = '42501';
  end if;
  return public._nfe_store(p_xml, coalesce(p_origem, 'email'));
end;
$$;

revoke all on function public.nfe_ingest(text, text, text) from public;
grant execute on function public.nfe_ingest(text, text, text) to anon, authenticated;

-- Chamada pela tela do app (botão "Importar XML"), só admin.
create or replace function public.nfe_upload(p_xml text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select public.current_app_role()) is distinct from 'admin' then
    raise exception 'não autorizado' using errcode = '42501';
  end if;
  return public._nfe_store(p_xml, 'upload');
end;
$$;

revoke all on function public.nfe_upload(text) from public, anon;
grant execute on function public.nfe_upload(text) to authenticated;
