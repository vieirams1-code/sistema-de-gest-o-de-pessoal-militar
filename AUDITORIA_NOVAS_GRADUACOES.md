# RELATÓRIO DE AUDITORIA DE IMPACTO - NOVAS GRADUACOES ("ALUNO A CABO" E "ALUNO A SARGENTO")

## 1. Inventário de Impactos

| Arquivo | Função/Componente | Tipo de Uso | Risco | Necessidade de Ajuste |
| :--- | :--- | :--- | :--- | :--- |
| `src/constants/postosGraduacoes.js` | `POSTOS_GRADUACOES_HIERARQUIA` | Definição canônica da hierarquia. | **ALTO** | Incluir "Aluno a Cabo" entre Sd e Cb, e "Aluno a Sargento" entre Cb e 3º Sgt. |
| `src/utils/postoGraduacaoHierarquia.js` | `ALIASES`, `INDICE_POR_POSTO` | Normalização de nomes e busca de índice. | **ALTO** | Adicionar aliases (ex: "AL Cb", "AL Sgt") e mapear para os novos nomes canônicos. |
| `src/utils/postoQuadroCompatibilidade.js` | `POSTOS_PRACAS`, `classificarPostoGraduacao` | Diferenciação entre Oficial e Praça. | **ALTO** | Incluir as novas graduações em `POSTOS_PRACAS`. |
| `src/utils/antiguidade/calcularAntiguidadeMilitar.js` | Comparação de postos para ordenação. | Lógica de ordenação principal. | **ALTO** | Validar se o uso do índice da hierarquia afetará a preservação da antiguidade anterior. |
| `base44/functions/publicarPromocaoOficial/entry.ts` | `POSTOS_HIERARQUIA`, `compararPromocaoComCadastro` | Decisão de atualização automática do perfil. | **MÉDIO** | Sincronizar a lista de postos com o frontend para garantir que a promoção para Aluno atualize o cadastro. |
| `base44/functions/sincronizarGraduacoesPromocao/entry.ts` | `POSTOS_HIERARQUIA` | Sincronização em lote de postos divergentes. | **MÉDIO** | Sincronizar a lista de postos para evitar que Alunos sejam marcados como "indefinidos". |
| `src/utils/calcularComportamento.js` | `PRACAS`, `temRegraArt53` | Cálculo de comportamento disciplinar. | **MÉDIO** | Incluir em `PRACAS`. Avaliar se a regra do Art. 53 (Soldado) se estende a Aluno a Cabo. |
| `src/services/medalhasTempoServicoService.js` | `isPracaComComportamentoInvalido` | Elegibilidade de medalhas. | **BAIXO** | Nenhuma ação direta, pois usa `classificarPostoGraduacao` (que será ajustado). |
| `src/pages/CadastrarMilitar.jsx` | `POSTOS_GRADUACOES` | Lista de seleção manual no formulário. | **MÉDIO** | Adicionar as novas opções no grupo "Praças". |
| `src/components/efetivo-gestor/VisualizacoesGestor.jsx` | `separarMilitaresLista` | Agrupamento visual (Oficiais, ST/Sgt, Cb/Sd). | **MÉDIO** | Decidir onde Alunos se encaixam (provavelmente Cb/Sd para Al Cb e ST/Sgt para Al Sgt). |
| `src/utils/efetivo/montarArvoreLotacaoMilitares.js` | `obterGrupoHierarquicoMilitar` | Agrupamento para estatísticas do gestor. | **BAIXO** | Validar regex de "Praça" vs "Oficial". |
| `src/components/utils/templateContratoUtils.js` | `ABREVIATURAS` | Geração de documentos e templates. | **MÉDIO** | Adicionar "AL Cb" e "AL Sgt". |
| `src/components/antiguidade/promocaoHistoricaUtils.js` | `POSTOS_GRADUACOES`, `getPostoAnteriorPrevisto` | Lógica de promoção sucessiva e histórica. | **MÉDIO** | Atualizar lista e verificar se a lógica de "posto anterior" (Sd -> Cb) precisa agora considerar o Aluno. |

---

## 2. Riscos Classificados

### **ALTO RISCO**
*   **Quebra na Ordenação de Antiguidade:** Como a ordenação principal usa o índice da lista `POSTOS_GRADUACOES_HIERARQUIA`, a inserção de novos itens no meio da lista deslocará os índices de todos os postos superiores. Se houver persistência de índices em banco (improvável, mas deve ser verificado) ou se a lógica de preservação não for explícita, a ordem de precedência pode ser afetada.
*   **Incompatibilidade com Histórico:** A regra de "preservar antiguidade anterior" exige que, ao ser promovido a Aluno, o militar NÃO receba um novo número de classificação. O sistema de Promoções hoje tende a exigir uma `ordem` para cada item publicado.

### **MÉDIO RISCO**
*   **Divergência entre Frontend e Edge Functions:** As Edge Functions de publicação e sincronização possuem cópias locais da hierarquia. A falha em atualizar todas simultaneamente causará erros de "Posto não reconhecido".
*   **Templates de Documentos:** A ausência de abreviaturas causará a exibição do nome por extenso em documentos oficiais, o que pode violar padrões institucionais.

