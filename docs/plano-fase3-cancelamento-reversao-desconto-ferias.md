# Plano técnico — Fase 3: Cancelamento/Reversão de Desconto em Férias

> Escopo deste documento: **planejamento/auditoria apenas**. Não implementar nesta etapa.

## 1. Objetivo

Planejar a Fase 3 do módulo **Descontos em Férias**, cobrindo:

- cancelamento de desconto ainda não publicado;
- reversão de desconto ativo/publicado por publicação de **Tornar Sem Efeito**;
- exibição informativa do desconto no **Rastro da Família**;
- bloqueio absoluto quando houver férias do mesmo período já gozadas/finalizadas;
- pontos de backend, frontend, entidades, riscos e testes obrigatórios.

## 2. Estado atual auditado

### 2.1. Entidades envolvidas

- `DescontoFerias` possui `status` com valores atuais `pendente_publicacao`, `ativo`, `cancelado` e `revertido`, além de `saldo_aplicado` e `publicacao_id` para idempotência/documento vinculado.
- `Ferias` possui `status` operacional com valores atuais `Prevista`, `Autorizada`, `Em Curso`, `Gozada`, `Interrompida` e `Cancelada`.
- `PublicacaoExOfficio` é o documento RP vinculado ao desconto original e deverá também registrar o ato de **Tornar Sem Efeito** na reversão.

### 2.2. Criação e ativação existentes

- A criação do desconto passa pelo gateway `criarDescontoFeriasGateway`, que cria a `PublicacaoExOfficio` do tipo interno `Dispensa com Desconto em Férias` e o `DescontoFerias` com `status=pendente_publicacao` e `saldo_aplicado=false`.
- A ativação atual ocorre em `ativarDescontoFeriasPublicado`, quando a publicação original recebe BG/data; nessa etapa o saldo é abatido e o desconto passa para `ativo` com `saldo_aplicado=true`.
- A tela `DescontosFerias` lista descontos, status, período, dias e status da publicação, mas ainda não possui ações de cancelamento/reversão.

## 3. Regras obrigatórias da Fase 3

### 3.1. Rastro da Família somente informativo

No painel **Rastro da Família**, o `DescontoFerias` deve aparecer apenas como evento informativo/ajuste do período.

Exibição mínima:

- `Desconto em Férias: -X dia(s)`;
- `Status: Ativo/Pendente/Revertido/Cancelado`;
- publicação vinculada, se houver (`Aguardando Nota`, `Aguardando Publicação`, `Publicado`, número/data de BG quando disponível).

Proibição explícita:

- não exibir botão/ação de excluir;
- não exibir botão/ação de cancelar;
- não exibir botão/ação de reverter;
- não reutilizar ações administrativas do `AdminCadeiaPanel` para descontos.

Mensagem curta a exibir no card informativo:

> Reversão disponível apenas em Descontos em Férias.

### 3.2. Bloqueio por férias já gozadas/finalizadas

O sistema não pode cancelar, reverter, publicar Tornar Sem Efeito, restituir saldo nem fazer reversão automática se existir férias/família vinculada ao mesmo `periodo_aquisitivo_id` com status concluído.

Status bloqueantes mínimos:

- `Gozada` — status oficial atual da entidade `Ferias` para gozo concluído;
- `Finalizada` — equivalente operacional futuro/legado;
- `Retornada` — equivalente operacional futuro/legado;
- `Encerrada` — status derivado usado em componentes de cadeia quando o último evento é `Retorno Férias`;
- `Concluída` e `Concluida` — variações já usadas em regras correlatas de créditos extraordinários.

Também deve bloquear quando a família/cadeia tiver evento `RegistroLivro.tipo_registro = "Retorno Férias"` vinculado ao mesmo `ferias_id` ou ao mesmo `periodo_aquisitivo_id`, mesmo que o campo `Ferias.status` esteja inconsistente.

Mensagem obrigatória:

> Não é possível reverter desconto de férias já gozadas/finalizadas.

### 3.3. Desconto com publicação ainda não publicada

Condição:

- `DescontoFerias.status = pendente_publicacao`;
- `saldo_aplicado = false`;
- publicação vinculada ainda sem BG/data.

