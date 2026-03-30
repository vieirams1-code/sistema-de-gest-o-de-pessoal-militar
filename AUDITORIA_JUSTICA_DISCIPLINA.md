# Auditoria funcional e técnica — `justicaDisciplinaService.js`

## Escopo analisado
- `garantirImplantacaoHistoricoComportamento`
- `registrarMarcoHistoricoComportamento`
- utilitários envolvidos no fluxo de leitura e escolha de último marco (`listarHistoricoPorMilitar`, `sanitizarHistoricoComportamento`, `normalizarDataVigencia`, `getMomentoRegistro`)

## Achados principais

1. A leitura de histórico, no estado atual do arquivo, é feita via `listarHistoricoPorMilitar` com `filter` por militar e fallback com `list(sort, 200)`.
2. Não existe no arquivo a constante `HISTORICO_COMPORTAMENTO_FETCH_LIMIT = 500`.
3. A ordenação usada no fluxo auditado é por `data_alteracao` (não `data_vigencia`) e sem prefixo explícito `-` nas chamadas de leitura de `garantirImplantacaoHistoricoComportamento` e `registrarMarcoHistoricoComportamento`.
4. O `ultimoMarco` em `registrarMarcoHistoricoComportamento` depende de `sanitizarHistoricoComportamento(..., { ordem: 'desc' })`, que ordena por data e desempata por `created_date/updated_date` quando existem.

## Conclusão técnica resumida
A mitigação de paginação mencionada no pedido **não está plenamente materializada neste arquivo**. Há melhora parcial por sanitização/ordenação em memória, porém ainda existe risco residual de leitura incompleta em cenários com histórico muito volumoso e/ou quando `filter` da API também pagina silenciosamente.
