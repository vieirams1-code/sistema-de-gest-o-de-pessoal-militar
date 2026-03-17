import { auditLogger } from './auditLogger';
import { PatchFieldNotAllowedError } from './errors';
import { ENTITY_MUTABLE_FIELDS } from './entityMutableFields';

function isAllowedField(allowRule, fieldName) {
  if (typeof allowRule === 'string') {
    return allowRule === fieldName;
  }

  if (allowRule instanceof RegExp) {
    return allowRule.test(fieldName);
  }

  return false;
}

export async function sanitizePatchByWhitelist(entityName, payload, options = {}) {
  const mode = options.mode || 'update';
  const rules = ENTITY_MUTABLE_FIELDS[entityName]?.[mode] || [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  if (!rules.length) {
    const field = Object.keys(payload)[0] || '*';
    await auditLogger(
      {
        ...(options.context || {}),
        entity: entityName,
        operation: options.operation || 'sanitizePatchByWhitelist',
        allowed: false,
        reason: `whitelist_missing:${mode}`,
        changed_fields: Object.keys(payload),
      },
      options
    );
    throw new PatchFieldNotAllowedError(entityName, field, { mode });
  }

  const sanitized = {};
  for (const [field, value] of Object.entries(payload)) {
    const allowed = rules.some((rule) => isAllowedField(rule, field));
    if (!allowed) {
      await auditLogger(
        {
          ...(options.context || {}),
          entity: entityName,
          operation: options.operation || 'sanitizePatchByWhitelist',
          allowed: false,
          reason: `field_not_allowed:${field}`,
          changed_fields: [field],
        },
        options
      );
      throw new PatchFieldNotAllowedError(entityName, field, { mode });
    }
    sanitized[field] = value;
  }

  return sanitized;
}