### **BAIXO RISCO**
*   **Filtros e Buscas:** A maioria dos filtros é dinâmica e lerá os novos postos do cadastro, mas agrupamentos estáticos (ex: "Todas as Praças") podem precisar de revisão.

---

## 3. Análise Conceitual

1.  **As novas graduações devem ser tratadas como postos efetivos ou situações transitórias?**
    Devem ser tratadas como **postos efetivos para fins de identificação e hierarquia**, mas como **situações transitórias para fins de antiguidade**. O sistema deve permitir que o militar ostente a graduação de Aluno, mas o cálculo de sua posição na lista de antiguidade deve continuar referenciando os parâmetros da graduação anterior (Sd ou Cb).

2.  **Faz sentido incluí-las na hierarquia principal ou como categoria especial?**
    Na **hierarquia principal**. Isso facilita a ordenação natural em listas de efetivo e garante que filtros de "superiores/inferiores" funcionem sem lógica customizada complexa.

3.  **Existe risco de afetar a lógica de antiguidade?**
    Sim. O sistema utiliza a triade `[Posto, Quadro, Antiguidade Ordem]`. Ao mudar o `Posto` de "Soldado" para "Aluno a Cabo", ele naturalmente subirá na lista acima de todos os Soldados, o que está correto. O risco é o campo `Antiguidade Ordem` ser reiniciado ou alterado, o que violaria a regra de preservação.

4.  **Existem módulos que assumem que Soldado → Cabo e Cabo → 3º Sargento são transições diretas?**
    Sim, o módulo de **Promoção Sucessiva** (`promocaoHistoricaUtils.js`) e os diagnósticos de interstício podem assumir passos fixos. A inclusão de Alunos tornará essas transições "em dois passos".

5.  **Qual a melhor estratégia técnica?**
    Tratá-las como **graduações normais na hierarquia principal**, mas com um **flag ou tratamento especial no Gerador de Promoções** para que, quando o destino for um "Aluno", a ordem de antiguidade seja obrigatoriamente copiada do cadastro atual e o campo de "Nova Classificação" seja bloqueado.

---

## 4. Proposta Arquitetural Recomendada

1.  **Centralização da Hierarquia:** Mover a lista `POSTOS_GRADUACOES_HIERARQUIA` para um local onde as Edge Functions também possam consumir (ou garantir sincronização rigorosa).
2.  **Mapeamento de Preservação:** Criar uma constante `POSTOS_TRANSITORIOS_PRESERVAM_ANTIGUIDADE = ['Aluno a Cabo', 'Aluno a Sargento']`.
3.  **Ajuste no Comparador:** O `calcularAntiguidadeMilitar.js` deve ser mantido como está (usando índice), pois o deslocamento de Aluno acima de Soldado é o comportamento esperado.
4.  **Ajuste na Publicação:** Modificar a Edge Function `publicarPromocaoOficial` para que, ao detectar um posto em `POSTOS_TRANSITORIOS_PRESERVAM_ANTIGUIDADE`, ela não tente re-classificar o militar, apenas atualize o posto preservando o número de ordem.

---

## 5. Plano de Implementação em Fases

### Fase 1: Infraestrutura e Catálogos
*   Atualizar `postosGraduacoes.js` e `postoGraduacaoHierarquia.js`.
*   Atualizar `postoQuadroCompatibilidade.js` (`POSTOS_PRACAS`).
*   Sincronizar Edge Functions (`publicarPromocaoOficial` e `sincronizarGraduacoesPromocao`).

### Fase 2: Lógica de Negócio e Promoções
*   Implementar regra de bloqueio de nova classificação para graduações de Aluno.
*   Ajustar `promocaoHistoricaUtils.js` para reconhecer o novo fluxo de carreira (Sd -> Al Cb -> Cb).

### Fase 3: UI e Documentos
*   Atualizar `CadastrarMilitar.jsx`, `VisualizacoesGestor.jsx` e `templateContratoUtils.js`.
*   Ajustar filtros de extração de efetivo.

---

## 6. Testes Necessários

1.  **Unitários:**
    *   `compararPostos("Aluno a Cabo", "Soldado")` deve retornar 1.
    *   `compararPostos("Aluno a Cabo", "Cabo")` deve retornar -1.
    *   `classificarPostoGraduacao("Aluno a Cabo")` deve retornar "praca".
2.  **Integrados:**
    *   Publicar uma promoção de Soldado para Aluno a Cabo e verificar se a `antiguidade_referencia_ordem` foi mantida.
    *   Verificar se um Aluno a Cabo aparece corretamente posicionado entre Soldados e Cabos na Previa de Antiguidade Geral.
3.  **Regressão:**
    *   Garantir que promoções diretas (Sd -> Cb) ainda funcionem para casos legados ou excepcionais.
    *   Validar se o cálculo de comportamento (Bom, Ótimo, etc.) continua funcionando para os novos postos.
