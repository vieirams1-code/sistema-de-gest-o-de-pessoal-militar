# Relatório de Auditoria de Consistência de Regras de Negócio

Este documento detalha a auditoria realizada no sistema para identificar divergências, validações duplicadas e conflitos nas regras de negócio, com foco em normalização de dados e fluxos de carreira.

## 1. Normalização e Validação de Dados

### 1.1. Postos e Graduações (Strings de Referência)
*   **Divergência Crítica:** O sistema utiliza diferentes strings para o mesmo posto, o que pode causar falhas em comparações de igualdade estrita.
    *   `src/services/migracaoMilitaresService.js`: Utiliza **"Tenente Coronel"** (sem hífen).
    *   `src/utils/postoGraduacaoHierarquia.js` e `src/constants/postosGraduacoes.js`: Utilizam **"Tenente-Coronel"** (com hífen).
*   **Risco:** Quebra de lógica em filtros e na exibição da ficha militar se os dados vierem de origens diferentes (migração vs. cadastro manual).

### 1.2. Matrícula
*   **Divergência de Implementação:**
    *   `militarIdentidadeService.js`: A função `normalizarMatricula` apenas extrai dígitos e limita a 9.
    *   `migracaoMilitaresService.js`: A função `formatarMatricula` aplica `padStart(9, '0')`, garantindo que matrículas curtas sejam preenchidas.
*   **Recomendação:** Unificar a lógica de preenchimento com zeros à esquerda para evitar que "123" e "000000123" sejam tratados como diferentes em buscas que não normalizam antes de comparar.

### 1.3. CPF
*   **Divergência de Rigor:**
    *   `militarIdentidadeService.js`: Apenas remove não-dígitos e verifica se possui 11 caracteres. Não valida o dígito verificador (checksum).
    *   `migracaoMilitaresService.js`: Implementa a validação completa do algoritmo de CPF (Dígitos Verificadores).
*   **Conflito:** O cadastro manual permite CPFs matematicamente inválidos, enquanto o módulo de migração os bloqueia.

### 1.4. Nomes (Canonização)
*   **Redundância/Divergência:**
    *   `militarIdentidadeService.js`: `normalizarNomeCanonico` remove acentos, espaços extras e coloca em maiúsculas.
    *   `migracaoMilitaresService.js`: Possui lógica própria de limpeza que não remove acentos em alguns pontos, podendo falhar na detecção de duplicidades por nome.

---

## 2. Regras de Carreira e Promoção

### 2.1. Promoção Subtenente -> 2º Tenente QAOBM
*   **Validação Duplicada:** A regra que identifica esta promoção específica está definida em `src/utils/promocao/elegibilidadePromocao.js` e consumida em `src/utils/postoGraduacaoHierarquia.js`.
*   **Observação:** Embora duplicada no consumo, a lógica está centralizada em uma função utilitária, o que mitiga o risco de divergência.

### 2.2. Hierarquia de Postos
*   **Consistência Positiva:** A lista `POSTOS_GRADUACOES_HIERARQUIA` em `src/constants/postosGraduacoes.js` é a fonte da verdade para a ordem de precedência, utilizada corretamente pelo `promocaoService.js` e `postoGraduacaoHierarquia.js`.
*   **Divergência Técnica:** O arquivo `promocaoService.js` redefine a ordem hierárquica localmente (`POSTOS_GRADUACOES_PROMOCAO`) invertendo a constante global. Embora funcionalmente correto, cria uma dependência de ordenação que pode falhar se a constante global for alterada sem revisão.

### 2.3. Identificação de Promoções de Formação
*   **Inconsistência de Implementação:**
    *   `promocaoService.js` possui `isPromocaoFormacaoTerceiroSargento` com regex/busca manual por strings.
    *   `postoGraduacaoHierarquia.js` possui `postoGraduacaoBaseAnterior` que retorna string vazia para o mesmo caso (3º Sargento).
*   **Risco:** Lógicas de "Início de Carreira" estão espalhadas em vez de usar um predicado centralizado (Ex: `isPostoInicial(posto)`).

