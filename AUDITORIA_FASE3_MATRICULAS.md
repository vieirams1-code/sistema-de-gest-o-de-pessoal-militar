# Auditoria Fase 3 — Operacionalização de Matrículas

## Pontos do módulo de militares que ainda liam matrícula pelo modelo antigo

Durante a Fase 3, os pontos abaixo foram revisados para deixar de depender apenas de `militar.matricula`:

1. **Listagem principal de militares (`src/pages/Militares.jsx`)**
   - Antes: busca e exibição usavam apenas `militar.matricula`.
   - Agora: usa a matrícula atual derivada de `MatriculaMilitar` e busca também no histórico.

2. **Perfil/visualização de militar (`src/pages/VerMilitar.jsx`)**
   - Antes: mostrava uma única matrícula (campo legado).
   - Agora: mostra matrícula atual + histórico de matrículas com tipo/situação/datas.

3. **Cadastro/edição de militar (`src/pages/CadastrarMilitar.jsx`)**
   - Antes: permitia edição direta do campo matrícula no cadastro.
   - Agora: edição direta é bloqueada em modo edição; inclusão de nova matrícula ocorre por fluxo administrativo explícito usando service dedicado.

4. **Selector/autocomplete operacional do módulo (`src/components/atestado/MilitarSelector.jsx`)**
   - Antes: buscava por `militar.matricula` e listava sem tratar mesclados.
   - Agora: usa matrícula atual/histórico na busca e remove militares mesclados do fluxo operacional comum.

## Compatibilidade legada mantida (estritamente necessária)

- O campo `militar.matricula` continua sendo atualizado para compatibilidade com telas e integrações legadas.
- A fonte de verdade operacional para leitura no módulo revisado passa a priorizar a matrícula atual derivada de `MatriculaMilitar`.
