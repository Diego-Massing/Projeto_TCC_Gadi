# km-newrastr — KM dos caminhões do New Rastreamento

O portal do New Rastreamento não tem API, recusa login feito direto por servidor,
bloqueia acessos de fora do Brasil e o firewall dele barra navegador invisível. Por
isso este programa roda **no PC do admin**: abre um Chrome normal (minimizado), entra
no portal, lê o "Relatório de Hodômetro" dia a dia e grava em `km_diario` no Supabase.
A tela **KM Rodado** do Frota Control soma os dias do período pedido.

- Cada execução continua do último dia completo gravado (na primeira vez, busca 90
  dias) e regrava o dia de hoje como parcial. PC desligado alguns dias não deixa buraco.
- Agendado no Windows: tarefa **"Frota KM New Rastreamento"** (ao entrar no Windows e a
  cada 2 horas, só com o usuário logado). Resultado da última execução em
  `ultima-execucao.log`.
- O portal aceita uma sessão por usuário: quando o programa roda, quem estiver logado
  no portal com o mesmo usuário cai.
- Se o portal pedir captcha, o programa para com erro — não tenta contornar.

## Instalar em outro PC

1. Node.js 20+ instalado.
2. Nesta pasta: `npm install` e `npx playwright install chromium`.
3. Criar `.env` (fica fora do Git):
   ```
   NEWRASTR_EMAIL=...
   NEWRASTR_LOGIN=...
   NEWRASTR_PASS=...
   KM_INGEST_SECRET=...        # o SHA-256 dele precisa estar no Vault como km_ingest_hash
   SUPABASE_URL=https://gqoefhecnsayjxyoutzo.supabase.co
   SUPABASE_ANON_KEY=...       # a chave pública do app (js/supabase-config.js)
   ```
4. Testar: `node coletar.mjs --teste` (só login e lista de veículos). Diagnóstico da
   leitura do relatório: `DEBUG=1 node coletar.mjs`.
5. Agendar `rodar.cmd` no Agendador de Tarefas.
