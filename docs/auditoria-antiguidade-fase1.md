# Auditoria funcional e técnica — Antiguidade Militar (fase 1)

Data da auditoria: 30/03/2026.

## Escopo avaliado

- `src/utils/antiguidadeMilitar.js`
- `src/pages/LotacaoMilitares.jsx`
- `src/pages/CadastrarMilitar.jsx`
- `entities/HistoricoPromocaoMilitar.json`
- `docs/antiguidade-militar.md`

## 1) A função de comparação está fiel aos 4 critérios?

**Parcialmente fiel.**

### Pontos corretos

A função `compareAntiguidadeMilitar` aplica os critérios na sequência certa:

1. posto/graduação;
2. quadro;
3. data de promoção no posto atual;
4. antiguidade herdada;

com desempate final por nome (`nome_completo`) para garantir ordenação estável para UI.

### Desvios encontrados

1. **Mapa de quadro não compatível com os valores atuais do cadastro**
   - Prioridades da função: `QOEM`, `QOBM`, `QOCBM`, `QOABM`, `QPEBM`, `QPBM`.
   - Opções de cadastro atuais: `QOBM`, `QAOBM`, `QOEBM`, `QOSAU`, `QBMP-1.a`, `QBMP-1.b`, `QBMP-2`, `QBMPT`.
   - Resultado: quase todos os quadros atuais recebem fallback e não participam do critério 2 como esperado.

2. **Campo legado alternativo da data não é considerado**
   - O comparador usa `data_promocao_atual`.
   - O banco pode ter histórico com `data_promocao` ou outros aliases em implantação gradual; hoje não há fallback para isso.

3. **Antiguidade herdada aceita múltiplos aliases, mas sem validação semântica**
   - Bom para compatibilidade (`antiguidade_referencia_ordem`, `antiguidade_herdada_ordem`, etc.),
   - porém não diferencia `0` válido de default técnico (dependendo da origem).

## 2) Há risco de empate mal resolvido?

**Sim, em cenários específicos.**

1. **Empate artificial por quadro**: como vários quadros não estão no mapa de prioridade, o critério 2 perde efeito e aumenta empates.
2. **Empate por dados incompletos**: ausência de `data_promocao_atual` e `antiguidade_referencia_ordem` empurra registros para o fim com o mesmo peso de fallback.
3. **Desempate final por nome**: resolve estabilidade visual, mas pode mascarar ausência de dado funcional de antiguidade.

## 3) Integração em `LotacaoMilitares.jsx` está correta?

**Sim, para a fase 1.**

- A lista de militares ativos é filtrada e depois ordenada por `ordenarMilitaresPorAntiguidade`.
- A ordenação está encapsulada e aplicada de forma determinística via `useMemo`.
- Não há mutação in-place do array original (usa cópia no utilitário).

**Observação:** a integração de tela está boa; os riscos observados vêm da qualidade/compatibilidade dos dados e do mapa de prioridade do utilitário.

## 4) Campos novos em `CadastrarMilitar.jsx` são suficientes para a fase atual?

**Ainda não.**

### Situação atual

- Campos existem no estado inicial (`data_promocao_atual`, `antiguidade_referencia_ordem`, `antiguidade_referencia_id`),
- mas **não estão expostos no formulário**.

### Impacto

- O cadastro padrão não coleta os campos necessários para os critérios 3 e 4.
- A ordenação acaba dependendo de dados já existentes na base/importação/manual API.

### Veredito fase 1

- Como preparação técnica, está parcialmente pronta.
- Como operação assistida por UI, está incompleta.

## 5) `HistoricoPromocaoMilitar` deve permanecer apenas preparado, sem uso ainda?

**Sim, com duas ressalvas.**

- A entidade está coerente como preparação da fase seguinte.
- Na fase atual, não é obrigatório ativar gravação para a ordenação funcionar.

**Ressalvas para evitar retrabalho na fase 2:**
1. alinhar nomenclatura de campos com o utilitário atual (`antiguidade_referencia_ordem` vs `antiguidade_herdada_ordem`);
2. definir desde já regra de origem da ordem herdada para promoções na mesma data.

## 6) Ajustes pequenos recomendados antes de evoluir

1. **Ajustar imediatamente o mapa de prioridade de quadro** no utilitário para refletir os quadros usados no cadastro atual.
2. **Adicionar os 3 campos no formulário de cadastro** (pelo menos em seção “Antiguidade Militar”):
   - data da promoção no posto atual;
   - ordem herdada;
   - referência/origem da ordem.
3. **Validação mínima de preenchimento condicional**:
   - se houver `posto_graduacao`, exigir `data_promocao_atual`;
   - se data coincidir em lote, exigir `antiguidade_referencia_ordem`.
4. **Sinalização visual de dado faltante** na listagem de lotação (badge ou tooltip) para evitar interpretação incorreta da ordem.
5. **Teste unitário do comparador** com cenários de empate (mesmo posto/quadro/data e diferenças só na herdada).
6. **Padronizar aliases em um único campo canônico** durante fase 1.5 (manter leitura de aliases, mas gravar sempre no padrão).

## Conclusão sobre prontidão para a próxima fase

A implantação está **boa como base técnica inicial**, com integração funcional correta na tela de lotação, mas **ainda não está madura para depender 100% da UI** por falta de coleta explícita dos campos críticos e por desalinhamento de prioridade de quadro.

**Prontidão sugerida:**
- **Pronta com ressalvas** para iniciar modelagem da fase de histórico de promoções,
- **não pronta** para considerar a antiguidade plenamente confiável sem os ajustes pequenos acima.
