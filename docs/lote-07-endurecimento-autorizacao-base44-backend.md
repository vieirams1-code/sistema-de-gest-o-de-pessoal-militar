# LOTE 07 — Endurecimento de autorização real no Base44/backend

## Status de implementação neste workspace

Neste repositório **não há artefatos server-side do Base44** (ex.: `Base44/backend`, `policies`, `constraints`, `workflows`, handlers/API server). O conteúdo disponível é front-end (`src/`) e documentação (`docs/`).

Por isso, este lote é entregue como **pacote técnico pronto para aplicação** no backend real, sem afirmar implementação inexistente.

## 1) Arquivos/localizações faltantes (onde criar/aplicar)

> Ajuste os caminhos abaixo conforme o layout exato do seu projeto Base44/backend.

- `Base44/backend/policies/common/denyByDefault.ts`
- `Base44/backend/policies/scope/resolveActorScope.ts`
- `Base44/backend/policies/scope/enforceScopeFilter.ts`
- `Base44/backend/policies/entities/Atestado.policy.ts`
- `Base44/backend/policies/entities/PublicacaoExOfficio.policy.ts`
- `Base44/backend/policies/entities/ControlePublicacao.policy.ts`
- `Base44/backend/policies/entities/RegistroLivro.policy.ts`
- `Base44/backend/policies/entities/JisoAta.policy.ts`
- `Base44/backend/policies/entities/Militar.policy.ts`
- `Base44/backend/policies/entities/FichaMilitar.policy.ts`
- `Base44/backend/policies/entities/Permissao.policy.ts`
- `Base44/backend/policies/entities/Ferias.policy.ts`
- `Base44/backend/policies/entities/QuadroOperacional.policy.ts`
- `Base44/backend/policies/entities/QuadroVinculo.policy.ts`
- `Base44/backend/policies/mutations/mutableFieldsWhitelist.ts`
- `Base44/backend/constraints/activeUniqueness.constraints.ts`
- `Base44/backend/workflows/transactions/tse.workflow.ts`
- `Base44/backend/workflows/transactions/apostila.workflow.ts`
- `Base44/backend/workflows/transactions/cascadeDelete.workflow.ts`
- `Base44/backend/workflows/transactions/crossReversal.workflow.ts`
- `Base44/backend/audit/auditTrail.service.ts`
- `Base44/backend/audit/auditTrail.middleware.ts`
- `Base44/backend/tests/security/access-control.spec.ts`
- `Base44/backend/tests/security/scope-filter.spec.ts`
- `Base44/backend/tests/security/mutable-fields.spec.ts`
- `Base44/backend/tests/security/constraints.spec.ts`
- `Base44/backend/tests/security/transactions.spec.ts`

---

## 2) Proposta exata de policies/constraints/workflows

## 2.1 Deny-by-default por entidade sensível

Regra global:
- Se não houver regra explícita para `ação + role + escopo` ⇒ **NEGAR**.
- `role` ausente/indefinida ⇒ **NEGAR**.
- `scope` ausente/indefinido ⇒ **NEGAR**.

Pseudocódigo-base:

```ts
// policies/common/denyByDefault.ts
export function authorizeOrDeny(ctx: AuthzContext, rule?: Rule): AuthzDecision {
  if (!ctx?.actor?.id) return { allow: false, reason: 'ACTOR_MISSING' };
  if (!ctx?.actor?.role) return { allow: false, reason: 'ROLE_MISSING' };
  if (!ctx?.scope) return { allow: false, reason: 'SCOPE_MISSING' };
  if (!rule) return { allow: false, reason: 'RULE_NOT_FOUND' };
  return rule(ctx);
}
```

## 2.2 Filtros server-side obrigatórios por escopo

Aplicar filtro em **toda leitura/listagem/exportação** (inclusive endpoints internos):

- `Atestado`: `orgao_id`, `unidade_id` e vínculo do militar com a unidade do ator.
- `PublicacaoExOfficio` / `ControlePublicacao`: mesmo escopo + relação por `militar_id`/`atestado_id` permitidos.
- `RegistroLivro`: restringir por livro/unidade do ator.
- `JISO` (atas e decisões): escopo por unidade e, quando aplicável, comissão.
- `Militar` / `Ficha`: apenas militares do escopo do ator.
- `Permissoes`: somente gestão no escopo permitido; leitura sem escopo global.
- `Ferias`: escopo do militar/unidade.
- `Quadro Operacional` e vínculos: escopo por unidade/quadro.

