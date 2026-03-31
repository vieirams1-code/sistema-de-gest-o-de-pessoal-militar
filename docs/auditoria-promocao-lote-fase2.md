# Auditoria funcional e técnica — Promoção em lote (SGP Militar/Base44)

Data da auditoria: 2026-03-31

## Escopo auditado
- `src/services/promocaoMilitarService.js`
- `src/services/historicoPromocaoMilitarService.js`
- `src/utils/antiguidadeMilitar.js`
- `src/pages/Militares.jsx`

## 1) Ordem entre promovidos no mesmo dia/posto

### O que está correto
- O lote deduplica IDs antes de ordenar e processar, evitando que o mesmo militar receba duas ordens no mesmo lote.
- A ordem interna do lote é definida por `ordenarMilitaresPorAntiguidade`, que aplica critérios determinísticos e estáveis (posto, quadro, data, ordem herdada e desempate por id/nome).
- A atribuição de `antiguidade_referencia_ordem` percorre sequencialmente os selecionados já ordenados.

### Observação técnica
- A ordenação é baseada no estado **anterior** do militar (antes da promoção), e não em um critério específico de “antiguidade de turma” explicitamente modelado.
- Isso é coerente para promoção incremental, mas pode exigir regra formal adicional quando evoluir para conceito de turma.

## 2) Respeito a ordens já ocupadas

### O que está correto
- Antes de promover, o serviço consulta militares já existentes no mesmo `posto_graduacao + data_promocao_atual`.
- As ordens já ocupadas são carregadas em `Set` e o algoritmo busca sempre a próxima ordem livre.
- Buracos de sequência são respeitados e reaproveitados (ex.: se existem 1 e 3, próximo pode ser 2).

### Risco residual
- Não há trava transacional/atômica entre "ler ocupadas" e "gravar promovidos". Dois lotes concorrentes no mesmo posto/data podem calcular a mesma próxima ordem em paralelo.

## 3) Deduplicação da seleção

### O que está correto
- No serviço de lote, a deduplicação por ID é feita com `Set`, descartando itens sem `id` e repetidos.
- No front, seleção manual via checkbox evita inserir ID repetido em `selectedLoteIds`.
- A ação “Selecionar filtrados” substitui seleção pelo conjunto visível filtrado, reduzindo resíduos de seleção antiga.

### Limitação
- A deduplicação depende de `id` válido. Registros sem ID são descartados silenciosamente (comportamento seguro, mas pouco observável para o operador).

## 4) Promoção parcial

### O que está correto
- O fluxo permite escolher subconjunto manualmente e também selecionar todos os filtrados.
- A mensagem de UI explicita promoção parcial permitida.
- O resultado retorna contagem de `promovidos` e `semAlteracao`, útil para fechamento operacional.

### Risco residual
- O processamento é sequencial e sem rollback global: se ocorrer erro no meio do lote, parte já pode ter sido promovida e parte não.

## 5) Consistência do histórico individual

### O que está correto
- A promoção em lote reaproveita a promoção individual, que por sua vez aciona o serviço de histórico.
- O histórico só grava quando houve alteração relevante.
- Existe prevenção de duplicidade equivalente por militar (posto, quadro, data e ordem).

### Ponto de atenção
- Falha de gravação de histórico após atualização do militar pode deixar promoção sem trilha histórica, pois não há compensação transacional entre update do militar e create do histórico.

## 6) Riscos residuais em múltiplos lotes no mesmo posto/data

### Principais riscos
1. Condição de corrida para `antiguidade_referencia_ordem` (concorrência entre lotes).
2. Ausência de validação server-side de unicidade de ordem por posto/data.
3. Falha parcial por erro no meio do lote sem idempotência de retomada.

## 7) Travas pequenas recomendadas antes da próxima fase

1. **Validação otimista de colisão por item**
   - Antes de cada update, revalidar se ordem atribuída permanece livre no `posto+data` alvo.
2. **Retry curto em colisão de ordem**
   - Se detectar colisão, recalcular próxima livre e tentar novamente N vezes (ex.: 3).
3. **Relatório de lote mais detalhado**
   - Incluir em `resultados` status por militar (`promovido`, `sem_alteracao`, `falha`) e mensagem de erro por item.
4. **Checkpoint de integridade pós-lote**
   - Reconsultar `posto+data` e sinalizar duplicidades de ordem encontradas.
5. **Sinalização de descarte na deduplicação**
   - Expor contagem de registros ignorados por ausência de ID.
6. **Pré-validação opcional de dados de antiguidade**
   - Alertar quando militares selecionados estiverem com campos mínimos de antiguidade incompletos.

## Conclusão de prontidão

A implementação atual de promoção em lote está **funcionalmente consistente para uso incremental** e preserva a lógica central de antiguidade já consolidada. A base está boa para avançar.

Entretanto, para evoluir com segurança para conceito formal de turma, recomenda-se inserir pequenas travas de concorrência/colisão e ampliar a observabilidade de falhas parciais. Sem essas travas, o principal risco remanescente é inconsistência de ordem em execuções simultâneas no mesmo posto/data.
