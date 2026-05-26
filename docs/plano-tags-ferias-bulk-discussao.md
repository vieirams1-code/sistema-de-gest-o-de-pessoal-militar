# MODO DISCUSSÃO — Tags em Férias no padrão “Gerenciar Tags”

## 1) Arquivos que provavelmente serão alterados

### Frontend (principal)
- `src/pages/Ferias.jsx`
  - incluir estado de seleção em lote (`selectedFeriasIds`), checkbox por card/linha e ação contextual `Gerenciar Tags`;
  - acionar painel lateral (drawer) de gestão em lote;
  - invalidar/refetch de queries após salvar lote.
- `src/components/ferias/FeriasTagsBulkPanel.jsx` **(novo recomendado)**
  - UI semelhante ao `MilitarTagsBulkPanel`, mas orientada a `Ferias` como alvo;
  - listar férias selecionadas;
  - listar tags aplicáveis por grupo (`TagGrupo`);
  - calcular estado por tag (all/some/none) e aplicar marca/desmarca em lote.
- `src/utils/funcoesTags/feriasTagsBulk.js` **(novo recomendado)**
  - utilitários de diff/planejamento de operações em lote (criar/remover vínculo por férias/tag).
- `src/utils/funcoesTags/queryKeys.js`
  - possivelmente adicionar helpers específicos para invalidação em lote de férias/tags (opcional, melhora consistência).

### Serviços
- `src/services/cudFuncoesTagsEscopadoClient.js`
  - já possui `criarFeriasTagEscopado` e `removerFeriasTagEscopado`; provável apenas reutilização.
- `src/services/feriasTagsBulkService.js` **(novo opcional, recomendado)**
  - orquestrar operações em lote com `Promise.allSettled`, consolidar erros e telemetria.

### Possível suporte backend (se faltar)
- função `cudFuncoesTagsEscopado` (backend)
  - confirmar aceitação de `entidade: 'FeriasTag'` com operações `create` e `remover` para o contexto do usuário;
  - caso não suporte auditoria/escopo em lote, implementar no backend.

---

## 2) Arquitetura proposta

### Decisão: **criar `FeriasTagsBulkPanel`** (não generalizar tudo agora)

**Por quê:**
- `MilitarTagsBulkPanel` já embute semântica de Militar (labels, campos exibidos, cálculos e textos de UX);
- generalizar agora aumenta risco de regressão em Militar;
- em Férias, alvo, permissões e invalidações diferem.

**Estratégia recomendada:**
- extrair apenas utilidades neutras (group/sort/status/diff) para módulo compartilhado;
- manter dois painéis de apresentação (`MilitarTagsBulkPanel` e `FeriasTagsBulkPanel`) com UX específica;
- refatoração de “componente genérico de bulk tags” pode entrar em fase 2.

### Fluxo técnico
1. Usuário seleciona 1..N férias em `Ferias.jsx`.
2. Ação contextual abre `FeriasTagsBulkPanel`.
3. Painel carrega catálogo:
   - `Tag` (ativas)
   - `TagGrupo` (ativos)
   - `FeriasTag` das férias selecionadas
4. Painel filtra aplicabilidade de tag para férias (`ferias|todos|ambos` + ativo).
5. Ao salvar:
   - para cada férias + tag marcada ausente: `criarFeriasTagEscopado`;
   - para cada férias + tag desmarcada presente: `removerFeriasTagEscopado` (status removida/inativação);
6. Invalida queries relacionadas e atualiza cards/lista.

---

## 3) FeriasTag já tem suporte backend suficiente?

## Evidência encontrada no frontend
- Já existem chamadas escopadas para `FeriasTag`:
  - `criarFeriasTagEscopado` com `entidade: 'FeriasTag', operacao: 'create'`;
  - `removerFeriasTagEscopado` com `entidade: 'FeriasTag', operacao: 'remover'`.
- `FeriasTagsSection` já usa essas operações com sucesso no fluxo unitário (por férias individual).

## Conclusão
- **Provavelmente sim para CRUD básico de vínculo** (create/remover), pois o fluxo individual já está implementado.
- **Ponto a validar na auditoria backend:** limites e regras de permissão quando disparado em lote (N férias x M tags), além de tratamento transacional/parcial.

