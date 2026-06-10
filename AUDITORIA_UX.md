# Auditoria de UX e Experiência do Usuário - SGP Militar

## 1. Relatório de Atrito

Este relatório identifica os pontos de fricção que dificultam o uso diário do sistema, baseando-se na análise técnica das telas principais e fluxos de navegação.

### 1.1 Fragmentação de Módulos Correlatos
- **Férias vs. Períodos Aquisitivos:** O usuário precisa alternar constantemente entre a tela de Férias e a de Períodos Aquisitivos para gerir o ciclo de vida completo do afastamento. Não há uma visão unificada que conecte o direito (período) ao gozo (férias) de forma fluida.
- **Saúde Pulverizada:** As funcionalidades de Atestados, Extrato de Atestados e Controle de Temporários estão em páginas distintas, o que dificulta uma visão 360º da saúde do efetivo.

### 1.2 Excesso de Cliques e Ações Escondidas
- **Menus de Contexto ("Mais"):** Em quase todas as tabelas (`Militares`, `Ferias`, `Atestados`), ações críticas como "Início de Férias", "Editar" ou "Excluir" estão escondidas sob um dropdown `MoreHorizontal`. Isso adiciona um clique extra obrigatório para cada operação frequente.
- **Navegação Profunda:** O Sidebar utiliza grupos e seções expandíveis que exigem múltiplos cliques para localizar páginas menos usadas, mas importantes para o fluxo administrativo.

### 1.3 Alta Densidade Cognitiva nos Filtros
- **Tela de Efetivo (`Militares.jsx`):** A presença de 8+ filtros simultâneos (Posto, Quadro, Tag, Grupo, Condição, Movimento, Situação, Busca) gera sobrecarga visual. O usuário muitas vezes se perde em quais filtros estão ativos, especialmente quando colunas filtradas estão ocultas.
- **Filtros Pouco Intuitivos:** Alguns filtros como "Movimento" (Entradas/Saídas) em telas de consulta estática podem confundir o usuário sobre o que exatamente está sendo filtrado (histórico vs. estado atual).

### 1.4 Feedback e Visibilidade de Estado
- **Status Operacionais Complexos:** No módulo de Férias, a distinção entre "Status do Gozo" e "Situação do Período" é tecnicamente precisa, mas funcionalmente confusa para usuários que buscam apenas saber "quem está de férias hoje".
- **Falta de Atalhos Contextuais:** Uma vez localizado um militar na busca global, o sistema não oferece atalhos diretos para as ações mais comuns (ex: lançar atestado), exigindo que o usuário entre no perfil ou procure na lista específica.

## 2. Ranking de Complexidade e Atrito

Ranking das telas que mais geram carga cognitiva ou exigem cliques excessivos:

| Posição | Tela | Causa do Atrito | Impacto |
| :--- | :--- | :--- | :--- |
| 1º | **Efetivo (Militares.jsx)** | 8+ filtros, 20+ colunas configuráveis, ações em dropdown. | Sobrecarga visual e fadiga de decisão. |
| 2º | **Férias (Ferias.jsx)** | Fluxo operacional (Início/Término) escondido, dependência de Períodos Aquisitivos. | Lentidão no registro de atos administrativos. |
| 3º | **Permissões (PermissoesUsuarios.jsx)** | UI densa com matriz de permissões complexa. | Risco de erros de configuração de segurança. |
| 4º | **Atestados (Atestados.jsx)** | Listagem simples para dados com múltiplos estágios (JISO, Homologação). | Dificuldade em rastrear pendências de saúde. |

## 3. Propostas de Redesign e Simplificação

### 3.1 Unificação de Telas
- **Central de Saúde:** Unificar `Atestados`, `Extrato de Atestados` e `Controle de Temporários` em uma única página com abas (Tabs).
- **Gestão de Férias 360º:** Integrar os `Períodos Aquisitivos` diretamente na tela de `Férias` (ex: via gaveta lateral ou visão expandida), permitindo gerir o direito e o gozo no mesmo contexto.

### 3.2 Simplificações de UI e Atalhos
- **Ações Primárias Visíveis:** Retirar "Início/Término" (Férias) e "Ver" (Efetivo) do menu de contexto e transformá-los em botões de ícone direto na linha para registros ativos.
- **Painel de Filtros Inteligente:** Substituir a grade fixa de filtros por um componente de busca facetada que ocupa menos espaço e destaca filtros ativos.
- **Quick Actions na Busca Global:** Adicionar botões de ação rápida nos resultados da busca global (ex: ícone de "+" ao lado do nome do militar para abrir cadastro de atestado/férias).

### 3.3 Sugestão de Dashboards
- **Dashboard de Gestor de Saúde:** Visão focada em atestados aguardando JISO e retorno de afastamentos previstos para a semana.
- **Dashboard de Efetivo Operacional:** Gráficos de "Pronto" vs "Baixado" vs "Férias" em tempo real na Home.

### 3.4 Atalhos de Teclado
- Implementar `CMD/CTRL + K` para busca global (já presente em muitos sistemas modernos).
- Atalhos `S` para Salvar e `ESC` para Cancelar em modais de cadastro.
