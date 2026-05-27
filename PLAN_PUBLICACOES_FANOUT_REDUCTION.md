# [SGP-N1-PUB] Plan publicacoes fan-out reduction

## Objetivo
Reduzir fan-out e tamanho de lote nas consultas por militar em:
- `PublicacaoExOfficio.filter`
- `Atestado.filter`

## Contexto técnico observado
Pontos atuais com potencial de fan-out:
- `AtestadoCard` executa múltiplas leituras de `PublicacaoExOfficio.filter({ militar_id })` em fluxos diferentes (carregamento e ações). 
- `atestadoPublicacaoHelpers` repete padrão de leitura por militar antes de filtrar vínculos por atestado.
- Há uso de `select` local após `filter`, indicando busca ampla seguida de filtro em memória.

## Plano de redução (menor lote)
1. **Padronizar lote por militar com limite explícito**
   - Introduzir constantes compartilhadas (ex.: `PAGE_SIZE_PUBLICACOES_MILITAR = 100`, `PAGE_SIZE_ATESTADOS_MILITAR = 100`).
   - Trocar chamadas sem limite por paginação incremental (`limit/offset`) até critério de parada.
2. **Trocar fan-out por agregação local com cache curto**
   - Em fluxos de UI com chamadas repetidas no mesmo militar, centralizar em função única (`getPublicacoesByMilitar`) com memoização por sessão de tela.
   - Reaproveitar resultado entre ações de leitura de vínculo de atestado.
3. **Aplicar filtro de domínio antes de materializar lista completa**
   - Para atestado vinculado, priorizar filtro por campo de vínculo quando possível (ou lista pré-indexada) antes de `filter` em memória.
4. **Fail-safe de volume**
   - Se total estimado exceder teto (ex.: 2.000), retornar estado parcial com aviso para refino de filtro.

## Arquivos candidatos
- `src/components/atestado/AtestadoCard.jsx`
- `src/components/atestado/atestadoPublicacaoHelpers.js`
- `src/components/atestado/atestadoPublicacaoHelpers.jsx` (duplicado funcional; avaliar consolidação)
- `src/lib/publicacoesQueryKeys.js` (chaves para cache e invalidação)

## Risco
### Baixo
- Introdução de constantes de lote e refactor leve de chamadas repetidas.

### Médio
- Divergência de comportamento entre arquivos `.js` e `.jsx` helpers duplicados.
- Paginação alterar ordenação esperada se `orderBy` não for fixado.

### Alto
- Inconsistência funcional caso regra de vínculo dependa implicitamente de coleção completa sem paginação.
- Regressão de UX se cache local ficar stale após mutações sem invalidação adequada.

## Mitigação de risco
- Fixar `orderBy` determinístico em todas as páginas.
- Testes de regressão em cenários: sem vínculo, múltiplos vínculos, vínculo inativo, grande volume.
- Invalidar cache por militar após operações de criação/edição/exclusão de publicação/atestado.
