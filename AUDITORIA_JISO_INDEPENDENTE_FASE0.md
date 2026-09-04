# Refatoração JISO Independente — Checkpoint 0 / Fase 1A

Data: 2026-09-04
Branch de trabalho: `refactor/jiso-independent-phase1`
Checkpoint pré-refatoração: `checkpoint/jiso-independent-pre-refactor-2026-09-04`
Base congelada: `main` em `af7f6d8af1e847faf1c3538f728b20412ad127fc`

## Objetivo

Separar o domínio JISO do domínio Atestado sem interromper o fluxo atual. A JISO passa a poder existir sem atestado e passa a aceitar zero, um ou vários atestados do mesmo militar.

## Arquitetura alvo

- `JISO`: entidade principal da inspeção de saúde.
- `JISOAtestado`: entidade de vínculo N:N entre JISO e Atestado.
- `Atestado`: permanece como documento médico/afastamento e conserva temporariamente os campos JISO legados para compatibilidade.
- `Militar`: titular obrigatório da JISO e dos atestados vinculados.

## Invariantes de domínio

1. Toda JISO deve possuir `militar_id`.
2. JISO não precisa possuir atestado.
3. Uma JISO pode possuir vários vínculos `JISOAtestado`.
4. Todo `JISOAtestado` deve referenciar JISO e Atestado pertencentes ao mesmo militar.
5. Não deve existir mais de um vínculo ativo para o mesmo par `jiso_id + atestado_id`.
6. Campos de agendamento, convocação WhatsApp, Ata e publicação passam gradualmente a ter a JISO como fonte de verdade.
7. Campos JISO existentes no Atestado não serão removidos até a conclusão da migração e validação de regressão.

## Dependências encontradas no código atual

### Agenda e edição

- `src/pages/AgendarJISO.jsx`: agenda é montada a partir de Atestados com `necessita_jiso`.
- `src/utils/jiso/montarAgendaJiso.js`: usa `data_jiso_agendada` do Atestado e associa JISO por `atestado_id`.
- `src/pages/EditarJISO.jsx`: recebe `atestado_id`, busca `JISO.filter({ atestado_id })` e grava reflexos no Atestado.

### Atestados

- `src/components/atestado/AtestadoCard.jsx`: agenda JISO, dispara WhatsApp e registra Ata/publicação no Atestado.
- `src/components/atestado/AtestadoCompactItem.jsx`: status visual e reenvio WhatsApp dependem dos campos JISO do Atestado.
- `src/components/atestado/AtestadoActionsMenu.jsx`: download da Ata JISO usa `arquivo_ata_jiso` do Atestado.
- `src/pages/VerAtestado.jsx`: exibe `historico_jiso` armazenado no Atestado.
- `src/components/atestado/JisoHistoricoModal.jsx`: grava prorrogação/cassação em `historico_jiso` do Atestado.
- `src/pages/CadastrarAtestado.jsx`: inicializa campos de JISO no cadastro do atestado.

### WhatsApp

- `base44/functions/notificarJisoWhatsAppTemplate/entry.ts`: exige `atestado_id`, lê data/hora do Atestado e grava tracking no Atestado.

### Segurança / CUD

- `base44/functions/cudEscopado/entry.ts`: possui allowlist e permissões próprias para `JISO`, além de exceções que permitem reflexos JISO no Atestado.
- Permissões existentes a reaproveitar: `gerir_jiso`, `registrar_decisao_jiso`, `publicar_ata_jiso`.

### Quadro Operacional e pendências

- `src/components/quadro/quadroHelpers.js` e `.jsx`: automação JISO depende de `data_jiso_agendada`, `status_jiso` e `historico_jiso` do Atestado.
- `src/components/central-pendencias/CentralPendenciaAtestadoModal.jsx`: considera o atestado encaminhado à JISO por `data_jiso_agendada`, `jiso_id` e `status_jiso`.

### Backup

- `base44/functions/gerarBackupSistema/entry.ts`: reconhece `arquivo_ata_jiso` como campo de arquivo. Deve ser estendido para preservar a Ata quando ela passar à entidade JISO.

## Fase 1A implementada

### JISO

Alteração aditiva nos schemas:

- `entities/JISO.json`
- `base44/entities/JISO.jsonc`

Mudanças:

- `atestado_id` mantido como campo legado, mas removido de `required`.
- `militar_id` permanece obrigatório.
- adicionados `hora_jiso`, `local_jiso`, `motivo_jiso` e `numero_tars`.
- adicionados campos de tracking WhatsApp na própria JISO.
- adicionados campos de Ata/Publicação na própria JISO.
- `dias_original` e `dias_jiso` mantidos como compatibilidade para o fluxo legado de um único atestado.

### JISOAtestado

Novos schemas:

- `entities/JISOAtestado.json`
- `base44/entities/JISOAtestado.jsonc`

Campos principais:

- `jiso_id`
- `atestado_id`
- `militar_id`
- `tipo_vinculo`
- `origem_vinculo`
- `resultado_atestado`
- `dias_homologados`
- `data_termino_resultante`
- `data_retorno_resultante`
- `observacoes`
- controle de vínculo ativo/desvinculação

## Próximo lote — Fase 1B

1. Incluir `JISOAtestado` no portão de escrita seguro.
2. Reaproveitar `gerir_jiso` / `registrar_decisao_jiso` sem criar permissão nova.
3. Validar no backend que JISO e Atestado pertencem ao mesmo `militar_id`.
4. Bloquear vínculo ativo duplicado do mesmo par JISO + Atestado.
5. Bloquear alteração de `jiso_id`, `atestado_id` ou `militar_id` que quebre a integridade do vínculo.
6. Preparar migração somente em modo preview antes de qualquer escrita de dados.

## Estratégia de migração futura

Para cada JISO legado com `atestado_id`:

- manter o registro JISO existente;
- criar um `JISOAtestado` com `origem_vinculo = migracao_legado`;
- copiar para a JISO, quando ausentes, data/hora, tracking WhatsApp, Ata e publicação existentes no Atestado;
- não apagar campos legados do Atestado;
- detectar possíveis duplicidades e gerar relatório, sem fusão automática.

## Critério para avançar

A Fase 1B só deve ser aplicada depois de validação do diff desta Fase 1A. Nenhuma tela deve ser alterada antes de o novo relacionamento estar protegido no backend.
