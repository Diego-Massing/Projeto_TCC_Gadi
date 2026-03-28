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
- [Cálculos e Regras de Negócio](#cálculos-e-regras-de-negócio)
- [Configuração e Deploy](#configuração-e-deploy)
- [Como Usar](#como-usar)

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

### 🛞 Histórico de Pneus
- Registro de pneus descomissionados com KM rodados
- Ranking de marcas por durabilidade média (KM rodados por marca)
- Histórico completo de movimentações por posição e eixo

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
│   └── pages-extra.js                  # Páginas: Configurações, Pneus, Importação
│
├── supabase-schema.sql                 # Schema inicial do banco de dados
├── supabase-migration-*.sql            # Migrações incrementais
└── README.md
```

---

## Banco de Dados

O sistema utiliza **16 tabelas** no PostgreSQL via Supabase, todas com Row-Level Security habilitada (cada usuário acessa apenas seus próprios dados).

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
| `closings` | Cache de fechamentos mensais por caminhão |
| `settings` | Configurações do sistema (chave-valor em JSON) |
| `maintenance_plans` | Planos de manutenção preventiva por KM |
| `tires` | Pneus atualmente instalados (por eixo/posição) |
| `tires_history` | Histórico de pneus descomissionados |

### Migrações

As migrações devem ser executadas na ordem no **SQL Editor do Supabase**:

```
1. supabase-schema.sql                      → Schema inicial
2. supabase-migration-*.sql                 → Migrações incrementais
3. supabase-migration-driver-closings.sql   → Tabela de fechamentos salvos
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
| Configurações | ✅ | ❌ | ❌ |

Motoristas visualizam apenas os dados do caminhão vinculado à sua conta.

---

## Cálculos e Regras de Negócio

### Comissão por KM
```
Comissão = KM rodados × R$/KM × (% comissão / 100)
```
- Taxas R$/KM: padrão do sistema → sobrescrito pela placa → sobrescrito pelo motorista
- Percentuais: padrão do sistema → sobrescrito individualmente por motorista

### Salário Proporcional
```
Salário proporcional = Salário base × (Dias trabalhados / Total dias do mês)
```

### Prêmio por Consumo
```
Média km/L = (KM final − KM inicial) / (Litros consumidos no período)
```
O motorista recebe o prêmio da faixa mais alta que sua média atingiu (não cumulativo).

### Custo do Motorista para o Caminhão (sem vales)
```
Custo sem vales = Total a pagar + Total de vales
```
Os vales não entram como custo pois já foram pagos antecipadamente.

### Saldo Mensal do Caminhão
```
Saldo = Total Fretes − Abastecimentos − Multas − Despesas − Despesas Fixas − Salário Motorista
```

### Média de Consumo
- Calculada com base nas abastecidas que possuem KM registrado
- Arla 32 é excluído do cálculo
- Abastecidas sem KM são ignoradas
- Abastecida do mês anterior é incluída como referência de início

---

## Configuração e Deploy

### Pré-requisitos
- Conta no [Supabase](https://supabase.com) (plano gratuito suficiente)
- Qualquer hospedagem estática (Netlify, Vercel, GitHub Pages, etc.)

### 1. Configurar o Supabase

1. Crie um novo projeto no Supabase
2. No **SQL Editor**, execute os arquivos de schema na ordem:
   - `supabase-schema.sql`
   - `supabase-migration-driver-closings.sql`
3. Copie a **Project URL** e a **anon public key** do projeto

### 2. Configurar a aplicação

Edite o arquivo `js/supabase-config.js`:

```javascript
const supabase = window.supabase.createClient(
    'https://SEU_PROJECT_ID.supabase.co',
    'SUA_ANON_KEY'
);
```

### 3. Deploy

Por ser uma SPA estática, basta hospedar os arquivos em qualquer servidor web:

```bash
# Netlify (via CLI)
netlify deploy --prod

# Vercel (via CLI)
vercel --prod

# GitHub Pages
# Basta fazer push para o branch main com GitHub Pages habilitado nas configurações do repositório
```

### 4. Primeiro acesso

1. No painel do Supabase → **Authentication → Users**, crie o primeiro usuário (admin)
2. Acesse a aplicação e faça login com as credenciais criadas
3. Em **Configurações**, defina as taxas R$/KM e percentuais de comissão padrão
4. Cadastre os caminhões e motoristas em **Usuários**

---

## Como Usar

### Fluxo básico diário

```
1. Motorista registra abastecimento
   → Sistema atualiza KM do caminhão automaticamente

2. Motorista registra fretes realizados
   → Sistema calcula distância automaticamente via OSRM

3. Admin registra multas e despesas operacionais

4. No final do mês → Gerar Fechamento do Motorista
   → Inserir período, verificar composição (salário + comissões + bônus − vales)
   → Salvar fechamento para histórico
   → Exportar PDF para assinatura

5. Gerar Fechamento Mensal da frota
   → Sistema inclui automaticamente o salário do motorista no saldo do caminhão
   → Visualizar saldo final e média de consumo
```

### Dicas de uso

- **Taxa por caminhão:** se um caminhão tem taxa diferente do padrão, configure na tela de edição do caminhão
- **Comissão por motorista:** se um motorista tem % diferente do padrão, configure no cadastro do usuário
- **Backup:** use Configurações → Exportar Dados regularmente para manter um backup JSON
- **Manutenção preventiva:** cadastre os itens com intervalo de KM para receber alertas no dashboard

---

## Licença

Projeto desenvolvido para fins acadêmicos como Trabalho de Conclusão de Curso.
