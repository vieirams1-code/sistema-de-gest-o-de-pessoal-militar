# Matriz de Pendências Administrativas Detectáveis - SGP Militar

Esta matriz consolida as situações de irregularidade ou pendência administrativa que o sistema já possui lógica para detectar, seja através de serviços de auditoria, serviços de contexto ou na Central de Pendências.

## 1. Saúde e JISO

| Situação | Como Detectar | Entidade | Service | Criticidade | Ação Sugerida |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Atestado sem homologação** | `status_jiso` ou `status` contém "aguardando homologação" | `Atestado` | `useCentralPendencias` / `atestadosService` | **Alta** | Realizar a homologação técnica/médica do registro. |
| **JISO pendente** | `status_jiso` contém "aguardando jiso" ou "em análise" | `Atestado` / `JISO` | `useCentralPendencias` / `statusOperacionalService` | **Alta** | Agendar ou realizar o comparecimento à Junta de Inspeção de Saúde. |
| **Atestado vencido sem encerrar** | Data de retorno < hoje e status não é "encerrado" ou "cancelado" | `Atestado` | `useCentralPendencias` | **Média** | Verificar se o militar retornou ou se há novo atestado a ser lançado. |
| **Retorno de atestado próximo** | Data de retorno entre hoje e hoje + 7 dias | `Atestado` | `useCentralPendencias` | **Baixa** | Monitorar o retorno previsto do militar às atividades. |

## 2. Férias

| Situação | Como Detectar | Entidade | Service | Criticidade | Ação Sugerida |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Férias sem retorno** | Status "em curso" mas data de fim já ultrapassada | `Ferias` | `useCentralPendencias` | **Alta** | Lançar o registro de retorno no livro ou encerrar o gozo. |
| **Férias interrompidas sem continuação** | Último evento da cadeia de férias é "interrupção" | `Ferias` / `RegistroLivro` | `useCentralPendencias` | **Média** | Programar a nova saída para gozo do saldo remanescente. |
| **Período próximo ao vencimento** | `dias_saldo > 0` e data limite de gozo < 30 dias | `PeriodoAquisitivo` | `militarFeriasService` / `useCentralPendencias` | **Alta** | Agendar gozo imediato para evitar perda do direito ou prescrição. |
| **Férias prevista sem data** | Status "prevista" ou "autorizada" sem `data_inicio` preenchida | `Ferias` | `useCentralPendencias` | **Baixa** | Definir o cronograma de gozo com o militar. |

## 3. Publicações e Registros

| Situação | Como Detectar | Entidade | Service | Criticidade | Ação Sugerida |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Publicação pendente** | Status contém "aguardando publicação", "aguardando nota" ou "aguardando nota de BG" | `PublicacaoExOfficio` / `Atestado` | `publicacoesPainelService` / `useCentralPendencias` | **Alta** | Vincular o número e data do Boletim Geral (BG). |
| **Publicação inconsistente** | Status "publicado" mas sem `numero_bg` ou `data_bg` | `PublicacaoExOfficio` | `useCentralPendencias` | **Média** | Corrigir o registro informando os dados da publicação oficial. |
| **Registro legado não classificado** | Registros migrados sem mapeamento para tipos canônicos | `PublicacaoLegado` | `migracaoAlteracoesLegadoService` | **Média** | Classificar o registro para que as regras de negócio (ex: comportamento) o processem. |

## 2. Carreira e Promoções

| Situação | Como Detectar | Entidade | Service | Criticidade | Ação Sugerida |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Promoção prevista pronta** | Status "previsto" e `data_promocao` <= hoje | `HistoricoPromocaoMilitarV2` | `useCentralPendencias` | **Média** | Efetivar a promoção na ficha do militar (comando EFETIVAR). |
| **Promoção inconsistente (Publicação)** | Divergência entre dados do item da promoção e histórico V2 (posto, quadro, data) | `PromocaoMilitar` / `HistoricoPromocaoMilitarV2` | `promocaoService` | **Crítica** | Reverter e republicar ou corrigir manualmente o histórico V2. |
| **Promoção sem ordem** | Item selecionado/publicado com `ordem` nula ou zerada | `PromocaoMilitar` | `promocaoService` | **Alta** | Definir a ordem de antiguidade para evitar erros de hierarquia. |
| **Militar incompatível com promoção** | Militar em revisão cadastral ou posto destino inferior ao atual | `Militar` / `Promocao` | `promocaoService` | **Crítica** | Sanear o cadastro do militar antes de processar a promoção. |

## 5. Gratificações

| Situação | Como Detectar | Entidade | Service | Criticidade | Ação Sugerida |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Gratificação sem publicação** | Status "aguardando publicação" ou "solicitado ao DP" | `GratificacaoFuncao` | `gratificacoesFuncaoService` | **Média** | Registrar o ato de nomeação ou DOEMS para ativar o pagamento. |
| **Gratificação em rascunho** | Registro criado mas não enviado para fluxo de ativação | `GratificacaoFuncao` | `gratificacoesFuncaoService` | **Baixa** | Finalizar o preenchimento e solicitar ativação ao DP. |

## 6. Dados Cadastrais e Vínculos

| Situação | Como Detectar | Entidade | Service | Criticidade | Ação Sugerida |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dados obrigatórios ausentes** | Campos críticos nulos (CPF, Matrícula, Data Nasc, Posto, Quadro, Lotação) | `Militar` | `militarAuditoriaService` / `completudeMilitarService` | **Crítica** | Complementar os dados essenciais na ficha do militar. |
| **CPF Inválido** | Erro de dígito verificador no CPF informado | `Militar` | `militarAuditoriaService` | **Alta** | Corrigir o número do CPF. |
| **Matrícula fora do padrão** | Matrícula com tamanho diferente de 9 dígitos | `Militar` | `militarAuditoriaService` | **Alta** | Corrigir a matrícula para o padrão institucional. |
| **Vínculos quebrados (Duplicidade)** | Mesma matrícula/CPF para IDs de sistema diferentes | `Militar` | `militarIdentidadeService` / `useCentralPendencias` | **Crítica** | Unificar os cadastros (Mesclar) ou excluir o registro errôneo. |
| **Sem data de inclusão** | `data_inclusao` nula (impede cálculo de comportamento) | `Militar` | `inconsistenciasCadastrais` | **Alta** | Informar a data de praça/inclusão correta. |

---

### Resumo de Criticidade
- **Crítica**: Bloqueia fluxos essenciais de folha, carreira ou segurança jurídica.
- **Alta**: Exige ação imediata para evitar prejuízo ao militar ou à administração.
- **Média**: Pendência de fluxo normal que deve ser tratada em rotina.
- **Baixa**: Alerta preventivo ou registro incompleto de baixo impacto imediato.
