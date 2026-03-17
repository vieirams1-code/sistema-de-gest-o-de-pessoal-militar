import { auditLogger } from './auditLogger';
import { ModuleAccessDeniedError } from './errors';
import { resolveModulePermissionKey } from './utils';

export async function assertModuleAccess(context, moduleOrEntity, options = {}) {
  const permissionKey = resolveModulePermissionKey(moduleOrEntity);
  if (permissionKey && context?.moduleAccess?.has(permissionKey)) {
    return permissionKey;
  }

  await auditLogger(
    {
      ...context,
      entity: options.entityName || moduleOrEntity,
      operation: options.operation || 'assertModuleAccess',
      allowed: false,
      reason: `missing:${permissionKey || 'unknown_module'}`,
    },
    options
  );

  throw new ModuleAccessDeniedError(permissionKey || moduleOrEntity, {
    entityName: options.entityName || moduleOrEntity,
  });
}
