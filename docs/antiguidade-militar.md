# Antiguidade militar no SGP Militar

## Regra de ordenação implementada
A comparação de antiguidade deve seguir a ordem abaixo:

1. `posto_graduacao`
2. `quadro`
3. `data_promocao_atual`
4. `antiguidade_referencia_ordem` (antiguidade herdada do posto anterior)

Comportamento garantido:
- Promoção em data anterior no posto atual torna o militar mais antigo no novo posto.
- Promoções na mesma data preservam a ordem herdada do posto anterior via `antiguidade_referencia_ordem`.

## Estrutura mínima proposta no Militar
Campos mínimos para cálculo de antiguidade atual:

- `posto_graduacao: string`
- `quadro: string`
- `data_promocao_atual: date`
- `antiguidade_referencia_ordem: number`
- `antiguidade_referencia_id: string`

## Entidade de evolução futura
Entidade proposta: `HistoricoPromocaoMilitar`.

Finalidade:
- registrar cada promoção;
- manter rastro da antiguidade herdada;
- viabilizar recomputação auditável da antiguidade ao longo do tempo.
