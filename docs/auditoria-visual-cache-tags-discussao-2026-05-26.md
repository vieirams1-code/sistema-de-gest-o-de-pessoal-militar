# Auditoria de inconsistência visual/cache no sistema de Tags (MODO DISCUSSÃO)

Data: 2026-05-26

## Causa provável principal

1. **Inconsistência de normalização/fallback de ícone entre componentes**.
   - Há três estratégias diferentes em runtime:
     - `emoji -> icone -> icon -> fallback` (Ferias e painéis bulk).
     - `emoji` direto com fallback fixo (sections e manager).
     - regra especial por `slug/chave/nome` que força `engrenagem`/`moto_socorro` (MilitarTagsBulkPanel).
   - Isso explica telas simultâneas mostrando ícones diferentes para a mesma tag após edição.

2. **Inconsistência de query keys + invalidação parcial**.
   - Várias telas usam chaves diferentes para o mesmo catálogo de tags:
     - `['funcoes-tags', 'tags']`
     - `funcoesTagsKeys.catalogo(scope, 'tags')` => `['funcoes-tags', scopeKey, 'tags']`
   - A mutation de editar tag invalida `['funcoes-tags', 'tags']`, mas não invalida explicitamente as chaves escopadas (`['funcoes-tags', scopeKey, 'tags']`).
   - Com `staleTime` de 5 minutos em telas como `Militares`, dados antigos podem permanecer no cache da chave escopada.

## Causas secundárias

- **Fallback de cor também é inconsistente** (`#6366F1`, `#64748b`, `#1e3a5f`), reforçando percepção de “dados diferentes”.
- **Mistura de mapeamento `tag_grupo_id`/`grupo_id`** em pontos diferentes aumenta risco de representação divergente.
- **Dependências de `useMemo` estão corretas na maioria dos pontos auditados**; não achei memo evidentemente quebrado por dependência ausente nesse fluxo específico.

## Respostas objetivas

### 1) Todas as telas usam o MESMO helper para ícone?

Não.

- `src/pages/Ferias.jsx`: helper local `getTagEmoji` com fallback em cadeia (`emoji/icone/icon`).
- `src/components/militar/MilitarTagsBulkPanel.jsx`: helper local `getTagEmoji` com regra especial por slug/chave/nome + fallback `📋`.
- `src/components/ferias/FeriasTagsBulkPanel.jsx`: helper local `getTagEmoji` (`emoji/icone/icon`) + fallback `🏷️`.
- `src/components/militar/TagsMilitarSection.jsx`: usa `tag.emoji` direto no JSX.
- `src/components/ferias/FeriasTagsSection.jsx`: usa `tag.emoji` direto no JSX.
- `src/components/funcoes-tags/FuncoesTagsManager.jsx`: usa `tag.emoji` direto ao passar para `IconeCatalogo`.

### 2) Há locais usando `tag.emoji`, `tag.icone`, `tag.icon` direto?

Sim.

- `tag.emoji` direto: `TagsMilitarSection`, `FeriasTagsSection`, `FuncoesTagsManager`, trechos de `Ferias.jsx` (exibição).
- cadeia com `tag.icone`/`tag.icon`: `Ferias.jsx`, `FeriasTagsBulkPanel`, `MilitarTagsBulkPanel`.

### 3) Existe fallback diferente?

Sim, múltiplos:

- `emoji -> icone -> icon -> 🏷️` (Ferias/Ferias bulk)
- `emoji -> icone -> icon -> 📋` + regra por slug/chave/nome (Militar bulk)
- `emoji -> 🏷️` (sections e manager)

### 4) Há `key={index}` em listas de tags?

Não encontrei nos arquivos auditados de tags/férias/militar/filtros.

### 5) Há memo/useMemo que impede atualização após editar?

Não encontrei memo com dependência ausente crítica nesse fluxo. Os memos principais dependem de `tagsCatalogo`, vínculos e mapas derivados.

### 6) Após editar Tag, quais `invalidateQueries` executam?

Fluxo de `FuncoesTagsManager` (saveTag/update):
- `['funcoes-tags', 'tags']`
- `['militares-tags-filtros']`
- `['ferias-tags']`
- `['ferias', 'tags']`
- `['funcoes-tags', 'catalogo', 'tags']`

Gap observado:
- Não invalida explicitamente `funcoesTagsKeys.catalogo(scopeKey, 'tags')` (`['funcoes-tags', scopeKey, 'tags']`) usado em outras telas.

### 7) Existe query de Tag com staleTime alto?

Sim.

- Em `src/pages/Militares.jsx`, catálogos e vínculos de funções/tags usam `STALE_TIME_MS = 5 * 60 * 1000`.

### 8) Há mistura `Tag.list()`/`Tag.filter()` com queryKeys diferentes?

- Para catálogo de tags, prevalece `Tag.list(...)` com **query keys diferentes** (`['funcoes-tags','tags']` vs `['funcoes-tags', scopeKey, 'tags']`).
- `Tag.filter()` aparece no backend/function CUD escopado, mas no frontend auditado o problema principal é a divergência de query key para o mesmo dataset.

### 9) Fluxo completo ao editar Tag e ponto de dado antigo

editar (Manager)
→ mutation `atualizarTagEscopado`
→ invalidate parcial (chaves não-escopadas)
→ refetch em telas que usam mesmas keys
→ telas com key escopada + `staleTime` podem manter cache antigo
→ dropdown/chips/tabela podem divergir por:
   1) cache não invalidado na key específica
   2) fallback/helper diferente de ícone

### 10) `IconeCatalogo`: valor correto renderiza errado, ou valor chega errado?

Predominantemente **valor chega diferente/normalizado de forma diferente** entre telas.

- `IconeCatalogo` apenas converte alguns tokens especiais (`engrenagem`, `moto_socorro`, estrelas institucionais) e retorna o valor recebido nos demais casos.
- Quando uma tela força token especial (ex.: `MilitarTagsBulkPanel` por slug/chave), ela pode mostrar ícone diferente de outra tela que usa `tag.emoji` cru.

## Risco

- Alto para consistência visual e confiança do usuário (aparência de “dado corrompido” sem estar corrompido no banco).
- Médio para operação: filtros podem parecer “errados” por exibir representações visuais divergentes para o mesmo id de tag.

## Proposta mínima (sem correção agora)

1. Definir helper único de ícone/cor (single source of truth) e mapear todas as telas para ele.
2. Padronizar query keys de catálogo de tags (ou invalidar por prefixo robusto para cobrir escopadas).
3. Manter regra especial de tokens (`engrenagem`/`moto_socorro`) somente se ficar centralizada no helper único.
4. Revisar fallback final único (ex.: sempre `🏷️`) para evitar variação perceptiva.