Ação permitida somente pelo módulo **Descontos em Férias**:

1. validar novamente o bloqueio por férias gozadas/finalizadas;
2. excluir a `PublicacaoExOfficio` vinculada ou marcá-la como cancelada/inativa se a exclusão física não for desejável por auditoria;
3. marcar `DescontoFerias.status = cancelado` **preferencialmente** em vez de excluir o registro, preservando auditoria;
4. registrar metadados de auditoria (`cancelado_por_email`, `cancelado_em`, `motivo_cancelamento`, se os campos forem adicionados);
5. não alterar `PeriodoAquisitivo`;
6. não alterar saldo.

Decisão técnica recomendada: **marcar como `cancelado`**, não excluir `DescontoFerias`, para manter trilha histórica e facilitar reconciliação.

### 3.4. Desconto ativo/publicado

Condição:

- `DescontoFerias.status = ativo`;
- `saldo_aplicado = true`;
- publicação vinculada já publicada com BG/data.

Ação permitida somente pelo módulo **Descontos em Férias**:

1. validar bloqueio por férias gozadas/finalizadas antes de gerar qualquer ato;
2. se houver bloqueio, retornar a mensagem obrigatória e não criar publicação;
3. se não houver bloqueio, criar `PublicacaoExOfficio` tipo **Tornar Sem Efeito** referenciando a publicação original/desconto;
4. não devolver saldo imediatamente;
5. manter desconto em estado intermediário a definir, recomendado: adicionar `status = reversao_pendente_publicacao` ou campos `publicacao_reversao_id` e `reversao_pendente=true`;
6. devolver saldo somente quando o Tornar Sem Efeito for publicado com BG/data;
7. após publicação do Tornar Sem Efeito, atualizar `DescontoFerias.status = revertido` e `saldo_aplicado = false`.

## 4. Onde a Família/Rastro é montada

### 4.1. Rastro de férias

- Página abre o painel em `src/pages/Ferias.jsx`, estado `familiaPanel` e renderização do `FamiliaFeriasPanel`.
- O componente principal do rastro é `src/components/ferias/FamiliaFeriasPanel.jsx`.
- A cadeia operacional é montada com `montarCadeia` de `src/components/ferias/feriasAdminUtils.jsx`, filtrando `RegistroLivro` por `ferias_id` e por tipos operacionais: `Saída Férias`, `Retorno Férias`, `Interrupção de Férias`, `Nova Saída / Retomada`.
- O status derivado da cadeia é calculado localmente em `getEstadoAtualDaCadeia`; quando o último evento é `Retorno Férias`, o painel exibe estado derivado `Encerrada`.
- O bloco administrativo é isolado em `AdminCadeiaPanel` e só deve continuar tratando eventos de férias/livro, não descontos.

### 4.2. Família de publicações

- A família de publicações é aberta em `src/pages/Publicacoes.jsx` por `setFamiliaPanel({ open: true, registro })`.
- O painel de publicações é `src/components/publicacao/FamiliaPublicacaoPanel.jsx`.
- Para esta Fase 3, a regra principal solicitada é sobre **Rastro da Família** de férias; se a publicação de desconto aparecer em família documental, ela também deve ser informativa e apontar a reversão para o módulo **Descontos em Férias**.

## 5. Como incluir `DescontoFerias` como evento informativo

### 5.1. Estratégia de leitura

Adicionar ao fluxo de férias uma consulta de descontos relacionados ao mesmo período:

- preferencial: carregar `DescontoFerias` na página `Ferias.jsx` ou em hook/service dedicado, filtrando por `periodo_aquisitivo_id` dos itens visíveis;
- alternativa inicial: `FamiliaFeriasPanel` receber `descontosFerias` já carregados da página para evitar busca por item no painel;
- enriquecer com `PublicacaoExOfficio` vinculada usando o mesmo padrão de `listarDescontosFerias` em `src/services/descontoFeriasService.js`.

### 5.2. Estratégia visual

No `FamiliaFeriasPanel`:

