// Frota Control — importa as NF-e que os postos mandam por e-mail
//
// Roda dentro da conta Gmail da Gadi (script.google.com), a cada 15 min.
// Procura os e-mails "Arquivo xml e danfe..." do Brambila, pega o anexo -nfe.xml
// e envia para o Supabase (função nfe_ingest), que guarda na caixa "Notas recebidas".
//
// Não altera nada no Gmail: o projeto só tem permissão de LEITURA (gmail.readonly
// no appsscript.json), então nenhum e-mail é marcado como lido, etiquetado ou movido.
// Nota repetida é ignorada pelo banco (a chave de acesso é única).
//
// Configuração (uma vez): Configurações do projeto → Propriedades do script →
//   NFE_SECRET = valor do segredo "nfe_ingest_secret" do Vault do Supabase.
// Depois rode a função "instalar" uma vez.

const SUPABASE_URL = 'https://gqoefhecnsayjxyoutzo.supabase.co';
// Chave pública (anon), a mesma do app — quem autoriza a gravação é o NFE_SECRET.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxb2VmaGVjbnNheWp4eW91dHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5Njk3MTIsImV4cCI6MjA4NjU0NTcxMn0.WKJD2b59-pDXWXb0tDPPfXwu7GNncY_BHBjyBe9hY4k';

// Remetentes das notas. Para outro posto, acrescente o domínio aqui.
const BUSCA = '(from:gbrambila.com.br) subject:"Arquivo xml" has:attachment';

function importarNotas() {
  const props = PropertiesService.getScriptProperties();
  const segredo = props.getProperty('NFE_SECRET');
  if (!segredo) throw new Error('Falta a propriedade NFE_SECRET (Configurações do projeto → Propriedades do script).');

  // Busca a partir de 2 dias antes do último e-mail processado (margem de segurança;
  // as repetidas o banco descarta). Primeira execução: todo o histórico.
  const ultimo = Number(props.getProperty('ULTIMO_EMAIL_MS') || 0);
  const busca = ultimo ? `${BUSCA} after:${Math.floor(ultimo / 1000) - 2 * 86400}` : BUSCA;

  let novas = 0, repetidas = 0, maisRecente = ultimo;
  for (let inicio = 0; ; inicio += 100) {
    const threads = GmailApp.search(busca, inicio, 100);
    if (threads.length === 0) break;
    for (const thread of threads) {
      for (const msg of thread.getMessages()) {
        for (const anexo of msg.getAttachments()) {
          if (!/\.xml$/i.test(anexo.getName())) continue;
          const r = enviar(segredo, anexo.getDataAsString('UTF-8'));
          if (r === 'nova') novas++;
          else if (r === 'repetida') repetidas++;
          else console.log(`${anexo.getName()}: ${r}`); // ignorada: motivo
        }
        maisRecente = Math.max(maisRecente, msg.getDate().getTime());
      }
    }
  }

  // Só avança o marcador se tudo deu certo (um erro acima interrompe antes daqui).
  props.setProperty('ULTIMO_EMAIL_MS', String(maisRecente));
  console.log(`Notas novas: ${novas} | já existentes: ${repetidas}`);
}

function enviar(segredo, xml) {
  const res = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/rpc/nfe_ingest`, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    payload: JSON.stringify({ p_secret: segredo, p_xml: xml, p_origem: 'email' }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error(`Supabase respondeu ${res.getResponseCode()}: ${res.getContentText().slice(0, 300)}`);
  return JSON.parse(res.getContentText()); // 'nova' | 'repetida' | 'ignorada: motivo'
}

// Rode uma vez: cria o agendamento a cada 15 minutos (e não duplica se rodar de novo).
function instalar() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'importarNotas')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('importarNotas').timeBased().everyMinutes(15).create();
  importarNotas();
}
