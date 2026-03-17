import { auditLogger } from './auditLogger';
import { ActionPermissionDeniedError } from './errors';
import { resolveActionPermissionKey } from './utils';

export async function assertActionPermission(context, actionOrRuleKey, options = {}) {
  const permissionKey = resolveActionPermissionKey(actionOrRuleKey);
  if (permissionKey && context?.actionAccess?.has(permissionKey)) {
    return permissionKey;
  }

  await auditLogger(
    {
      ...context,
      entity: options.entityName || null,
      operation: options.operation || 'assertActionPermission',
      allowed: false,
      reason: `missing:${permissionKey || 'unknown_action'}`,
    },
    options
  );

  throw new ActionPermissionDeniedError(permissionKey || actionOrRuleKey, {
    entityName: options.entityName || null,
  });
}
