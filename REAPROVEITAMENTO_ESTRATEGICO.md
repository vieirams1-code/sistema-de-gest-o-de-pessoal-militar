# Reuso Estratégico de Componentes e Serviços

Este documento detalha os ativos de software (Componentes, Serviços e Bundles) identificados no ecossistema SGP que possuem alto potencial de reaproveitamento para os novos módulos e evoluções planejadas.

---

## 1. Ficha 360º (Perfil Unificado)
*Objetivo: Consolidar toda a vida do militar em uma visão única e cronológica.*

### Componentes de UI
- `VerMilitar.jsx`: Estrutura principal de abas e seções.
- `ComportamentoTimeline.jsx`: Visualização cronológica de eventos disciplinares.
- `HistoricoComportamentoChart.jsx`: Gráfico de evolução de comportamento.
- `TempoServico.jsx`: Componente de cálculo e exibição de tempos (averbado, líquido, etc).
- `InstitucionalMilitarBadge.jsx`: Exibição visual de funções de comando/chefia.

### Serviços e Lógica
- `militar360Service.js`: Agregador principal que monta o bundle de dados (saúde, férias, carreira).
- `militarTimelineService.js`: Unifica `RegistroLivro`, `Atestado`, `Ferias` e `Promocoes` em um único array temporal.
- `militarAuditoriaService.js`: Calcula o score de completude cadastral e identifica pendências.
- `militarDocumentosService.js`: Agregador de fontes documentais para consulta unificada.

---

## 2. Portal Militar (Autoatendimento)
*Objetivo: Interface para o militar consultar seus próprios dados e interagir com o RH.*

### Estrutura e Segurança
- `useCurrentUser.js`: Implementação do `modoAcesso: 'proprio'` que garante isolamento de dados via RLS ou filtros de escopo.
- `getScopedMilitaresClient.js`: Abstração de busca que respeita o vínculo do usuário logado com seu ID de militar.

### Componentes de Interação
- `SolicitarAtualizacaoModal.jsx`: Fluxo pronto para o militar sugerir correções em seus dados.
- `GerarDocumentoMilitarModal.jsx`: Interface para emissão de certidões e fichas em PDF pelo próprio usuário.
- `AlertasContrato.jsx`: Alertas sobre vencimentos e situações funcionais específicas.

---

## 3. Banco de Talentos
*Objetivo: Identificar competências, cursos e habilidades na tropa.*

### Componentes e Seletores
- `TagsMilitarSection.jsx`: Exibição e gestão de competências (Tags).
- `FuncaoSelector.jsx` / `LotacaoSelector.jsx`: Filtros avançados para busca por competência e alocação.
- `EfetivoFuncoesTagsCompactas.jsx`: Visualização densa de habilidades em listas de militares.

### Inteligência de Dados
- `enriquecerMilitaresComFuncoesETags.js`: Utilitário que agrega dados de múltiplas tabelas para busca e ordenação por mérito/capacitação.
- `APLICABILIDADE_TAG_MILITAR`: Constante em `militarTags.js` que permite segmentar tags por tipo (Habilidade, Curso, Restrição).

---

## 4. Cursos e Capacitações
*Objetivo: Gestão de formação continuada e requisitos para promoção.*

### Reaproveitamento de Entidades
- **Sistema de Tags**: Utilização do `TagGrupo` (ex: "Cursos de Formação", "Especializações") e `Tag` para mapear currículos.
- `MilitarTag`: Entidade de junção que já suporta metadados (data de conclusão, validade).

### Componentes de Gestão
- `MilitarTagsBulkPanel.jsx`: Permite atribuir cursos a múltiplos militares simultaneamente (ex: conclusão de turma).
- `Tags.jsx`: Interface administrativa para gerenciar o catálogo de cursos.

---

## 5. Prontidão Operacional
*Objetivo: Visão em tempo real da disponibilidade da tropa (Visão de Comando).*

### Serviços Críticos
- `statusOperacionalService.js`: Lógica central que define se o militar está "Disponível", "Afastado", "Em Férias" ou "Em JISO".
- `afastamentosVigentesService.js`: Consolida ausências temporárias cruzando diversas fontes.
- `resetOperacionalService.js`: Utilitário para sincronização de estados de prontidão.

### Dashboards e Painéis
- `AfastamentosVigentesPanel.jsx`: Lista detalhada de quem está fora de combate hoje.
- `QuadroOperacional.jsx`: Lógica de Kanban para gestão de fluxos de trabalho e processos em andamento.
- `AuditoriaComportamentoAlert.jsx`: Alerta sobre militares que mudaram de comportamento e podem precisar de atenção do comando.

---

## Conclusão
A arquitetura atual apresenta um alto índice de modularidade, especialmente na camada de **Services Agregadores** e no **Sistema de Tags/Funções**. O desenvolvimento dos novos módulos deve focar na composição desses ativos existentes através de novos perfis de acesso e visualizações de dashboard, minimizando a criação de novas tabelas ou lógicas redundantes.
