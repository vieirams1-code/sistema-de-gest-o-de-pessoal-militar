import { base44 } from './base44Client';

function isSchemaNotFoundError(error) {
  const message = String(error?.message || error?.response?.data?.message || '').toLowerCase();
  return message.includes('entity schema') && message.includes('not found');
}

function createEntityWithAliases(primaryName, aliases = []) {
  const candidateNames = [primaryName, ...aliases];

  async function call(method, ...args) {
    let lastError;

    for (const entityName of candidateNames) {
      try {
        const entity = base44.entities[entityName];
        if (!entity?.[method]) continue;
        return await entity[method](...args);
      } catch (error) {
        lastError = error;
        if (isSchemaNotFoundError(error)) continue;
        throw error;
      }
    }

    if (lastError) throw lastError;

    throw new Error(
      `Entidade não encontrada no schema do app. Tentativas: ${candidateNames.join(', ')}`,
    );
  }

  return {
    list: (...args) => call('list', ...args),
    filter: (...args) => call('filter', ...args),
    get: (...args) => call('get', ...args),
    create: (...args) => call('create', ...args),
    update: (...args) => call('update', ...args),
    delete: (...args) => call('delete', ...args),
    bulkCreate: (...args) => call('bulkCreate', ...args),
    bulkUpdate: (...args) => call('bulkUpdate', ...args),
    updateMany: (...args) => call('updateMany', ...args),
    deleteMany: (...args) => call('deleteMany', ...args),
    importEntities: (...args) => call('importEntities', ...args),
    subscribe: (...args) => call('subscribe', ...args),
  };
}

export const Query = base44.entities.Query;

export const PunicaoDisciplinar = base44.entities.PunicaoDisciplinar;
export const TarefaOperacional = createEntityWithAliases('TarefaOperacional', ['TarefasOperacionais', 'tarefaOperacional']);
export const TarefaOperacionalDestinatario = createEntityWithAliases('TarefaOperacionalDestinatario', [
  'TarefaOperacionalDestinatarios',
  'tarefaOperacionalDestinatario',
]);
export const TarefaOperacionalHistorico = createEntityWithAliases('TarefaOperacionalHistorico', [
  'TarefaOperacionalHistoricos',
  'tarefaOperacionalHistorico',
]);

// auth sdk:
export const User = base44.auth;