### 2.4. Sensibilidade a Maiúsculas/Minúsculas (Casing)
*   **Divergência Crítica:**
    *   `calcularComportamento.js`: A função `isPraca` utiliza um Set com strings em *Title Case* (`'Soldado'`) e faz busca direta (`.has(postoGraduacao)`). Se o posto for passado em maiúsculas (ex: `"SOLDADO"`), o cálculo falha retornando `null`.
    *   `postoQuadroCompatibilidade.js`: Define constantes em *UPPERCASE* (`"SOLDADO"`) e normaliza as entradas para maiúsculas antes de comparar.
*   **Risco:** Falha silenciosa no cálculo de comportamento se o serviço chamador não garantir a normalização exata esperada pelo utilitário.

---

## 3. Comportamento Disciplinar

### 3.1. Cálculo de Comportamento
*   **Consistência Positiva:** A lógica complexa baseada nos Artigos 52 e 53 está centralizada em `src/utils/calcularComportamento.js`.
*   **Validação Duplicada:** Existem verificações de "inconsistência cadastral" (falta de data de inclusão ou posto) tanto em `inconsistenciasCadastrais.js` quanto dentro de `calcularComportamento.js`.
*   **Divergência de Interface:** Algumas funções esperam `dataInclusaoMilitar` (camelCase) e outras `data_inclusao` (snake_case) para o mesmo dado.

### 3.2. Permissões de Comportamento
*   **Divergência de Objeto de Sessão:** Em `comportamentoService.js`, a função `temPermissaoAprovarMudanca` precisa verificar 4 campos diferentes para permissões (`permissions`, `permissoes`, `permission_matrix`, `matriz_permissoes`).
*   **Risco:** Falta de padronização no contrato do objeto de usuário/sessão vindo da API ou do contexto React.

---

## 4. Gerenciamento de Status e Estados

### 4.1. Divergência de Nomenclatura de Status
*   **Militar:** Utiliza `status_cadastro` (Ativo/Inativo) e `situacao_militar`.
*   **Promoção:** Utiliza `status` (Rascunho/Publicada) e os itens de promoção utilizam `status` (Elegível/Publicado).
*   **Histórico de Comportamento:** Utiliza `status_registro` (Ativo/Cancelado).
*   **Punição:** Utiliza `status_punicao` ou `status` (Ativa/Anulada/Reabilitada).
*   **Risco:** Confusão mental para desenvolvedores e dificuldade em criar queries genéricas de "registros válidos".

### 4.2. Identificação de Marcos Históricos
*   **Implementação Frágil:** `justicaDisciplinaService.js` utiliza buscas por substrings como `"IMPLANT"` ou `"REGISTRO INICIAL"` em campos de texto para identificar marcos de implantação.
*   **Risco:** Mudanças na tradução ou edição manual desses campos podem quebrar a lógica de sanitização do histórico.

---

## 5. Integridade de Testes

### 5.1. Sincronia entre Testes e Código
*   **Divergência de Exportação:** `src/services/__tests__/militarIdentidadeService.test.js` tenta importar `migrarMatriculasLegadas` de `militarIdentidadeService.js`, mas esta função não é mais exportada (ou foi renomeada/removida), causando falha catastrófica na suíte de testes.
*   **Risco:** Testes quebrados mascaram regressões reais e diminuem a confiança na CI/CD.

---

## 6. Conclusões e Próximos Passos
1.  **Unificar Strings de Postos:** Padronizar o uso de hífen em "Tenente-Coronel" em todo o sistema, especialmente no `migracaoMilitaresService.js`.
2.  **Centralizar Validação de CPF:** Mover o algoritmo de checksum para um utilitário compartilhado e usá-lo no `militarIdentidadeService.js` para garantir paridade entre cadastro manual e migração.
3.  **Padronizar Matrícula:** Garantir que a normalização sempre inclua o `padStart(9, '0')` em todos os serviços de identidade e migração.
4.  **Normalização de Entrada em Utilitários:** Revisar `calcularComportamento.js` e outros utils para que normalizem strings de entrada (trim/upper) antes de comparar com listas fixas, evitando falhas por diferenças de caixa.
5.  **Refatorar Predicados de Carreira:** Unificar as funções que identificam postos iniciais ou praças em um único utilitário de domínio (`militarPostoGraduacao.js`) para evitar que cada serviço implemente seu próprio regex ou mapeamento.
