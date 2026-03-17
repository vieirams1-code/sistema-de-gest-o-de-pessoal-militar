import { assertModuleAccess } from './assertModuleAccess';
import { assertRecordInScope } from './assertRecordInScope';
import { resolveCurrentAccessContext } from './resolveCurrentAccessContext';
import { getRecordById } from './utils';

export async function secureGetById(entityName, id, options = {}) {
  const context = options.context || await resolveCurrentAccessContext(options);
  await assertModuleAccess(context, entityName, { ...options, entityName, operation: 'getById' });

  const record = await getRecordById(entityName, id, options);
  if (!record) {
    return null;
  }

  await assertRecordInScope(context, entityName, record, { ...options, operation: 'getById' });
  return record;
}
