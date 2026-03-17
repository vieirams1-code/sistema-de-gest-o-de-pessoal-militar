import { auditLogger } from './auditLogger';
import { ENTITY_ACTION_RULES } from './entityActionRules';
import { assertActionPermission } from './assertActionPermission';
import { assertImmutableFieldsNotChanged } from './assertImmutableFieldsNotChanged';
import { assertModuleAccess } from './assertModuleAccess';
import { assertRecordInScope } from './assertRecordInScope';
import { resolveCurrentAccessContext } from './resolveCurrentAccessContext';
import { sanitizePatchByWhitelist } from './sanitizePatchByWhitelist';
import { getRecordById, updateRecord } from './utils';

export async function secureUpdate(entityName, id, payload, options = {}) {
  const context = options.context || await resolveCurrentAccessContext(options);
  await assertModuleAccess(context, entityName, { ...options, entityName, operation: 'update' });

  const before = await getRecordById(entityName, id, options);
  if (!before) {
    return null;
  }

  await assertRecordInScope(context, entityName, before, { ...options, operation: 'update' });

  const actionKey = options.actionKey || ENTITY_ACTION_RULES[`${entityName}.${options.operationKey || 'update'}`];
  if (actionKey) {
    await assertActionPermission(context, actionKey, { ...options, entityName, operation: 'update' });
  }

  const sanitizedPayload = await sanitizePatchByWhitelist(entityName, payload, {
    ...options,
    context,
    mode: options.mode || 'update',
    operation: 'update',
  });

  await assertImmutableFieldsNotChanged(entityName, before, sanitizedPayload, {
    ...options,
    context,
    operation: 'update',
  });

  if (!Object.keys(sanitizedPayload).length) {
    return before;
  }

  const updated = await updateRecord(entityName, id, sanitizedPayload, options);

  await auditLogger(
    {
      ...context,
      entity: entityName,
      operation: 'update',
      record_id: id,
      allowed: true,
      changed_fields: Object.keys(sanitizedPayload),
    },
    options
  );

  return updated;
}
