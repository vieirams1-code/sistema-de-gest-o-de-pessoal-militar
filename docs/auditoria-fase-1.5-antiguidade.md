# Auditoria final — Fase 1.5 de Antiguidade Militar

Data da auditoria: 2026-03-30

## Escopo revisado
- `src/utils/antiguidadeMilitar.js`
- `src/pages/LotacaoMilitares.jsx`
- `src/pages/CadastrarMilitar.jsx`
- `entities/HistoricoPromocaoMilitar.json`

## Achados principais

### Coerência geral
- Os 4 critérios da fase 1.5 estão implementados no comparador (`posto_graduacao`, `quadro`, `data_promocao_atual`, `antiguidade_referencia_ordem` + aliases legados).
- A tela de lotação usa o utilitário central de ordenação por antiguidade para a lista de militares.
- O cadastro expõe e persiste os campos necessários para a fase atual.
- A entidade `HistoricoPromocaoMilitar` está preparada para rastreabilidade sem acoplamento ao fluxo atual.

### Riscos residuais identificados
1. **Fallback amplo no 4º critério**
   - O comparador aceita múltiplos aliases (`antiguidade_herdada_ordem`, `antiguidade_posto_anterior`, `antiguidade_anterior`) além de `antiguidade_referencia_ordem`.
   - Isso ajuda migração, mas pode mascarar divergências de nomenclatura.

2. **Ordenação da árvore organizacional vs. lista de militares**
   - A árvore de destino (setor/subsetor/unidade) é ordenada por nome na consulta da estrutura.
   - A ordenação por antiguidade é aplicada na lista de militares (coluna direita), não na árvore estrutural.

3. **Empate final por nome completo**
   - Em empate total dos 4 critérios, o desempate é `nome_completo`.
   - Funcional, porém não representa antiguidade administrativa formal (p.ex. matrícula/ID de promoção).

4. **Possível desalinhamento futuro entre campo atual e histórico**
   - Campo atual usa `data_promocao_atual`; histórico usa `data_promocao`.
   - Coerente para fase 1.5, mas precisa mapeamento explícito ao integrar histórico na próxima fase.

## Classificação de prontidão
**Pronta com ressalvas.**

A base está consistente para avançar à próxima etapa (histórico/promoções), desde que os ajustes pequenos listados abaixo sejam tratados antes da integração de fluxo.

## Ajustes pequenos recomendados (sem nova frente)
1. Adicionar validação de `antiguidade_referencia_ordem` como número inteiro positivo (UI + salvamento).
2. Registrar decisão explícita de desempate final (nome/matrícula) para reduzir ambiguidade operacional.
3. Definir contrato de nomenclatura para próxima fase:
   - `data_promocao_atual` (snapshot atual no Militar)
   - `data_promocao` (evento no histórico)
4. Instrumentar alerta de dados quando `posto_graduacao`/`quadro` não estiverem no mapa de prioridade (evitar fallback silencioso).