---

## 4) Riscos

- **Permissão/escopo por férias**:
  - usuário pode ter escopo parcial; lote pode misturar férias permitidas e não permitidas.
  - mitigação: validar escopo no backend por item e retornar relatório de rejeições.

- **Inconsistência parcial em lote**:
  - parte das operações pode falhar.
  - mitigação: `Promise.allSettled`, resumo de sucesso/falha e opção de retry só nos falhos.

- **Concorrência/duplicidade**:
  - tag já ativa no momento de salvar (race condition).
  - mitigação: backend idempotente/checagem de duplicidade + frontend tolerante.

- **Performance**:
  - lotes grandes podem gerar muitas chamadas.
  - mitigação: limitar lote por envio (ex. 100-200 operações) ou endpoint bulk dedicado.

- **Regressão de UX no `Ferias.jsx`**:
  - inclusão de seleção em cards/tabela exige cuidado com filtros/paginação/ordenação.

---

## 5) Plano em lote pequeno de produção

### Lote 1 — Base funcional (MVP)
- seleção múltipla em `Ferias.jsx`;
- botão `Gerenciar Tags` contextual;
- novo `FeriasTagsBulkPanel` com:
  - alvo selecionado;
  - catálogo de tags por grupo;
  - marca/desmarca + salvar;
- aplicar create/remover usando client escopado atual;
- invalidar queries principais (`ferias`, `ferias-tags`, catálogo tags/grupos quando necessário).

### Lote 2 — Robustez operacional
- consolidação de erros por item com relatório (sucesso, falha, motivo);
- retry de falhas;
- limites de lote/chunking;
- testes unitários de diff/planejamento de operações.

### Lote 3 — Evolução arquitetural
- extração de utilitários comuns Militar/Férias;
- opcional: componente base compartilhado de bulk tags.

---

## 6) Critérios de aceite

1. Usuário consegue selecionar múltiplas férias na listagem e abrir `Gerenciar Tags`.
2. Painel mostra corretamente as férias selecionadas.
3. Painel lista somente tags aplicáveis a férias (`ferias`, `todos`, `ambos`) e ativas.
4. Tags exibidas agrupadas por `TagGrupo` ativo (ou “Sem grupo”).
5. Ao salvar:
   - cria vínculos ausentes para tags marcadas;
   - remove/inativa vínculos ativos para tags desmarcadas.
6. Atualização visual imediata após operação (cards/lista e seção de tags por férias).
7. Sem impacto no fluxo de `MilitarTag`.
8. Sem reintrodução de `tipo_uso`/“tag única”.
9. Erros de escopo/permissão aparecem com feedback claro sem quebrar toda a operação.

---

## Auditoria obrigatória (resultado objetivo)

- **Onde Férias lista/renderiza registros:** `src/pages/Ferias.jsx` (consulta, filtros, agrupamento e render principal).
- **Já existe seleção múltipla em Férias?** Não foi identificado estado/controle de seleção em lote em `Ferias.jsx`.
- **FeriasTag já é usada?** Sim, em `src/components/ferias/FeriasTagsSection.jsx` (adicionar/remover/listar vínculos).
- **`cudFuncoesTagsEscopado` cliente já suporta FeriasTag C/U/D?** Cliente suporta create/remover para `FeriasTag` em `src/services/cudFuncoesTagsEscopadoClient.js`.
- **Há serviço/client para aplicar tags em férias?** Sim, já existe client escopado (individual). Serviço bulk dedicado ainda não.
- **Melhor criar `FeriasTagsBulkPanel` ou generalizar `MilitarTagsBulkPanel`?** Criar `FeriasTagsBulkPanel` agora + extração parcial de utilitários compartilháveis.
- **Query keys/refetch necessários (mínimo):**
  - `['ferias', ...escopo]`
  - `funcoesTagsKeys.feriasTags(scopeKey, feriasId)` para férias impactadas
  - `['ferias-tags']` (compatibilidade com trecho legado)
  - catálogo apenas se alterado: `funcoesTagsKeys.catalogo(scopeKey, 'tags'|'grupos')`
- **Riscos de escopo/permissão:** validação por item no backend, tratamento de falha parcial e mensagens claras ao usuário.
