# RELATÓRIO DE AUDITORIA TÉCNICA — FLUXO DOEMS / PUBLICAÇÃO EXTERNA

**PROJETO:** SGP Militar / Base44
**MODO:** DISCUSSÃO / AUDITORIA
**OBJETIVO:** Avaliar a viabilidade de internalizar publicações do DOEMS utilizando a infraestrutura atual.

---

### 1. DIAGNÓSTICO TÉCNICO
O SGP Militar possui uma infraestrutura robusta para registros de alterações militares, dividida em dois motores principais: **Registro em Livro (RP)** para eventos operacionais e **Publicação Ex Officio** para eventos administrativos.

A arquitetura atual é centrada no Boletim Geral (BG) interno, mas a entidade `PublicacaoExOfficio` é arquiteturalmente flexível. O diagnóstico indica que o sistema **já possui a maior parte da lógica necessária** para suportar DOEMS, bastando ajustes de interface (labels) e a adição de metadados específicos de edição, sem a necessidade de novas entidades de banco de dados.

---

### 2. RESPOSTAS AOS QUESTIONAMENTOS OBJETIVOS (15 QUESTÕES)

1.  **Existe fluxo atual para cadastrar publicação externa ou Ex Officio?**
    Sim. O fluxo de **Publicação Ex Officio** via `CadastrarRegistroRP.jsx` é o caminho padrão para alterações administrativas.
2.  **Esse fluxo já pode representar uma publicação do DOEMS sem nova entity?**
    Sim. A entidade `PublicacaoExOfficio` pode ser utilizada para DOEMS, tratando-a como uma variação de registro administrativo de origem externa.
3.  **A entidade atual possui campos equivalentes para número/edição do DOEMS e data da publicação?**
    Parcial. Possui `numero_bg` e `data_bg` (reaproveitáveis como Número e Data da Publicação). **Não possui** campo explícito para "Edição" na entidade de publicação, embora este conceito exista em outros módulos (como Gratificações).
4.  **O sistema exige link/anexo em algum ponto? Se sim, identificar onde e se pode ser opcional.**
    Não. O fluxo de RP/Ex Officio é estritamente textual e metadados; o anexo não é requisito para salvamento.
5.  **O cadastro permite inserir o texto publicado?**
    Sim, no campo `texto_publicacao`.
6.  **O cadastro permite vincular um ou mais militares?**
    A interface atual (`CadastrarRegistroRP.jsx`) permite vincular **apenas um militar** por registro de RP.
7.  **O cadastro permite classificar o tipo da alteração?**
    Sim, através do campo `tipo_registro` (ex: Elogio, Punição, Geral).
8.  **A publicação vinculada aparece na ficha do militar?**
    Sim, é integrada automaticamente pelo `militarDocumentosService.js`.
9.  **A publicação vinculada aparece na linha do tempo / alterações do militar?**
    Sim, via `militarTimelineService.js` (Categoria: Registro).
10. **A publicação vinculada aparece em documentos do militar, se aplicável?**
    Sim, consta na visão unificada de documentos do perfil.
11. **Há diferença clara na interface entre BG interno, Registro em Livro, Publicação Ex Officio e DOEMS?**
    Não para DOEMS. Atualmente, o sistema não distingue DOEMS de um BG interno na interface de cadastro; ambos seriam inseridos como "Ex Officio" com labels de "BG".
12. **Há matcher ou mecanismo de conciliação que poderia ser reaproveitado para localizar militar no texto publicado?**
    Sim. O `registrosMilitarMatcher.js` realiza o vínculo por nome/matrícula e a lógica de tokens do `ConciliacaoBoletim.jsx` pode ser adaptada para extração de dados de PDFs do DOEMS.
13. **Existem ações que alteram diretamente a entidade Militar a partir da publicação?**
    Sim. Alterações de Comportamento registradas via RP/Ex Officio disparam atualizações em campos calculados da entidade `Militar`.
14. **Quais lacunas impedem o uso seguro para DOEMS hoje?**
    Labels de interface fixos ("BG", "Nota"), ausência de campo "Edição" e falta de suporte para vínculo em lote (múltiplos militares por texto).
15. **Qual seria o menor ajuste possível para viabilizar esse fluxo?**
    Adicionar o tipo "Publicação Externa (DOEMS)" em `rpTiposConfig.js` e tornar os labels de "BG" dinâmicos no formulário de cadastro.

---

### 3. FLUXO ATUAL EXISTENTE
1.  **Entrada:** `CadastrarRegistroRP.jsx` (Wizard de 4 passos).
2.  **Lógica:** `publicacaoStateMachine.js` define o status (Aguardando Nota -> Aguardando Publicação -> Publicado).
3.  **Persistência:** Entidade `PublicacaoExOfficio`.
4.  **Integração:** Os serviços `militarTimelineService` e `militarDocumentosService` consomem o registro para exibição no perfil 360.

---

### 4. LACUNAS PARA USO COM DOEMS
*   **Identificação de Origem:** Não há campo para diferenciar se a publicação é interna (BG) ou externa (DOEMS).
*   **Edição do Diário:** Falta o campo de metadado `edicao`.
*   **UX de Cadastro:** O formulário Step 4 é confuso para DOEMS pois exige "Nota para BG", campo irrelevante para publicações externas.

---

### 5. ARQUIVOS AFETADOS EM FUTURA IMPLEMENTAÇÃO
*   `src/components/rp/rpTiposConfig.js` (Novos tipos e labels)
*   `src/pages/CadastrarRegistroRP.jsx` (Lógica de exibição de campos)
*   `src/components/rp/RPSpecificFieldsExOfficio.jsx` (Novos campos de metadados)
*   `src/components/publicacao/publicacaoStateMachine.js` (Ajuste na regra de status para ignorar "Nota" em DOEMS)

---

### 6. ENTITIES E SERVICES ENVOLVIDOS
*   **Entities:** `PublicacaoExOfficio`, `Militar`.
*   **Services:** `publicacoesPainelService.js`, `militarTimelineService.js`, `registrosMilitarMatcher.js`.

---

### 7. RISCOS
*   **Ambiguidade nos Dados:** Sem um campo "Origem", as publicações DOEMS e BG ficarão misturadas no banco, dificultando auditorias futuras.
*   **Esforço Manual:** A falta de suporte para múltiplos militares por publicação exigirá cadastros repetitivos para atos coletivos do DOEMS.

---

### 8. REAPROVEITAMENTO POSSÍVEL
*   Motor de **Templates** (`templateUtils.js`) para geração do texto da alteração.
*   **Dashboard de Publicações** (`Publicacoes.jsx`) para controle de fluxo.
*   **Matcher** (`registrosMilitarMatcher.js`) para conferência automatizada.

---

### 9. SUGESTÃO DE LOTES (ROADMAP)
1.  **LOTE 1.1 — Semântica:** Adicionar tipo DOEMS e labels dinâmicos.
2.  **LOTE 1.2 — Metadados:** Adicionar campo `edicao` na entidade e UI.
3.  **LOTE 1.3 — Automação:** Adaptar `ConciliacaoBoletim` para leitura de Diários Oficiais e vínculo assistido.
