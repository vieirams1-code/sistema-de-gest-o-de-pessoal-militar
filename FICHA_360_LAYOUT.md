# Proposta Visual: Ficha 360º do Militar

Este documento define a nova proposta de layout para a visualização completa do militar (`VerMilitar.jsx`), consolidando dados através dos serviços da família `militar360`.

## 1. Cards Superiores (Resumo Executivo)

O topo da página deve conter uma seção de "Resumo Executivo" utilizando o `bundle360.resumoExecutivo`. Esta seção oferece uma visão imediata da prontidão e saúde dos dados do militar.

| Card | Origem dos Dados | Indicador Visual |
| :--- | :--- | :--- |
| **Status Operacional** | `statusOperacional.status` | Badge colorido (Verde: Disponível, Amarelo: Férias, Vermelho: Afastado/JISO) |
| **Completude Cadastral** | `resumoExecutivo.scoreCompletude` | Barra de progresso (0-100%) com cores semânticas |
| **Pendências Críticas** | `resumoExecutivo.pendenciasCriticas` | Badge destrutivo (vermelho) se > 0 |
| **Pendências de Atenção** | `resumoExecutivo.pendenciasAtencao` | Badge de alerta (âmbar) se > 0 |

---

## 2. Estrutura de Abas

A navegação será organizada em abas lógicas para reduzir a carga cognitiva, agrupando informações relacionadas:

1.  **Dashboard 360º (Nova)**: Visão consolidada com Timeline, principais indicadores de saúde, carreira e férias.
2.  **Dados Pessoais**: Dados biográficos, contatos, documentos e endereços (Foco em Auditoria).
3.  **Vida Funcional**: Promoções, Antiguidade e Histórico de Unidades (Lotações).
4.  **Justiça e Disciplina**: Comportamento, Punições e Recompensas.
5.  **Saúde e Afastamentos**: Atestados, JISOs e Licenças Médicas.
6.  **Férias**: Períodos aquisitivos, saldos e históricos de gozo.
7.  **Documentos e Publicações**: Repositório unificado de tudo que foi publicado sobre o militar.
8.  **Patrimônio**: Armamentos, Cargas e EPIs.

---

## 3. Timeline (Linha do Tempo Institucional)

Implementada via `militarTimelineService.js`, a Timeline deve ser o componente central da aba **Dashboard 360º**.

### Características:
- **Agregação Multi-fonte**: Consolida `RegistroLivro`, `PublicacaoExOfficio`, `Ferias`, `Atestado`, `Promocoes` e `Medalhas`.
- **Ordenação**: Cronológica decrescente (mais recente no topo).
- **Interface**:
    - Ícones distintos por tipo de evento (ex: 🎖️ Medalha, 📈 Promoção, 🏥 Saúde).
    - Título em destaque com a data lateral.
    - Descrição curta (resumo) com link para o documento original, se disponível.
    - Badge indicando a "Origem" do registro para transparência de dados.

---

## 4. Documentos e Publicações

Utiliza o serviço `militarDocumentosService.js` para prover uma visão granular de todos os atos administrativos vinculados ao militar.

### Componentes de UI:
- **Filtros Rápidos**: Botões de toggle para filtrar por: *Publicações*, *Saúde*, *Carreira*, *Férias*.
- **Busca por Período**: Seleção de Data Início/Fim para auditoria de períodos específicos.
- **Lista Unificada**:
    - Cabeçalho com o total de documentos encontrados.
    - Colunas: `Data`, `Tipo`, `Título`, `Referência/Conteúdo` e `Ação` (Visualizar PDF/Original).

---

## 5. Auditoria de Saúde dos Dados

Baseada no `militarAuditoriaService.js`, esta seção deve ser exibida na aba **Dados Pessoais** como um painel lateral ou cabeçalho de seção para incentivar a completude cadastral.

### Elementos:
- **Score Card**: Exibição circular do percentual de integridade (ex: 85%).
- **Lista de Pendências Críticas (Bloqueantes)**:
    - Destacar: CPF faltante/inválido, Matrícula incompleta, Data de Nascimento.
    - Ícone de erro (X vermelho).
- **Lista de Pendências de Atenção (Avisos)**:
    - Destacar: Endereço incompleto, E-mail não informado, RG, Tipo Sanguíneo.
    - Ícone de alerta (!) âmbar.
- **Botão de Ação**: "Solicitar Correção de Dados" vinculado ao `SolicitarAtualizacaoModal`.

---
