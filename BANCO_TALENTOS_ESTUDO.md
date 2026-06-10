# Estudo: Implementação do Banco de Talentos (Zero Novas Entidades)

Este documento detalha a estratégia técnica para implementar um **Banco de Talentos** robusto dentro do ecossistema ERP Militar atual, utilizando exclusivamente as entidades e serviços já existentes.

## 1. Mapeamento de Atributos x Entidades Atuais

Para evitar a criação de novas tabelas, utilizaremos a flexibilidade do sistema de **Tags** e **Funções** já implementado.

| Atributo de Talento | Entidade de Origem | Estratégia de Implementação |
| :--- | :--- | :--- |
| **Posto/Graduação** | `Militar` | Campo nativo `posto_graduacao`. |
| **Quadro** | `Militar` | Campo nativo `quadro`. |
| **Lotação** | `Militar` | Campo nativo `lotacao`. |
| **Funções** | `FuncaoMilitar` / `MilitarFuncao` | Utilizar o catálogo de funções institucionais e o vínculo de histórico de funções. |
| **Cursos** | `TagGrupo` / `Tag` / `MilitarTag` | Criar um `TagGrupo` chamado **"Cursos e Capacitações"**. Cada curso será uma `Tag` vinculada a este grupo. |
| **Habilidades** | `TagGrupo` / `Tag` / `MilitarTag` | Criar um `TagGrupo` chamado **"Habilidades Técnicas"** (ex: Idiomas, Programação, Pilotagem). |

## 2. Estrutura do Sistema de Tags como Motor de Busca

O sistema de `MilitarTag` é o componente mais versátil para o Banco de Talentos.

### Configuração Sugerida:
1.  **Agrupamento**: Categorizar talentos via `TagGrupo`.
    -   Ex: Grupo ID `cat-cursos` -> Nome: "Cursos"
    -   Ex: Grupo ID `cat-habilidades` -> Nome: "Habilidades"
2.  **Padronização**: Criar `Tags` padronizadas para evitar duplicidade (ex: "Curso de Socorrista", "Inglês Fluente").
3.  **Atribuição**: Utilizar a entidade `MilitarTag` para vincular o talento ao militar, permitindo inclusive o uso do campo `motivo` ou `data` para registrar quando o curso foi concluído.

## 3. Arquitetura de Busca e Visualização

### Busca Avançada
A tela `Militares.jsx` já possui suporte para filtros de tags e funções. O "Banco de Talentos" pode ser implementado como uma **Visão Salva** ou um conjunto de filtros pré-configurados nesta tela:
-   **Filtro por Tag**: Selecionar "Curso de Ações Táticas" + "Habilidade: Mergulho".
-   **Filtro por Função**: Selecionar militares que já exerceram a função "Comandante de Pelotão".

### Enriquecimento de Dados
O serviço `src/utils/funcoesTags/enriquecimentoMilitarFuncoesTags.js` deve ser utilizado para processar os dados em lote. Ele já consolida:
-   `funcao_principal`
-   `tags` (concatenadas para busca textual)
-   `grupos_tags` (facilita filtrar apenas por "Cursos")

## 4. Vantagens desta Abordagem

1.  **Impacto Zero no Esquema**: Não requer migrações de banco de dados ou atualizações de SDK.
2.  **Reuso de UI**: Aproveita os componentes de `MilitarTagsBulkPanel` para atribuição em massa de talentos.
3.  **Performance**: Utiliza os mecanismos de cache já implementados para o catálogo de Tags.
4.  **Consistência**: Mantém a "Ficha 360º" como fonte única de verdade, apenas adicionando camadas de metadados via Tags.

## 5. Próximos Passos (Sugestão de UX)

-   Criar uma aba específica na `FichaMilitar` chamada "Talentos", que apenas filtra a visualização de `Tags` para os grupos de "Cursos" e "Habilidades".
-   Implementar um atalho de "Busca por Especialidades" na Home que redireciona para a lista de militares com os filtros de Tags ativos.
