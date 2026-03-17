import { auditLogger } from './auditLogger';
import { PatchFieldNotAllowedError } from './errors';
import { ENTITY_IMMUTABLE_FIELDS } from './entityMutableFields';

export async function assertImmutableFieldsNotChanged(entityName, before, payload, options = {}) {
  const immutableFields = ENTITY_IMMUTABLE_FIELDS[entityName] || [];

  for (const field of immutableFields) {
    if (!(field in (payload || {}))) {
      continue;
    }

    if (payload[field] === before?.[field]) {
      continue;
    }

    await auditLogger(
      {
        ...(options.context || {}),
        entity: entityName,
        operation: options.operation || 'assertImmutableFieldsNotChanged',
        record_id: before?.id || null,
        allowed: false,
        reason: `immutable_field:${field}`,
        changed_fields: [field],
      },
      options
    );

    throw new PatchFieldNotAllowedError(entityName, field, { immutable: true });
  }
}
