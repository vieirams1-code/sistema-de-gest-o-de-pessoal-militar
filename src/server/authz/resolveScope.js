import { ENTITY_SCOPE_REGISTRY } from './entityScopeRegistry';
import { EntityScopeUnresolvedError } from './errors';
import { resolveMilitarAnchor } from './resolveMilitarAnchor';
import { matchesEmailFallback } from './utils';

function directAnchorFromRecord(record) {
  return {
    id: record?.id || null,
    militar_id: record?.militar_id || record?.id || null,
    grupamento_id: record?.grupamento_id || null,
    subgrupamento_id: record?.subgrupamento_id || null,
  };
}

function scopeEmails(context) {
  return [context?.authEmail, context?.linkedMilitarEmail].filter(Boolean);
}

function isRecordInModoAcesso(context, anchor, record) {
  if (context?.isAdmin) {
    return true;
  }

  switch (context?.modoAcesso) {
    case 'setor':
      return (
        anchor?.grupamento_id === context.scopeRootId ||
        anchor?.subgrupamento_id === context.scopeRootId
      );
    case 'subsetor':
      return (
        anchor?.subgrupamento_id === context.scopeRootId ||
        context.scopeSubgrupamentoIds?.includes(anchor?.subgrupamento_id)
      );
    case 'unidade':
      return anchor?.subgrupamento_id === context.scopeRootId;
    case 'proprio':
      return (
        Boolean(context.linkedMilitarId && anchor?.militar_id === context.linkedMilitarId) ||
        Boolean(context.linkedMilitarId && anchor?.id === context.linkedMilitarId) ||
        matchesEmailFallback(record, scopeEmails(context)) ||
        matchesEmailFallback(anchor, scopeEmails(context))
      );
    default:
      return false;
  }
}

export async function resolveScope(context, entityName, recordOrPayload, options = {}) {
  const scopeMode = ENTITY_SCOPE_REGISTRY[entityName];
  if (!scopeMode) {
    throw new EntityScopeUnresolvedError(entityName, { reason: 'unregistered_scope_mode' });
  }

  if (scopeMode === 'adminOnly') {
    return { scopeMode, anchor: null, inScope: Boolean(context?.isAdmin) };
  }

  if (scopeMode === 'quadro') {
    return {
      scopeMode,
      anchor: null,
      inScope: Boolean(context?.isAdmin || context?.moduleAccess?.has('acesso_quadro_operacional')),
    };
  }

  if (scopeMode === 'selfOnly') {
    const anchor = directAnchorFromRecord(recordOrPayload);
    return {
      scopeMode,
      anchor,
      inScope: isRecordInModoAcesso({ ...context, modoAcesso: 'proprio' }, anchor, recordOrPayload),
    };
  }

  const anchor = scopeMode === 'byMilitar'
    ? await resolveMilitarAnchor(entityName, recordOrPayload, options)
    : directAnchorFromRecord(recordOrPayload);

  return {
    scopeMode,
    anchor,
    inScope: isRecordInModoAcesso(context, anchor, recordOrPayload),
  };
}
