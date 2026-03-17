import { auditLogger } from './auditLogger';
import { ENTITY_ACTION_RULES } from './entityActionRules';
import { assertActionPermission } from './assertActionPermission';
import { assertModuleAccess } from './assertModuleAccess';
import { assertRecordInScope } from './assertRecordInScope';
import { resolveCurrentAccessContext } from './resolveCurrentAccessContext';
import { resolveScope } from './resolveScope';
import { sanitizePatchByWhitelist } from './sanitizePatchByWhitelist';
import { createRecord } from './utils';

export async function secureCreate(entityName, payload, options = {}) {
  const context = options.context || await resolveCurrentAccessContext(options);
  await assertModuleAccess(context, entityName, { ...options, entityName, operation: 'create' });

  const actionKey = options.actionKey || ENTITY_ACTION_RULES[`${entityName}.${options.operationKey || 'create'}`];
  if (actionKey) {
    await assertActionPermission(context, actionKey, { ...options, entityName, operation: 'create' });
  }

  if (!context.isAdmin) {
    await resolveScope(context, entityName, payload, options);
    await assertRecordInScope(context, entityName, payload, { ...options, operation: 'create' });
  }

  const sanitizedPayload = await sanitizePatchByWhitelist(entityName, payload, {
    ...options,
    context,
    mode: options.mode || 'create',
    operation: 'create',
  });

  const created = await createRecord(entityName, sanitizedPayload, options);

  await auditLogger(
    {
      ...context,
      entity: entityName,
      operation: 'create',
      record_id: created?.id || null,
      allowed: true,
      changed_fields: Object.keys(sanitizedPayload),
    },
    options
  );

  return created;
}
