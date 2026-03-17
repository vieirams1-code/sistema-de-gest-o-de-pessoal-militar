import { auditLogger } from './auditLogger';
import { RecordOutOfScopeError } from './errors';
import { resolveScope } from './resolveScope';

export async function assertRecordInScope(context, entityName, record, options = {}) {
  const resolved = await resolveScope(context, entityName, record, options);
  if (resolved.inScope) {
    return resolved;
  }

  await auditLogger(
    {
      ...context,
      entity: entityName,
      operation: options.operation || 'assertRecordInScope',
      record_id: record?.id || null,
      allowed: false,
      reason: `out_of_scope:${resolved.scopeMode}`,
    },
    options
  );

  throw new RecordOutOfScopeError({
    entityName,
    recordId: record?.id || null,
    scopeMode: resolved.scopeMode,
  });
}
