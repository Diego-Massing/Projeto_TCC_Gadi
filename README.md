# 🚛 Frota Control — Sistema de Gestão de Frota

Sistema web completo para gestão de frotas de caminhões, desenvolvido como Trabalho de Conclusão de Curso (TCC). Permite o controle de abastecimentos, fretes, multas, despesas, comissões de motoristas e fechamentos mensais em uma interface moderna e responsiva.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Banco de Dados](#banco-de-dados)
- [Controle de Acesso](#controle-de-acesso)

---

## Visão Geral

O **Frota Control** é uma aplicação web do tipo SPA (Single Page Application) desenvolvida com tecnologias web puras, sem frameworks front-end. O backend é sustentado pelo **Supabase** (PostgreSQL na nuvem), que provê banco de dados, autenticação e segurança por linha via RLS (Row-Level Security).

O sistema foi projetado para transportadoras e gestores de frotas que precisam de uma ferramenta centralizada para monitorar a saúde financeira e operacional de seus veículos e motoristas — desde o controle de combustível até o fechamento mensal de comissões.

---

## Funcionalidades

### 📊 Dashboard
- Visão geral da frota com KPIs do mês selecionado
- Filtragem por caminhão e mês/ano
- **Gráficos:**
  - Receita vs Despesas dos últimos 6 meses (gráfico de barras)
  - Distribuição de gastos por categoria (gráfico de rosca)
  - Top caminhões por receita de fretes
- Lista de multas pendentes de pagamento
- **Alertas de manutenção preventiva** baseados em quilometragem (aviso a 90% do intervalo, alerta ao ultrapassar)

### 🚛 Caminhões
- Cadastro completo de veículos (placa, modelo, ano, cor, status)
- Status do caminhão: ativo, inativo ou em manutenção
- Odômetro atualizado automaticamente a cada abastecimento ou frete
- **Taxas R$/KM personalizadas por caminhão** (sobrescreve o padrão do sistema)
- Vínculo com motorista responsável
- Acesso à página de detalhes com abas para todos os dados do veículo

### 🚛 Detalhe do Caminhão (abas)
- **Resumo:** totais do mês de abastecimentos, fretes, multas e despesas
- **Abastecimentos, Fretes, Multas, Despesas:** registros filtrados por veículo
- **Pneus:** pneus atualmente instalados (por eixo e posição)
- **Manutenção:** planos de manutenção preventiva com controle por KM
- **Fechamento mensal:** relatório do mês com média de consumo e saldo. Inclui automaticamente o salário do motorista (sem vales) quando há fechamento salvo para o período

### ⛽ Abastecimentos
- Registro completo: data, KM, litros, valor/litro, valor total, posto, tipo de combustível
- **Tipos suportados:** Diesel, Diesel S-10, Arla 32
  - Arla é registrado separadamente e **não entra no cálculo de média km/L**
- Exportação em CSV
- Filtragem por período e placa
- Motoristas veem apenas os abastecimentos do próprio caminhão

### 📦 Fretes
- Registro de cargas: origem, destino, cliente, produto, peso, valor, KM
- **Duas modalidades de precificação:**
  - **Por KM:** KM × R$/km da placa (ou padrão)
  - **Valor Fechado:** comissão fixa independente da distância
- Tipo de carga: carregado ou vazio (taxas diferentes)
- **Cálculo automático de distância** entre cidades via OSRM (Open Source Routing Machine) — gratuito, sem chave de API
- Status do frete (pendente, concluído, etc.)
- Motoristas veem apenas os fretes do próprio caminhão

### 🚨 Multas
- Registro de infrações: data, valor, motivo, local, pontos, status
- Status: pendente, paga, recorrida
- Multas pendentes aparecem como alerta no dashboard

### 💸 Despesas da Frota
- Despesas operacionais por caminhão: manutenção, pneus, seguro, peças, etc.
- Categorização por tipo e fornecedor
- Inclusão no fechamento mensal do caminhão

### 👥 Usuários e Motoristas
- **3 perfis de usuário:**
  - **Admin:** acesso total ao sistema
  - **Motorista:** acesso restrito aos próprios dados
  - **Visualizador:** acesso somente leitura
- Criação de login (e-mail + senha) pelo administrador
- Campos específicos para motoristas:
  - Caminhão associado
  - Salário fixo mensal
  - Percentual de comissão por KM (sobrescreve o padrão)

### 💼 Comissões e Fechamento do Motorista
- Fechamento por período (data início/fim) com total flexibilidade
- **Composição do pagamento:**
  - Salário fixo (integral ou proporcional por dias trabalhados)
  - Comissão KM carregado: `KM × R$/KM × % comissão`
  - Comissão KM vazio: `KM × R$/KM × % comissão`
  - Comissão fretes fechados (valor fixo por carga)
  - Prêmio por média de consumo (faixas configuráveis)
  - Despesas / reembolsos
  - Bônus manuais
  - Vales e adiantamentos (desconto)
- **Toggle Salário Integral / Proporcional:**
  - Por padrão o salário é considerado integral
  - Ao desmarcar, abre painel para informar total de dias do mês e dias trabalhados
  - Preview em tempo real do valor proporcional antes de confirmar
- **Salvar Fechamento:** persiste o fechamento no banco de dados para histórico
  - Confirmação de substituição se já existe fechamento salvo para o mesmo período
  - Seção "Fechamentos Salvos" com histórico por motorista
  - Botão de re-exportar PDF de qualquer fechamento salvo
  - Botão de exclusão individual
- **Exportar PDF:** gera relatório completo para impressão

### 📋 Fechamento Mensal (Frota)
- Geração de fechamento para todos os caminhões de uma vez
- Totais: abastecimentos, fretes, multas, despesas, saldo
- Média de consumo (km/L) com seleção manual das abastecidas de início e fim
- Inclusão automática do **salário do motorista** (sem vales) quando há fechamento salvo para o período

### 🏢 Cobranças MIRO
- Módulo exclusivo para fretes operados pela transportadora MIRO
- Fretes marcados como MIRO são agrupados em cobranças por referência
- **Controle de descontos:** desconto global aplicado ao total da cobrança
- **Boletos semanais:** cada cobrança pode ter até N boletos divididos por semana, com valor, vencimento e status de pagamento
- Visão consolidada de valores brutos, descontos e líquido a receber

### 🛞 Histórico de Pneus
- Registro de pneus descomissionados com KM rodados
- Ranking de marcas por durabilidade média (KM rodados por marca)
- Histórico completo de movimentações por posição e eixo

### 🛣️ KM Rodado (Sascar)
- Consulta o hodômetro real dos caminhões via integração com a Sascar/Michelin MyConnectedFleet
- Calcula o KM rodado por caminhão num período (semana/mês, com atalhos de "atual" e "passado(a)")
- Botão "Atualizar KM agora" sincroniza o `kmAtual` de todos os caminhões sob demanda
- Sincronização automática diária (cron às 03:00) mantém o `kmAtual` sempre atualizado
- Toda a comunicação com a Sascar roda em Supabase Edge Functions (`supabase/functions/sascar-sync` e `sascar-km-report`); credenciais ficam só no Supabase Vault, nunca no código

### ⚙️ Configurações
- **Taxas R$/KM padrão:** carregado e vazio (aplicados quando não há taxa específica do caminhão)
- **Comissões padrão:** percentuais para KM carregado e vazio
- **Salário fixo padrão** para motoristas sem valor individual definido
- **Faixas de prêmio por média km/L:** sistema de bonificação por desempenho
  - Ex: ≥ 2,0 km/L → R$100 | ≥ 2,5 km/L → R$200 | ≥ 3,0 km/L → R$350
  - O motorista recebe a faixa mais alta que atingiu
- **Backup/Restore:** exportação e importação de todos os dados em JSON
- **Reset de dados:** opção para limpar todos os registros

---

## Tecnologias Utilizadas

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript ES6+ (sem frameworks) |
| Backend / Banco | Supabase (PostgreSQL + Auth + RLS) |
| Autenticação | Supabase Auth (e-mail e senha) |
| Cálculo de Rotas | OSRM — Open Source Routing Machine (gratuito) |
| Geocodificação | Nominatim / OpenStreetMap (gratuito) |
| Gráficos | Canvas API (engine customizada, sem bibliotecas externas) |
| Deploy | Qualquer hospedagem estática (Netlify, Vercel, GitHub Pages) |

> O sistema não depende de nenhuma biblioteca JavaScript externa além do SDK do Supabase. Todo o resto (gráficos, utilitários, roteamento) foi implementado do zero.

---

## Estrutura do Projeto

```
Projeto_TCC_Gadi/
│
├── index.html                          # Shell da SPA + tela de login
│
├── css/
│   └── style.css                       # Estilos globais (tema escuro, responsivo)
│
├── js/
│   ├── supabase-config.js              # URL e chave pública do Supabase
│   ├── app.js                          # Roteador principal, autenticação, inicialização
│   ├── database.js                     # Camada de acesso ao banco (CRUD + regras de negócio)
│   ├── utils.js                        # Funções utilitárias (formatação, datas, toasts)
│   ├── charts.js                       # Engine de gráficos (barras e rosca)
│   ├── maps.js                         # Integração OSRM + Nominatim
│   ├── pages-main.js                   # Páginas: Dashboard e Caminhões
│   ├── pages-data.js                   # Páginas: Abastecimentos, Fretes, Multas, Despesas
│   ├── pages-detail.js                 # Página: Detalhes do Caminhão (abas)
│   ├── pages-drivers.js                # Páginas: Usuários e Comissões
│   └── pages-extra.js                  # Páginas: Configurações, Pneus, Importação, KM Rodado (Sascar)
│
├── supabase/functions/                 # Edge Functions (Deno) — integração Sascar/Michelin
│   ├── _shared/sascar.ts               # Cliente Sascar: login PKCE, posições, hodômetro
│   ├── sascar-sync/                    # Atualiza kmAtual dos caminhões (cron diário + botão manual)
│   └── sascar-km-report/               # Calcula KM rodado por caminhão num período
│
├── supabase-schema.sql                 # Schema inicial do banco de dados
├── supabase-migration-*.sql            # Migrações incrementais
├── migrate.html                        # Ferramenta de migração IndexedDB → Supabase
└── README.md
```

---

## Banco de Dados

O sistema utiliza **18 tabelas** no PostgreSQL via Supabase, todas com Row-Level Security habilitada (cada usuário acessa apenas seus próprios dados).

| Tabela | Descrição |
|---|---|
| `app_users` | Perfis de usuários (motoristas, admins, visualizadores) |
| `trucks` | Cadastro de caminhões |
| `fuelings` | Registros de abastecimentos |
| `freights` | Registros de fretes/cargas |
| `fines` | Infrações de trânsito e multas |
| `truck_expenses` | Despesas operacionais dos veículos |
| `driver_expenses` | Reembolsos e despesas dos motoristas |
| `driver_bonuses` | Bônus individuais dos motoristas |
| `driver_discounts` | Vales e adiantamentos dos motoristas |
| `driver_closings` | Fechamentos de comissão salvos por período |
| `truck_closings` | Fechamentos mensais salvos por caminhão |
| `closings` | Cache de fechamentos mensais por caminhão |
| `settings` | Configurações do sistema (chave-valor em JSON) |
| `maintenance_plans` | Planos de manutenção preventiva por KM |
| `tires` | Pneus atualmente instalados (por eixo/posição) |
| `tires_history` | Histórico de pneus descomissionados |
| `miro_cobrancas` | Cobranças agrupadas de fretes MIRO |
| `miro_boletos` | Boletos semanais vinculados às cobranças MIRO |

### Migrações

As migrações devem ser executadas na ordem no **SQL Editor do Supabase**:

```
1. supabase-schema.sql                        → Schema inicial
2. supabase-migration-001.sql                 → Colunas adicionais em app_users e despesas
3. supabase-migration-002.sql                 → Melhorias gerais
4. supabase-migration-003.sql                 → Pneus e planos de manutenção
5. supabase-migration-driver-closings.sql     → Tabela de fechamentos de motoristas
6. supabase-migration-truck-closings.sql      → Tabela de fechamentos de caminhões
7. supabase-migration-004.sql                 → Módulo MIRO (cobranças e boletos)
8. supabase-migration-005.sql                 → Integração Sascar (function de secrets + cron job)
```

---

## Controle de Acesso

O sistema implementa RBAC (Role-Based Access Control) com três perfis:

| Funcionalidade | Admin | Motorista | Visualizador |
|---|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ |
| Gerenciar Caminhões | ✅ | ❌ | ❌ |
| Registrar Abastecimentos | ✅ | ✅ (próprio) | ❌ |
| Registrar Fretes | ✅ | ✅ (próprio) | ❌ |
| Registrar Multas | ✅ | ❌ | ❌ |
| Despesas da Frota | ✅ | ❌ | ❌ |
| Gerenciar Usuários | ✅ | ❌ | ❌ |
| Comissões / Fechamento | ✅ | ❌ | ❌ |
| Fechamento Mensal | ✅ | ❌ | ❌ |
| Cobranças MIRO | ✅ | ❌ | ❌ |
| Configurações | ✅ | ❌ | ❌ |

Motoristas visualizam apenas os dados do caminhão vinculado à sua conta.

---

## Licença

Projeto desenvolvido para fins acadêmicos como Trabalho de Conclusão de Curso.
