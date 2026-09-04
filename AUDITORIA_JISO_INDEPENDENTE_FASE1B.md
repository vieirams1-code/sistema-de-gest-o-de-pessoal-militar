# Refatoração JISO Independente — Fase 1B

Data: 2026-09-04
Branch: `refactor/jiso-independent-phase1`
Base: `checkpoint/jiso-independent-phase1a-schema`

## Objetivo

Proteger o novo relacionamento `JISOAtestado` antes de qualquer uso por tela ou migração de dados.

## Decisão de implementação

Nesta fase foi adotado um portão dedicado (`cudJisoAtestado`) em vez de ampliar imediatamente o arquivo central `cudEscopado`.

Motivo: `cudEscopado` é um componente central, extenso e sensível do SGP. Como a nova entidade ainda não é consumida por telas existentes, um portão específico reduz a superfície de regressão e permite validar o novo domínio isoladamente. A integração ao fluxo geral pode ser reavaliada quando a nova UI JISO estiver pronta.

## Regras aplicadas

### Permissões

- criar vínculo: `gerir_jiso`;
- desvincular: `gerir_jiso`;
- registrar/alterar efeitos da JISO sobre o atestado: `registrar_decisao_jiso`;
- administrador real mantém bypass conforme `getUserPermissions`.

### Escopo

- reutiliza `getScopedAtestadosBundle`;
- o atestado deve estar visível no escopo efetivo do usuário;
- impersonação continua sendo resolvida pelos mecanismos existentes.

### Integridade

- JISO precisa existir;
- Atestado precisa existir;
- ambos precisam ter `militar_id`;
- `JISO.militar_id` deve ser igual a `Atestado.militar_id`;
- `militar_id` informado no vínculo deve coincidir com ambos;
- não pode existir outro vínculo ativo com o mesmo par `jiso_id + atestado_id`;
- `jiso_id`, `atestado_id` e `militar_id` são imutáveis após criação;
- vínculo inativo não pode receber nova decisão.

### Desvinculação

A operação `delete` do portão não remove fisicamente o registro. Ela grava:

- `ativo = false`;
- `desvinculado_em`;
- `desvinculado_por`.

Assim preservamos trilha histórica.

### Auditoria

As ações são registradas em `AssistenteLog` com tipo `auditoria_jiso_atestado`:

- `vincular_atestado_jiso`;
- `desvincular_atestado_jiso`;
- `registrar_efeito_jiso_atestado`.

## Arquivos adicionados

- `base44/functions/cudJisoAtestado/entry.ts`
- `src/services/jisoAtestadoCudClient.js`
- `src/services/__tests__/jisoAtestadoSecurity.test.js`

## Testes de contrato adicionados

Os testes verificam estaticamente:

- JISO sem `atestado_id` obrigatório;
- identidade obrigatória de `JISOAtestado`;
- uso de `getUserPermissions` e `getScopedAtestadosBundle`;
- separação entre `gerir_jiso` e `registrar_decisao_jiso`;
- bloqueio de militares divergentes;
- bloqueio de vínculo ativo duplicado;
- imutabilidade da identidade do vínculo;
- desvinculação lógica em vez de exclusão física;
- cliente frontend usando somente o portão dedicado.

## Estado funcional

Nenhuma tela atual foi alterada. Nenhum dado existente foi migrado. O fluxo atual Atestado/JISO permanece intacto.

## Próximo passo recomendado

Fase 2A — construir um migrador em modo `preview` que identifique todas as JISOs legadas e produza relatório de:

1. vínculo legado JISO -> Atestado a criar;
2. campos de agendamento que precisam migrar do Atestado para a JISO;
3. tracking WhatsApp a migrar;
4. Ata/Publicação a migrar;
5. duplicidades ou inconsistências que exigem revisão humana.

Nenhuma escrita de dados deve ocorrer na Fase 2A.
