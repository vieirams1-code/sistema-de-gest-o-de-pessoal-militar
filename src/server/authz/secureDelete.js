import { auditLogger } from './auditLogger';
import { ENTITY_ACTION_RULES } from './entityActionRules';
import { assertActionPermission } from './assertActionPermission';
import { assertModuleAccess } from './assertModuleAccess';
import { assertRecordInScope } from './assertRecordInScope';
import { ActionPermissionDeniedError } from './errors';
import { resolveCurrentAccessContext } from './resolveCurrentAccessContext';
import { deleteRecord, getRecordById, updateRecord } from './utils';

export async function secureDelete(entityName, id, options = {}) {
  const context = options.context || await resolveCurrentAccessContext(options);
  await assertModuleAccess(context, entityName, { ...options, entityName, operation: 'delete' });

  const before = await getRecordById(entityName, id, options);
  if (!before) {
    return null;
  }

  await assertRecordInScope(context, entityName, before, { ...options, operation: 'delete' });

  const actionKey = options.actionKey || ENTITY_ACTION_RULES[`${entityName}.${options.operationKey || 'delete'}`];
  if (actionKey) {
    await assertActionPermission(context, actionKey, { ...options, entityName, operation: 'delete' });
  } else if (!context.isAdmin) {
    await auditLogger(
      {
        ...context,
        entity: entityName,
        operation: 'delete',
        record_id: id,
        allowed: false,
        reason: 'delete_requires_admin_or_explicit_permission',
      },
      options
    );
    throw new ActionPermissionDeniedError(`${entityName}.delete`, { recordId: id });
  }

  const result = options.softDeleteField
    ? await updateRecord(
        entityName,
        id,
        { [options.softDeleteField]: options.softDeleteValue ?? false },
        options
      )
    : await deleteRecord(entityName, id, options);

  await auditLogger(
    {
      ...context,
      entity: entityName,
      operation: 'delete',
      record_id: id,
      allowed: true,
      changed_fields: options.softDeleteField ? [options.softDeleteField] : [],
    },
    options
  );

  return result;
}