- manter `eventosVinculados` somente para eventos operacionais de férias;
- criar uma lista separada `descontosInformativos` filtrada por `ferias.periodo_aquisitivo_id`;
- renderizar um bloco próprio, por exemplo **Ajustes do Período**, antes ou depois da sequência de eventos;
- cada card deve ter ícone/estilo diferente de operação de gozo, deixando claro que é ajuste administrativo;
- o card não deve entrar no cálculo de `estadoCadeia`, `detectarInconsistencias`, `possuiEventosPendentes` nem `indicadores`.

Texto sugerido do card:

```text
Desconto em Férias: -3 dia(s)
Status: Ativo
Publicação: Publicado — BG 123, 10/05/2026
Reversão disponível apenas em Descontos em Férias.
```

## 6. Como impedir ações dentro da Família

- Não passar handlers de cancelamento/reversão para `FamiliaFeriasPanel`.
- Não adicionar botões de ação no card de desconto.
- Não incluir desconto em `AdminCadeiaPanel`.
- Se o usuário for admin, a mensagem informativa deve permanecer a única orientação.
- Qualquer ação deve estar concentrada em `src/pages/DescontosFerias.jsx` e/ou componentes filhos específicos do módulo.

## 7. Validação de bloqueio no backend

### 7.1. Função utilitária recomendada

Criar uma função compartilhável no backend, por exemplo:

- `base44/functions/_shared/descontoFeriasGuards.ts`; ou
- duplicar inicialmente nos endpoints da Fase 3 se o ambiente não suportar shared imports com segurança.

Assinatura sugerida:

```ts
async function assertPeriodoNaoGozadoOuFinalizado({ base44, militarId, periodoAquisitivoId })
```

Validações:

1. buscar `Ferias.filter({ periodo_aquisitivo_id: periodoAquisitivoId })`;
2. restringir por `militar_id` quando disponível;
3. bloquear status normalizado em `gozada`, `finalizada`, `retornada`, `encerrada`, `concluida`, `concluída`;
4. buscar `RegistroLivro` vinculado às férias encontradas ou ao militar/período e bloquear se existir `tipo_registro = "Retorno Férias"` publicado ou operacionalmente válido;
5. lançar erro 409 com mensagem obrigatória.

### 7.2. Pontos obrigatórios de validação

- Endpoint de cancelar desconto pendente.
- Endpoint de solicitar reversão de desconto ativo.
- Endpoint/função que publica o **Tornar Sem Efeito** e restitui saldo.
- Qualquer rotina futura de reversão automática/reconciliação.

## 8. Arquivos/funções a alterar na implementação futura

### Backend/Base44

- `base44/entities/DescontoFerias.jsonc`
  - avaliar adicionar `reversao_pendente_publicacao` ao enum de status;
  - adicionar `publicacao_reversao_id`, `cancelado_por_email`, `cancelado_em`, `motivo_cancelamento`, `revertido_por_publicacao_id`, `revertido_em`.
- `base44/functions/cancelarDescontoFeriasPendente/entry.ts` (novo)
  - cancelar apenas pendentes sem saldo aplicado e sem publicação BG/data.
- `base44/functions/solicitarReversaoDescontoFerias/entry.ts` (novo)
  - gerar Tornar Sem Efeito para desconto ativo/publicado sem devolver saldo.
- `base44/functions/ativarReversaoDescontoFeriasPublicado/entry.ts` (novo)
  - quando Tornar Sem Efeito for publicado, restituir saldo e marcar `revertido`.
- `base44/functions/ativarDescontoFeriasPublicado/entry.ts`
  - garantir que não ative desconto se a publicação/desconto tiver sido cancelado;
  - considerar bloqueio por férias já finalizadas antes de aplicar saldo, se a publicação ficou pendente por muito tempo.
- `base44/functions/cudEscopado/entry.ts`
  - se necessário, impedir mutações genéricas que contornem os gateways oficiais.

### Frontend

- `src/pages/DescontosFerias.jsx`
  - adicionar ações contextuais: **Cancelar pendente** e **Solicitar reversão**;
  - ocultar/desabilitar ações conforme status/publicação;
  - exibir mensagem de bloqueio retornada pelo backend.
- `src/services/descontoFeriasService.js`
  - adicionar clientes/listagem enriquecida para cancelamento/reversão;
  - centralizar labels/badges para eventual `reversao_pendente_publicacao`.
