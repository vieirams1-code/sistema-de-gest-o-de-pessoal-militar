# Avaliação transacional — `promocaoService.js`

## Arquivo
- `src/services/promocaoService.js`

## Cadeia → Risco → Menor patch

### 1) Reversão de publicação (`reverterPublicacaoPromocaoMilitar`)
- **Cadeia**
  1. `Historico.update(... status_registro: 'cancelado' ...)`
  2. `restaurarCadastroMilitarDaPromocao(...)` → `Militar.update(...)`
  3. `PromocaoMilitar.update(... status: 'cancelado', publicado: false ...)`
  4. `Promocao.update(... status recalculado ...)`
- **Risco**
  - Atualização parcial: histórico cancelado sem rollback cadastral, ou item cancelado sem recálculo da promoção.
  - Inconsistência entre `historico`, `militar`, `promocao_militar` e `promocao`.
- **Menor patch**
  - Encapsular os 4 passos em **uma transação backend** (`base44.functions.invoke`) com commit/rollback atômico.
  - No frontend, trocar múltiplos updates locais por chamada única: `reverterPublicacaoPromocaoMilitarTx`.

### 2) Exclusão definitiva em cadeia (`excluirCadeiaPromocaoMilitar`)
- **Cadeia**
  1. `restaurarCadastroMilitarDaPromocao(...)` → `Militar.update(...)`
  2. `Historico.delete(historicoId)`
  3. `PromocaoMilitar.delete(itemId)`
  4. `PromocaoMilitar.filter/list(...)`
  5. `Promocao.delete(...)` **ou** `Promocao.update(... status ...)`
- **Risco**
  - Orfandade/lacuna: histórico excluído mas item não, item excluído mas promoção não recalculada.
  - Corrida entre leitura de vinculados e atualização final de status.
- **Menor patch**
  - Fazer `delete + recálculo` em função transacional única no backend (`excluirCadeiaPromocaoMilitarTx`).
  - Garantir leitura consistente dos vinculados dentro da mesma transação.

### 3) Sincronização de histórico após edição de promoção publicada (`sincronizarHistoricoPromocaoPublicada`)
- **Cadeia**
  1. `Historico.list()`
  2. Loop com `Promise.all(...)` de `Historico.update(...)` por registro
- **Risco**
  - Atualização parcial em lote (parte atualiza, parte falha).
  - `Promise.all` paraleliza sem isolamento transacional.
- **Menor patch**
  - Criar endpoint transacional em lote para atualizar todos históricos vinculados de uma vez.
  - Se não houver suporte imediato: trocar por processamento sequencial com trilha de erro + mecanismo compensatório.

### 4) Publicação oficial (`publicarPromocaoOficial`)
- **Cadeia**
  1. Validação no frontend
  2. `invoke('publicarPromocaoOficial', { body })`
  3. Backend publica vários itens e possivelmente atualiza histórico/cadastro
- **Risco**
  - Se backend não for transacional por item/lote, pode haver publicação parcial difícil de reconciliar.
  - Elegibilidade filtrada no frontend pode divergir do estado real no momento da escrita.
- **Menor patch**
  - Confirmar/forçar transação no backend por item (com savepoint) ou por lote conforme regra de negócio.
  - Retornar relatório estruturado por item + idempotência (chave por `promocao_id` + `militar_id`).

## Priorização prática (ordem sugerida)
1. `reverterPublicacaoPromocaoMilitar` (alto risco de inconsistência cruzada)
2. `excluirCadeiaPromocaoMilitar` (alto risco de orfandade)
3. `sincronizarHistoricoPromocaoPublicada` (risco de parcial em lote)
4. validar atomicidade real de `publicarPromocaoOficial` no backend
