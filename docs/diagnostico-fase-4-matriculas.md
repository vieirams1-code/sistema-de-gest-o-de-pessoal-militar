# Diagnóstico Fase 4 — Cobertura transversal de matrículas

## Escopo desta entrega
Ajustes cirúrgicos fora do módulo principal de Militar para reduzir dependência de `militar.matricula` em fluxos operacionais e administrativos de maior impacto.

## Inventário residual (recorte priorizado)

### Críticos operacionais
- `src/pages/LotacaoMilitares.jsx`
  - Busca por matrícula e exibição em lista operacional ainda dependiam diretamente de `militar.matricula`.
  - Fluxo não aplicava filtro explícito de militares MESCLADO via camada transversal.

### Administrativos relevantes
- `src/pages/RegistrosMilitar.jsx`
  - Selector/filtro de militar por matrícula sem reaproveitar busca por histórico de matrícula.
  - Contexto administrativo não sinalizava explicitamente militar MESCLADO quando selecionado.
- `src/services/registrosMilitarService.js`
  - Vinculação de registro↔militar por matrícula não considerava `matriculas_historico`.

### Compatibilidade legada residual (mantida)
- Fallback por `registro.matricula_legado` e `militar.militar_matricula` em `vinculaRegistroAoMilitar`.
- Campo legado `militar.matricula` preservado sem remoção.

### Baixo impacto / candidato futuro
- Telas de migração e templates textuais que apenas exibem campos legados sem efeito operacional direto.

## O que foi ajustado
- `LotacaoMilitares` passou a:
  - enriquecer militares com matrícula atual derivada de `MatriculaMilitar`;
  - filtrar fluxo operacional com `filtrarMilitaresOperacionais` (oculta MESCLADO);
  - buscar por nome/matrícula atual e histórica via `militarCorrespondeBusca`.
- `RegistrosMilitar` passou a:
  - enriquecer lista de militares com a mesma camada transversal;
  - buscar no selector por matrícula histórica;
  - sinalizar militar MESCLADO no selector e com aviso de contexto administrativo.
- `vinculaRegistroAoMilitar` passou a:
  - comparar matrícula de registro com conjunto de matrículas do militar (atual + históricas);
  - manter fallback legado estritamente necessário.

## Compatibilidade mantida conscientemente
- Não houve remoção de `militar.matricula`.
- Fallback legado preservado para dados antigos não migrados integralmente.

## Próximos candidatos (fase posterior)
1. Padronizar selectors de módulos auxiliares (permissões, férias, atestados) para usar a mesma camada de matrícula derivada.
2. Consolidar avisos de MESCLADO em componentes reutilizáveis de seleção de militar.
3. Expandir cobertura automatizada para páginas com busca por matrícula fora dos fluxos críticos.
