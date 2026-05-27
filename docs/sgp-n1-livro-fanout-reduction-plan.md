# [SGP-N1-LIVRO] Plan livro fan-out reduction

## Objetivo
Reduzir fan-out de consultas no Livro, eliminando o padrão N+1 de `RegistroLivro.filter({ militar_id })` por militar no frontend e centralizando a leitura por escopo/lote no backend.

## Diagnóstico atual (resumo)
- Existem pontos no frontend que fazem `Promise.all(militarIds.map(id => RegistroLivro.filter({ militar_id: id })))`, aumentando latência e risco de timeout.
- Já existe infraestrutura backend que busca `RegistroLivro` por lotes de `militar_id` via funções escopadas (bundle), indicando caminho de migração com baixo risco de arquitetura.

## Menor lote (MVP de redução)
1. **Livro service (principal)**
   - Trocar estratégia N+1 no `src/components/livro/livroService.js` por chamada única escopada (bundle) com retorno de registros já filtrados por escopo.
2. **Conciliação Boletim (alto impacto secundário)**
   - Aplicar o mesmo padrão no carregamento de `RegistroLivro` em `src/pages/ConciliacaoBoletim.jsx`.
3. **Guard rails**
   - Manter fallback com comportamento atual por feature-flag simples (`USE_SCOPED_LIVRO_BUNDLE`) para rollback rápido.

## Arquivos candidatos
- `src/components/livro/livroService.js`
- `src/pages/ConciliacaoBoletim.jsx`
- `src/pages/Ferias.jsx` (apenas mensagens/telemetria já citam erro de fan-out; opcional no lote 1)
- `base44/functions/getScopedFeriasBundle/entry.ts` (validar campos necessários de `RegistroLivro`)
- `base44/functions/getScopedPeriodosAquisitivosBundle/entry.ts` (validar consistência de retorno)

## Risco
### Baixo
- Substituição de N+1 por endpoint escopado já existente no ecossistema do projeto.
- Redução de chamadas tende a melhorar timeout e custo de rede.

### Médio
- **Compatibilidade de shape**: frontend pode depender de campos que não estejam no payload do bundle.
- **Ordenação**: garantir mesma semântica (`-created_date` etc.) para não alterar UX.
- **Cache invalidation**: alinhar `queryKey` para evitar inconsistência após CUD.

### Mitigações
- Snapshot comparativo de payload antigo vs novo em ambiente de homologação.
- Teste de regressão focado em filtros e ordenação do Livro.
- Feature-flag com rollback instantâneo.

## Backend?
**Sim, recomendado (mínimo ajuste).**
- Reaproveitar função escopada já existente para retornar `RegistroLivro` por lote (`militar_id IN chunk`) e garantir campos necessários para tela.
- Evitar criar nova função se as atuais já cobrirem escopo e ordenação.
- Se faltar campo, ajustar projeção/campos no backend ao invés de voltar para múltiplos `filter` no frontend.

## Critério de pronto do lote 1
- Zero uso de `RegistroLivro.filter({ militar_id: id })` em loops nos dois pontos prioritários.
- Tempo de carregamento percebido menor em usuários não-admin de grande escopo.
- Sem regressão de contagem, ordenação e filtros básicos na listagem.