- `src/services/descontoFeriasGatewayClient.js` ou novos clients
  - criar clients `cancelarDescontoFeriasPendenteClient.js`, `solicitarReversaoDescontoFeriasClient.js`, `ativarReversaoDescontoFeriasPublicadoClient.js`.
- `src/components/descontos-ferias/*`
  - modais de confirmação com motivo obrigatório e resumo da publicação vinculada.
- `src/pages/Ferias.jsx`
  - carregar descontos relacionados aos períodos/férias visíveis e repassar ao painel.
- `src/components/ferias/FamiliaFeriasPanel.jsx`
  - renderizar bloco informativo de descontos, sem ações.
- `src/pages/Publicacoes.jsx`
  - ao publicar `Tornar Sem Efeito`, chamar a função de ativação da reversão, de modo análogo à ativação atual de `Dispensa com Desconto em Férias`.
- `src/components/rp/rpTiposConfig.jsx` e `src/pages/TemplatesTexto.jsx`
  - garantir tipo/template para **Tornar Sem Efeito** de desconto em férias, se ainda não existir de forma parametrizada.

## 9. Riscos

- **Dupla restituição de saldo**: mitigar com `saldo_aplicado=false` apenas após reversão publicada e checagem idempotente por `publicacao_reversao_id`.
- **Cancelamento por exclusão física sem auditoria**: preferir status `cancelado` no `DescontoFerias`; se excluir a publicação pendente, registrar motivo no desconto.
- **Bypass por CRUD genérico**: bloquear ações críticas fora dos gateways e revisar `cudEscopado`.
- **Status inconsistentes**: bloquear tanto por `Ferias.status` quanto por existência de `Retorno Férias` na cadeia.
- **Fanout de consultas no rastro**: carregar descontos por lote na página, não fazer uma consulta por abertura de card em massa.
- **Publicação pendente por longo período**: antes de ativar desconto ou reversão, repetir validações críticas no backend.
- **Ambiguidade de "Tornar Sem Efeito"**: vincular reversão explicitamente ao desconto original e à publicação original para evitar atingir outros atos.

## 10. Testes obrigatórios na implementação futura

### Backend

- Cancelar desconto `pendente_publicacao` + `saldo_aplicado=false` + publicação sem BG/data:
  - deve cancelar desconto;
  - deve remover/inativar publicação vinculada;
  - não deve alterar saldo/período.
- Tentar cancelar pendente quando há férias `Gozada` no mesmo `periodo_aquisitivo_id`:
  - deve retornar 409 com a mensagem obrigatória.
- Solicitar reversão de desconto `ativo` + `saldo_aplicado=true` + publicação publicada:
  - deve criar `PublicacaoExOfficio` de Tornar Sem Efeito;
  - não deve restituir saldo imediatamente.
- Publicar Tornar Sem Efeito:
  - deve restituir saldo uma única vez;
  - deve marcar desconto como `revertido` e `saldo_aplicado=false`.
- Reexecutar publicação/ativação da reversão:
  - deve ser idempotente e não duplicar saldo.
- Tentar reverter com `Ferias.status` em `Gozada`, `Finalizada`, `Retornada`, `Encerrada`, `Concluída` ou `Concluida`:
  - deve bloquear.
- Tentar reverter quando existe `RegistroLivro.tipo_registro = "Retorno Férias"` na família:
  - deve bloquear mesmo se `Ferias.status` estiver divergente.

### Frontend

- Rastro da Família mostra `Desconto em Férias: -X dia(s)`, status e publicação vinculada.
- Rastro da Família não mostra botões de excluir/cancelar/reverter para desconto, inclusive para admin.
- Rastro mostra a mensagem: `Reversão disponível apenas em Descontos em Férias.`
- Tela Descontos em Férias mostra **Cancelar** somente para pendente sem publicação BG/data.
- Tela Descontos em Férias mostra **Solicitar reversão** somente para ativo/publicado.
- Toast/alerta exibe exatamente: `Não é possível reverter desconto de férias já gozadas/finalizadas.`
- Publicações chama a ativação correta ao publicar o Tornar Sem Efeito.
