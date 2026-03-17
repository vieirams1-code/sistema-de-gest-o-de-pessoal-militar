import { EntityScopeUnresolvedError } from './errors';
import { getRecordById } from './utils';

export async function resolveMilitarAnchor(entityName, recordOrPayload, options = {}) {
  if (!recordOrPayload) {
    throw new EntityScopeUnresolvedError(entityName, { reason: 'empty_record' });
  }

  if (entityName === 'Militar') {
    return {
      militar_id: recordOrPayload.id || recordOrPayload.militar_id || null,
      grupamento_id: recordOrPayload.grupamento_id || null,
      subgrupamento_id: recordOrPayload.subgrupamento_id || null,
      militar_email:
        recordOrPayload.email ||
        recordOrPayload.email_particular ||
        recordOrPayload.email_funcional ||
        recordOrPayload.militar_email ||
        null,
    };
  }

  const militarId = recordOrPayload.militar_id || recordOrPayload.militar?.id || null;
  if (!militarId) {
    throw new EntityScopeUnresolvedError(entityName, { reason: 'missing_militar_id' });
  }

  const militar = await getRecordById('Militar', militarId, options);
  if (!militar) {
    throw new EntityScopeUnresolvedError(entityName, { reason: 'militar_not_found', militarId });
  }

  return {
    militar_id: militar.id,
    grupamento_id: militar.grupamento_id || null,
    subgrupamento_id: militar.subgrupamento_id || null,
    militar_email:
      militar.email ||
      militar.email_particular ||
      militar.email_funcional ||
      militar.militar_email ||
      null,
  };
}
