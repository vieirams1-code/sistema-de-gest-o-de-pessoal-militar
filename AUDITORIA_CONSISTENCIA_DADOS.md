# Relatório de Auditoria de Consistência de Dados - SGP Militar

## 1. Dados Derivados Armazenados (Desincronização)

### Caso: Posto/Graduação, Quadro e Comportamento no cadastro do Militar
- **Origem do Problema:** Os campos `posto_graduacao`, `quadro` e `comportamento` na entidade `Militar` são dados derivados de históricos (`HistoricoPromocaoMilitarV2` e `HistoricoComportamento` + `PunicaoDisciplinar`).
- **Impacto:** Exige lógica de sincronização manual complexa (`sincronizarHistoricoPromocaoPublicada`, `executarEfetivacaoMudancaComportamento`) que pode falhar em casos de atualizações em lote ou erros parciais.
- **Risco:** Militar com posto ou comportamento no cadastro diferente do seu histórico oficial, gerando erros em folhas de pagamento, escalas de serviço ou critérios de antiguidade.
- **Sugestão Conceitual:** Transformar esses campos em propriedades calculadas (Getters) no backend ou garantir que a atualização seja transacional (atômica) no nível da entidade de histórico.

## 2. Fontes Duplas de Verdade

### Caso: Matrícula (Militar vs MatriculaMilitar)
- **Origem do Problema:** A matrícula existe como campo direto em `Militar.matricula` e como uma tabela relacionada `MatriculaMilitar`.
- **Impacto:** Risco de o campo "cacheado" no Militar não refletir a matrícula ativa na tabela de matrículas, especialmente após processos de merge ou retificação.
- **Risco:** Divergência na identificação primária do militar entre diferentes módulos do sistema.
- **Sugestão Conceitual:** Centralizar a leitura na `MatriculaMilitar` (sempre buscando a `is_atual: true`) e tornar `Militar.matricula` um campo de leitura apenas para performance (read-only cache), atualizado via triggers de banco ou hooks de entidade.

### Caso: Registro em Livro vs Publicações Ex Officio
- **Origem do Problema:** Duas entidades separadas para registrar eventos funcionais que possuem estruturas quase idênticas.
- **Impacto:** Fragmentação da informação; serviços de Linha do Tempo e Documentos precisam unificar os dados via código (`militarTimelineService.js` e `militarDocumentosService.js`).
- **Risco:** Implementações parciais (ex: um filtro que busca em RegistroLivro mas esquece PublicacaoExOfficio).
- **Sugestão Conceitual:** Unificar em uma única entidade `EventoMilitar` com um campo `subtipo` ou `origem`.

## 3. Dados Duplicados e Snapshots "Congelados"

### Caso: Snapshots em Gratificações de Função
- **Origem do Problema:** A entidade `GratificacaoFuncao` armazena snapshots de nome, matrícula e unidade (`nome_completo_snapshot`, `matricula_snapshot`, etc.).
- **Impacto:** Se um militar casar e mudar de nome, ou retificar sua matrícula, as gratificações ativas continuarão exibindo os dados antigos.
- **Risco:** Relatórios financeiros ou de auditoria com dados de identidade divergentes para o mesmo militar.
- **Sugestão Conceitual:** Armazenar apenas o `militar_id` e buscar os dados de identidade em tempo real, ou implementar um processo de "refresh snapshots" quando o cadastro do militar sofrer alterações críticas.

## 4. Campos Inconsistentes (Temporalidade)

### Caso: Variabilidade de campos de data (Atestados e Férias)
- **Origem do Problema:** Uso inconsistente de nomes de campos para o mesmo conceito: `data_inicio`/`data_atestado`, `data_retorno`/`data_termino`/`data_fim`.
- **Impacto:** Lógica defensiva exaustiva no `statusOperacionalService.js` para tentar "adivinhar" qual campo usar.
- **Risco:** Falha na determinação do Quadro Operacional (Militar aparecer como Disponível quando deveria estar Afastado) devido a um campo nulo que não foi mapeado corretamente.
- **Sugestão Conceitual:** Padronizar os nomes dos campos no banco de dados para `data_inicio` e `data_fim` em todas as entidades temporais.

## 5. Processos Suscetíveis a Divergência

### Caso: Agregação Manual de Linha do Tempo e Documentos
- **Origem do Problema:** `militarTimelineService.js` e `militarDocumentosService.js` implementam lógicas de agregação, filtragem e deduplicação muito similares mas independentes.
- **Impacto:** Inconsistência visual. Um documento pode aparecer na aba "Documentos" mas não na "Linha do Tempo" devido a diferenças sutis na lógica de filtragem de datas nulas ou tipos.
- **Risco:** Manutenção duplicada e divergência de regras de negócio entre visões da Ficha 360º.
- **Sugestão Conceitual:** Criar um serviço de infraestrutura `MilitarEventAggregator` que forneça uma lista unificada de eventos para ambos os serviços.

## 6. Atualizações Manuais Evitáveis

### Caso: Sincronização de Promoção Divergente
- **Origem do Problema:** O serviço `saneamentoPromocaoMilitarDivergenteService.js` existe especificamente para corrigir divergências entre o Histórico V2 e o cadastro do Militar.
- **Impacto:** Demonstra que o sistema permite (ou permitiu no passado) que os dados fiquem inconsistentes.
- **Risco:** Confiança reduzida na integridade dos dados por parte dos usuários.
- **Sugestão Conceitual:** Eliminar a redundância conforme sugerido no item 1, eliminando a necessidade de "saneamento" manual.