Pseudocódigo:

```ts
// policies/scope/enforceScopeFilter.ts
export function enforceScopeFilter(entity: string, actorScope: Scope, query: any) {
  const scopedQuery = { ...query };

  switch (entity) {
    case 'Atestado':
      scopedQuery.orgao_id = actorScope.orgao_id;
      scopedQuery.unidade_id = { $in: actorScope.unidadesPermitidas };
      break;
    case 'RegistroLivro':
      scopedQuery.unidade_id = { $in: actorScope.unidadesPermitidas };
      break;
    // ...demais entidades
    default:
      throw new Error('ENTITY_SCOPE_NOT_MAPPED');
  }

  return scopedQuery;
}
```

## 2.3 Remover fallback permissivo implícito (admin/undefined)

Semântica obrigatória:
- `undefined/null` em role, profile, scope, ação ou entidade ⇒ **deny**.
- “admin implícito” por ausência de validação ⇒ proibido.
- Admin só acessa com role explícita (`ADMIN_GLOBAL` ou equivalente) e trilha de auditoria.

## 2.4 Whitelist de campos mutáveis por ação/role

Tabela mínima (exemplo objetivo):

- `Atestado`
  - `create`: `medico_crm`, `cid`, `data_inicio`, `data_termino`, `tipo_afastamento`, `militar_id`
  - `update` (OPERADOR_SAUDE): acima + `status_jiso`, `data_jiso_agendada`
  - `update` (COMANDO): apenas `status_jiso`, `observacao_comando`
- `PublicacaoExOfficio`
  - `create/update`: `numero`, `data_publicacao`, `ementa`, `atestados_jiso_ids`, `assinante_id`
- `RegistroLivro`
  - `create`: `tipo`, `data_registro`, `militar_id`, `referencia_tipo`, `referencia_id`, `conteudo`
  - `update`: somente `conteudo` até janela temporal definida
- `Permissao`
  - `update`: `perfil_id`, `escopo`, `ativo` (somente ADMIN da unidade)
- `Ferias`
  - `update`: `data_inicio`, `data_fim`, `situacao`, `observacao`

Pseudocódigo:

```ts
// policies/mutations/mutableFieldsWhitelist.ts
export const MUTABLE_FIELDS = {
  Atestado: {
    create: {
      OPERADOR_SAUDE: ['medico_crm', 'cid', 'data_inicio', 'data_termino', 'tipo_afastamento', 'militar_id'],
    },
    update: {
      OPERADOR_SAUDE: ['cid', 'data_inicio', 'data_termino', 'tipo_afastamento', 'status_jiso', 'data_jiso_agendada'],
      COMANDO: ['status_jiso', 'observacao_comando'],
    },
  },
  // ...demais entidades
} as const;

export function validateMutableFields(entity: string, action: string, role: string, payload: Record<string, any>) {
  const allowed = MUTABLE_FIELDS?.[entity]?.[action]?.[role] ?? [];
  const blocked = Object.keys(payload).filter((k) => !allowed.includes(k));
  if (blocked.length) throw new Error(`MUTABLE_FIELDS_VIOLATION:${blocked.join(',')}`);
}
```

## 2.5 Proteção transacional (TSE, Apostila, exclusões encadeadas, reversões cruzadas)

Obrigatório usar transação ACID e idempotência:
- TSE: gravação de evento principal + vínculos + logs na mesma transação.
- Apostila: criação/retificação com lock otimista/pessimista.
- Exclusões encadeadas: soft-delete consistente em todas relações obrigatórias.
- Reversões cruzadas: operação inversa com validação de estado e registro de auditoria.

Pseudocódigo:

```ts
await db.transaction(async (tx) => {
  const evento = await tx.tseEvento.create(data);
  await tx.tseVinculo.createMany(vinculos(evento.id));
  await tx.audit.create(buildAudit('TSE_CREATE', before, evento));
});
```

## 2.6 Constraints de unicidade ativa

Implementar constraints parciais (ou regra equivalente no banco):

1. **Homologação ativa por atestado**
   - chave: `(atestado_id)`
   - condição: `status = 'ATIVA'`

2. **Ata JISO ativa por atestado vinculado**
   - chave: `(atestado_id)`
   - condição: `ativa = true`

