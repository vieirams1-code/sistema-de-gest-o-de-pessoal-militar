# Auditoria — Redesenho da ordenação de Promoções por lista de antiguidade atual

## Escopo
- **Sem implementação neste lote**.
- **Sem alteração de schema**.
- **Sem alteração do motor da Prévia Geral** (`calcularPreviaAntiguidadeGeral`).
- Objetivo: propor arquitetura para o botão **"Ordenar pela lista atual"** no fluxo de promoção.

## Diagnóstico do motor atual

### 1) A Prévia Geral já entrega ranking suficiente
O motor de Prévia Geral já estrutura os militares com os elementos necessários para ordenação por lista vigente:
- normalização de posto/quadro;
- escolha de histórico ativo compatível;
- ordenação de antiguidade com critérios hierárquicos e de desempate;
- geração de posições de ordenação para consumo da UI/serviços.

No estado atual do sistema, a publicação da promoção usa `item.ordem` para gravar `HistoricoPromocaoMilitarV2.antiguidade_referencia_ordem`, isto é, a promoção já aceita uma ordem externa predefinida antes de publicar.

### 2) A publicação já está pronta para consumir ordem em bloco
A função de publicação cria payload de histórico com:
- `antiguidade_referencia_ordem: Number(item.ordem)`.

Logo, o problema principal não está na publicação, e sim em **como preencher `item.ordem` antes da publicação** de forma aderente à lista de antiguidade vigente.

## Comparação: lógica atual vs lógica proposta

### Lógica atual (histórico individual)
- Atribuição de ordem tende a depender de edição/ajuste item a item no contexto da promoção.
- Em cenários coletivos, há riscos de divergência entre a ordem digitada e a lista real vigente na data.

### Lógica proposta (lista de antiguidade atual)
- A ordem da promoção passa a ser derivada de uma única fonte: **snapshot lógico da lista atual imediatamente anterior**.
- O operador escolhe os militares livremente.
- Ao clicar em **"Ordenar pela lista atual"**, o sistema:
  1. monta a lista atual via Prévia Geral;
  2. localiza os selecionados;
  3. ordena os selecionados pela posição prévia;
  4. renumera internamente o bloco na promoção (1..N), preservando a ordem relativa original da lista.

Resultado: comportamento equivalente ao processo manual de “retirar/mover bloco preservando a ordem interna”.

## Arquitetura sugerida (sem mexer no motor)

## Função pura sugerida

```ts
ordenarPromovidosPorListaAtual({
  itensPromocao,                // [{ id, militar_id, ... }]
  previaGeral,                  // saída já calculada do motor existente
  filtroListaAnterior,          // { postoOrigem, quadroOrigem }
  regraExcecaoFormacao3Sgt,     // boolean
}): {
  itensOrdenados,               // itens com ordem sequencial 1..N
  auditoria,                    // metadados para UI/log
  pendencias,                   // selecionados não encontrados / inconsistências
}
```

### Contrato funcional da função
1. **Exceção 3º Sgt por formação**
   - Se `regraExcecaoFormacao3Sgt=true`, não usa lista anterior.
   - Retorna sem reordenar automaticamente (ordem manual/classificação de curso).

2. **Seleção da lista-base**
   - Filtra `previaGeral` por posto/quadro de origem (ex.: promoção para 2º Sgt usa lista de 3º Sgt).
   - Usa exatamente o ranking vindo da prévia (não recalcula critérios).

3. **Mapeamento de ranking**
   - Cria `Map<militar_id, posicaoAnterior>` com base na lista filtrada.

4. **Ordenação dos promovidos**
   - Ordena `itensPromocao` por `posicaoAnterior` crescente.
   - Em empate/ausência, mantém estabilidade por ordem de inserção original no lote e gera pendência.

5. **Renumeração do bloco**
   - Reatribui `ordem = indice + 1` no conjunto ordenado.
   - Preserva internamente o bloco conforme lista anterior (equivalente ao processo manual).

6. **Auditoria retornada**
   - texto pronto de UX: `"Ordem preservada conforme a lista atual de <postoOrigem> / <quadroOrigem>."`
   - totais: selecionados, encontrados, não encontrados, data-base usada.

## Como gerar a lista atual com o motor existente
1. Coletar os mesmos insumos já usados pela tela de prévia (militares + históricos ativos relevantes).
2. Invocar `calcularPreviaAntiguidadeGeral(...)` sem alterar assinatura/comparador.
3. Consumir apenas o resultado ordenado produzido.
4. Aplicar filtro por posto/quadro de origem **fora** do motor.

Essa estratégia atende à proibição de alterar a Prévia e reduz risco de regressão no ranking global.

## Filtro por posto/quadro anterior (casos do fluxo)
- Promoção para **2º Sgt** → lista-base: **3º Sgt** do quadro aplicável.
- Promoção para **1º Sgt** → lista-base: **2º Sgt**.
- Promoção para **Subtenente** → lista-base: **1º Sgt**.
- Promoção para **3º Sgt por formação** → bypass da lista-base; usar classificação manual do curso.

Observação operacional: para evitar ambiguidades, o filtro deve usar posto/quadro **normalizados** com as mesmas regras de normalização já aplicadas pela prévia.

## Publicação e persistência (`HistoricoPromocaoMilitarV2`)
Sem alterar schema, a publicação já persiste a ordem do lote ao gravar:
- `HistoricoPromocaoMilitarV2.antiguidade_referencia_ordem = Number(item.ordem)`.

Portanto, ao garantir que `item.ordem` tenha sido previamente ordenado pelo botão da lista atual, a persistência histórica já fica consistente com o novo desenho.

## Lote de produção pequeno (sugestão)

### Lote A — Backend/UI de ordenação (baixo risco)
- adicionar função pura `ordenarPromovidosPorListaAtual` em serviço/utilitário de promoções;
- adicionar ação de UI **"Ordenar pela lista atual"** na tela de promoção;
- apresentar preview “antes/depois” e texto de origem da ordem.

### Lote B — Validações e telemetria
- bloquear publicação se houver pendências críticas (ex.: militar selecionado sem posição na lista-base, quando regra não é 3º Sgt por formação);
- log de auditoria da operação de ordenação (totais + lista-base usada).

### Lote C — Cobertura de testes
- unitários da função pura (ordenação estável, faltantes, bypass 3º Sgt);
- integração no fluxo de publicação validando propagação para `antiguidade_referencia_ordem`.

## Riscos e mitigação
- **Risco:** militar selecionado não aparece na lista-base (inconsistência cadastral/histórico).
  - **Mitigação:** exibir pendência explícita e impedir publicar até resolver (exceto cenário de formação 3º Sgt).
- **Risco:** quadro ambíguo/normalização divergente.
  - **Mitigação:** reutilizar normalizações já aplicadas na prévia e no domínio de posto/quadro.
- **Risco:** regressão no motor de antiguidade.
  - **Mitigação:** não alterar `calcularPreviaAntiguidadeGeral`; apenas consumir saída.

## Conclusão objetiva
1. **O motor atual consegue gerar a lista necessária** para ordenar promovidos por antiguidade vigente.
2. A melhor abordagem é uma **função pura de ordenação por ranking prévio**, sem tocar no motor.
3. A gravação em `HistoricoPromocaoMilitarV2.antiguidade_referencia_ordem` já está compatível com o desenho proposto.
4. A proposta é superior à lógica baseada em histórico individual porque centraliza a referência na lista oficial imediatamente anterior, reproduzindo o fluxo manual de bloco.
