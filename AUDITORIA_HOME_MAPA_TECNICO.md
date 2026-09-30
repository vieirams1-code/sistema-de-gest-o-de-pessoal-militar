# Auditoria Técnica: Dashboard Home (SGP Militar)

## 1. Mapa Completo da Home

### Cards de Estatística (StatCards)
- **Militares Ativos**: Contagem total de militares no escopo.
- **Atestados Ativos**: Militares afastados com status 'Ativo' ou 'Em Curso'.
- **Punições Ativas**: Punições com status 'Ativa' ou 'Em Curso'.
- **Armamentos**: Total de registros na entidade Armamento.

### Widgets / Painéis de Alerta
- **Afastamentos Vigentes**: Resumo consolidado de Atestados, Férias, Livro e LTIP.
- **Auditoria de Comportamento**: (Apenas Admin) Dry-run de melhorias de comportamento.
- **Férias Vencendo**: Alertas de períodos aquisitivos próximos ao limite de gozo.
- **Publicações Pendentes**: Registros em Livro ou ExOfficio marcados como Urgente/Importante ou aguardando BG.
- **Pendências de Comportamento**: Sugestões de mudança de comportamento pendentes de validação.
- **Inconsistências Cadastrais**: Erros críticos em dados de militares ativos.
- **Próximas Datas de JISO**: Agenda futura de juntas de saúde.
- **Atividade Recente**: Últimos 5 registros no Livro.

### Atalhos Rápidos
- Efetivo, Livro, Férias, Publicações, Atestados, Punições, Medalhas, Quadro Operacional.

---

## 2. Diagnóstico de Performance e Queries

### Queries Executadas (TanStack Query)
1. `militares-ativos`: Resolve o escopo de militares permitidos (complexidade O(N) em memória para admin).
2. `periodos-aquisitivos`: Carrega via `list()` ou `filter({militar_id: {$in: [...]}})` conforme escopo.
3. `dashboard-atestados`: **ALTO RISCO**. Usa `list()` global seguido de filtragem manual no frontend.
4. `punicoes-ativas`: **ALTO RISCO**. Usa `list()` global seguido de filtragem manual no frontend.
5. `armamentos`: **ALTO RISCO**. Usa `list()` global seguido de filtragem manual no frontend.
6. `dashboard-registros-livro`: **ALTO RISCO**. Usa `list()` global seguido de filtragem manual no frontend.
7. `dashboard-publicacoes-exofficio`: Usa `filter` por escopo ou `list` global para admin.
8. `dashboard-pendencias-comportamento`: Filtro direto por status 'Pendente'.
9. `dashboard-jisos`: Chama `fetchScopedAtestadosBundle` (Service especializado).
10. `dashboard-ferias`: Filtro por escopo ou `list` global.

### Gargalos Identificados
- **Leituras Globais Ineficientes**: O uso de `.list()` seguido de `filtrarPorMilitarIdsPermitidos` em entidades como Atestados, Punições e Armamentos degrada conforme o banco cresce.
- **Carga Cognitiva**: A Home tenta ser um gestor de tarefas detalhado, competindo com a `Central de Pendências`.
- **N+1 no modo 'próprio'**: Múltiplas chamadas de filtro para um único usuário.

---

## 3. Classificação dos Cards

| Card / Painel | Classificação | Justificativa |
| :--- | :--- | :--- |
| **StatCards (Contadores)** | **Útil** | Fornece visão rápida da magnitude da seção. |
| **Afastamentos Vigentes** | **Essencial** | Informação puramente operacional e de pronto-emprego. |
| **Férias Vencendo** | **Redundante** | Já coberto com mais detalhes e ações na Central de Pendências. |
| **Publicações Pendentes** | **Redundante** | Já coberto na Central de Pendências. |
| **Pendências Comportamento**| **Redundante** | Já coberto na Central de Pendências. |
| **Inconsistências Cadastrais**| **Essencial** | Crítico para a saúde dos dados, não está na Central (atualmente). |
| **Datas de JISO** | **Útil** | Informativo relevante para logística de saúde. |
| **Atividade Recente** | **Informativo** | Baixo valor operacional, serve apenas como log visual. |
| **Auditoria Comportamento** | **Útil (Admin)** | Importante para saneamento, mas poderia ser movido. |

---

## 4. Recomendações e Duplicidade

### Duplicidade com Central de Pendências
A Central de Pendências (`useCentralPendencias.js`) já mapeia e categoriza:
- Publicações Aguardando BG/Nota.
- Atestados Pendentes de JISO/Homologação.
- Férias Críticas e Prazos.
- Pendências de Comportamento (agrupadas).

**Recomendação**: Remover as listas detalhadas de Férias, Publicações e Comportamento da Home. Manter apenas um StatCard de "Pendências Críticas" que direcione para a Central.

### Duplicidade com Quadro Operacional
O Quadro Operacional (`QuadroOperacional.jsx`) foca na gestão visual de fluxo (Kanban).
- Os cards de Punições e Atestados no Quadro são dinâmicos.
- **Recomendação**: Manter a Home apenas como extrato quantitativo.

---

## 5. Riscos e Lotes de Evolução

### Riscos
- **Performance**: Manter o padrão de `list()` global na Home pode travar o navegador em bases com milhares de registros.
- **Sincronia**: Regras de "Férias Vencendo" calculadas em dois lugares (Home e Central) podem divergir se o código não for unificado.

### Lotes de Evolução (Proposta)
1. **Lote 1 (Backend Optimization)**: Substituir chamadas `.list()` por filtros escopados no backend para todas as entidades da Home.
2. **Lote 2 (UX Cleanup)**: Migrar Alertas de Publicações e Férias para a Central de Pendências.
3. **Lote 3 (Enriquecimento Central)**: Mover o widget de "Inconsistências Cadastrais" para a Central de Pendências, consolidando a gestão de erros lá.
4. **Lote 4 (Dashboard de Métricas)**: Converter a Home em um Dashboard de gráficos e KPIs, em vez de listas de texto.

---

## Arquivos e Serviços Envolvidos
- **Páginas**: `Home.jsx`, `CentralPendencias.jsx`, `VisualizacaoGestorEfetivo.jsx`.
- **Services**: `dashboardMilitarPendenciasService.js`, `afastamentosVigentesService.js`, `useScopedMilitarIds.js`.
- **Utilitários**: `inconsistenciasCadastrais.js`, `montarAgendaJiso.js`.

---
*Este documento é uma auditoria técnica e não implica em alterações imediatas no código.*