Exemplo SQL (adaptar ao banco):

```sql
CREATE UNIQUE INDEX uq_homologacao_ativa_por_atestado
ON homologacoes (atestado_id)
WHERE status = 'ATIVA';

CREATE UNIQUE INDEX uq_ata_jiso_ativa_por_atestado
ON jiso_atas (atestado_id)
WHERE ativa = true;
```

## 2.7 Auditoria mínima obrigatória

Para mutações críticas (`create/update/delete/reverse/approve`):
- `actor_id`
- `timestamp`
- `acao`
- `entidade`
- `entidade_id`
- `before`
- `after`
- `origem` (API, job, integração)
- `request_id`/`trace_id`

Pseudocódigo:

```ts
await auditTrail.record({
  actor_id: ctx.actor.id,
  timestamp: new Date().toISOString(),
  acao: 'UPDATE',
  entidade: 'Atestado',
  entidade_id: atestadoId,
  before,
  after,
  origem: ctx.request.origin ?? 'api',
  request_id: ctx.request.id,
});
```

## 2.8 Testes de regressão de acesso indevido por API direta

Casos mínimos:

1. Usuário sem role tenta listar `Atestado` sem filtro de escopo ⇒ 403.
2. Usuário de unidade A tenta acessar `Atestado` da unidade B ⇒ 403/empty.
3. Payload com campo não-whitelistado em `update` de `Ferias` ⇒ 422.
4. Criação de segunda homologação ativa para mesmo atestado ⇒ erro de constraint.
5. Reversão cruzada sem estado válido ⇒ rollback total.
6. Admin sem scope explícito ⇒ 403.
7. Mutação crítica sempre gera registro de auditoria completo.

---

## 3) Diff/pseudo-código pronto para colar

```diff
+ // Base44/backend/policies/common/denyByDefault.ts
+ export function denyByDefault(ctx, next) {
+   if (!ctx.actor?.id) throw forbidden('ACTOR_MISSING');
+   if (!ctx.actor?.role) throw forbidden('ROLE_MISSING');
+   if (!ctx.scope) throw forbidden('SCOPE_MISSING');
+   return next();
+ }
+
+ // Base44/backend/policies/entities/Atestado.policy.ts
+ export const AtestadoPolicy = {
+   read: [denyByDefault, requireRole(['OPERADOR_SAUDE','COMANDO','ADMIN_GLOBAL']), requireScope('ATTESTADO_READ')],
+   create: [denyByDefault, requireRole(['OPERADOR_SAUDE']), requireScope('ATTESTADO_WRITE'), enforceMutableFields('Atestado','create')],
+   update: [denyByDefault, requireRole(['OPERADOR_SAUDE','COMANDO']), requireScope('ATTESTADO_WRITE'), enforceMutableFields('Atestado','update')],
+   delete: [denyByDefault, requireRole(['ADMIN_GLOBAL']), requireScope('ATTESTADO_DELETE')],
+ };
+
+ // Base44/backend/constraints/activeUniqueness.constraints.sql
+ CREATE UNIQUE INDEX uq_homologacao_ativa_por_atestado
+ ON homologacoes (atestado_id)
+ WHERE status = 'ATIVA';
+
+ CREATE UNIQUE INDEX uq_ata_jiso_ativa_por_atestado
+ ON jiso_atas (atestado_id)
+ WHERE ativa = true;
+
+ // Base44/backend/workflows/transactions/apostila.workflow.ts
+ export async function criarOuRetificarApostila(input, ctx) {
+   return db.transaction(async (tx) => {
+     const before = await tx.apostila.findById(input.id);
+     const after = await tx.apostila.upsert(input);
+     await tx.audit.create(buildAudit(ctx, 'APOSTILA_UPSERT', 'Apostila', after.id, before, after));
+     return after;
+   });
+ }
```

---

## 4) Checklist de execução no backend real

- [ ] Incluir middleware global deny-by-default.
- [ ] Mapear escopo obrigatório por entidade sensível.
- [ ] Proibir fallback permissivo para role/scope ausentes.
- [ ] Aplicar whitelist de campos por ação/role.
- [ ] Encapsular TSE/Apostila/exclusões/reversões em transações.
- [ ] Criar constraints de unicidade ativa.
- [ ] Persistir auditoria mínima em toda mutação crítica.
- [ ] Executar testes de regressão para API direta e validar 403/422/409.
