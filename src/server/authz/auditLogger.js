function normalizeChangedFields(changedFields) {
  if (!Array.isArray(changedFields)) {
    return [];
  }

  return [...new Set(changedFields.filter(Boolean))];
}

export function buildAuditEntry(input = {}) {
  return {
    entity: input.entity || null,
    operation: input.operation || null,
    record_id: input.record_id || input.recordId || null,
    user_email: input.user_email || input.authEmail || null,
    modo_acesso: input.modo_acesso || input.modoAcesso || null,
    scope_root_id: input.scope_root_id || input.scopeRootId || null,
    allowed: input.allowed === true,
    reason: input.reason || null,
    changed_fields: normalizeChangedFields(input.changed_fields || input.changedFields),
    timestamp: input.timestamp || new Date().toISOString(),
  };
}

export async function auditLogger(input = {}, options = {}) {
  const entry = buildAuditEntry(input);

  if (typeof options.sink === 'function') {
    await options.sink(entry);
    return entry;
  }

  console.info('[authz.audit]', JSON.stringify(entry));
  return entry;
}
