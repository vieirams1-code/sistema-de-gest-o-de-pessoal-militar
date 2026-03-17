import { ENTITY_SCOPE_REGISTRY } from './entityScopeRegistry';
import { assertModuleAccess } from './assertModuleAccess';
import { assertRecordInScope } from './assertRecordInScope';
import { resolveCurrentAccessContext } from './resolveCurrentAccessContext';
import { buildScopedList } from './scopeQueries';
import { listAll, listByFilter } from './utils';

export async function secureList(entityName, query = {}, options = {}) {
  const context = options.context || await resolveCurrentAccessContext(options);
  await assertModuleAccess(context, entityName, { ...options, entityName, operation: 'list' });

  if (context.isAdmin) {
    return Object.keys(query || {}).length ? listByFilter(entityName, query, options) : listAll(entityName, options);
  }

  const scopeMode = ENTITY_SCOPE_REGISTRY[entityName];
  if (scopeMode === 'adminOnly') {
    await assertRecordInScope(context, entityName, {}, { ...options, operation: 'list' });
    return [];
  }

  if (scopeMode === 'quadro') {
    return listAll(entityName, options);
  }

  return buildScopedList(entityName, context, query, options);
}
