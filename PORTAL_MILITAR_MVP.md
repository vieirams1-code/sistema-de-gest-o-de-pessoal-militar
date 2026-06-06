# MVP do Portal do Militar (SGP)

Este documento detalha o escopo do MVP (Minimum Viable Product) para o Portal do Militar, focado em autoatendimento e consulta de dados funcionais, aproveitando a maturidade da arquitetura atual do SGP.

## 1. Telas do MVP

O Portal será composto por três áreas principais, projetadas para serem mobile-friendly:

### 1.1 Dashboard do Militar (`/portal`)
- **Resumo Executivo 360º**: Versão adaptada do bundle 360, exibindo o Status Operacional (cor/motivo) e o progresso da Completude Cadastral.
- **Alertas e Notificações**: Cards de ação rápida para perícias agendadas (JISO), proximidade de férias e pendências de comportamento.
- **Atalhos Rápidos**: Botões para emitir Ficha Militar, Solicitar Atualização e consultar Escala (futuro).

### 1.2 Perfil de Autoatendimento (`/portal/perfil`)
- Reaproveita a estrutura do `VerMilitar.jsx` em modo somente leitura.
- **Abas Disponíveis**:
    - **Dados Pessoais/Funcionais**: Conferência de PII e dados de lotação/função.
    - **Comportamento**: Linha do tempo disciplinar e evolução do comportamento.
    - **Férias/Atestados**: Extrato de períodos aquisitivos e histórico de saúde.
    - **Patrimônio**: Consulta de armamentos particulares registrados.
    - **Carreira**: Linha do tempo de promoções e posição de antiguidade.

### 1.3 Central de Solicitações (`/portal/solicitacoes`)
- Listagem de pedidos de atualização cadastral enviados pelo militar.
- Status do processamento pelo RH (Pendente, Aprovado, Recusado).
- Reuso do componente `SolicitarAtualizacaoModal`.

## 2. Permissões e Segurança

A segurança é o pilar central, garantindo que o militar acesse estritamente seus dados.

- **Permissões (Action Keys)**:
    - `acesso_portal_militar`: Permissão básica de acesso ao módulo.
    - `perm_visualizar_propria_ficha`: Habilita a visualização via `modoAcesso: 'proprio'`.
    - `perm_solicitar_atualizacao_cadastral`: Autoriza o envio de formulários de correção.
    - `perm_gerar_documento_militar`: Permite a auto-emissão de certidões e PDFs.

- **Estratégia de Segurança**:
    - **Backend**: Restrição por `modoAcesso: 'proprio'` que injeta automaticamente o filtro de `militar_id` ou `email` nas consultas Deno.
    - **Frontend**: Utilização do hook `useCurrentUser` para esconder elementos administrativos (botões de edição, gestão de cotas, logs).
    - **RLS (Row Level Security)**: Garantia de que tentativas de acesso via ID na URL para registros de terceiros retornem 404/Erro.

## 3. Componentes Reaproveitáveis

Alta taxa de reuso (~85%), garantindo consistência visual e baixo custo de desenvolvimento:

| Componente | Caminho | Função |
| :--- | :--- | :--- |
| `VerMilitar.jsx` | `src/pages` | Template base para a visão do perfil. |
| `TempoServico` | `src/components/militar` | Cálculo e exibição de tempos de carreira. |
| `AlertasContrato` | `src/components/militar` | Notificações automáticas de prazos. |
| `ComportamentoTimeline`| `src/components/militar` | Linha do tempo de eventos disciplinares. |
| `SolicitarAtualizacaoModal`| `src/components/militar` | Interface de correção de dados. |
| `GerarDocumentoMilitarModal`| `src/components/documentosMilitares` | Motor de geração de PDFs. |

## 4. APIs e Services Reaproveitáveis

| Service | Função no Portal |
| :--- | :--- |
| `militar360Service` | Consolida o bundle de dados para o Dashboard. |
| `statusOperacionalService` | Define se o militar está Disponível, Afastado ou em Férias. |
| `militarTimelineService` | Agrega eventos de diversas entidades em uma visão única. |
| `justicaDisciplinaService` | Provê o histórico e cálculo de comportamento. |
| `feriasMilitarContextService` | Gerencia a lógica de períodos e saldos de férias. |
| `getScopedMilitaresClient` | Abstração para fetch seguro de dados do próprio militar. |

## 5. Cronograma (4 Semanas)

### Semana 1: Infraestrutura e Segurança
- Criação da rota `/portal` e layout básico.
- Configuração do `ProtectedRoute` para suportar o perfil "Militar".
- Validação do escopo `proprio` nas queries core.

### Semana 2: Dashboard e Perfil
- Implementação do dashboard principal com bundle 360.
- Integração da página de perfil (versão restrita do `VerMilitar`).

### Semana 3: Funcionalidades de Interação
- Implementação da Central de Solicitações.
- Ativação da emissão de documentos (Ficha e Certidões).

### Semana 4: QA e Ajustes Finais
- Testes de penetração (tentativas de bypass de escopo).
- Ajustes de responsividade mobile.
- Preparação para Rollout.

## 6. Riscos e Mitigações

| Risco | Impacto | Mitigação |
| :--- | :--- | :--- |
| **Acesso a dados de terceiros** | Crítico | Auditoria rigorosa no `getScopedMilitaresClient` e testes de RLS. |
| **Performance do Dashboard** | Médio | Utilização de `staleTime` de 5 minutos no React Query para o bundle 360. |
| **UX em dispositivos móveis** | Médio | Priorização de componentes baseados em cards e tabs empilháveis. |
| **Inconsistência de Dados** | Baixo | Uso da mesma fonte da verdade (Services) que o módulo administrativo. |

---
*Documento gerado como proposta técnica para evolução do ecossistema SGP.*
