import { listByFilter, uniqById } from './utils';

async function listScopedMilitares(context, query = {}, options = {}) {
  if (context.isAdmin) {
    return listByFilter('Militar', query, options);
  }

  const batches = [];

  if (context.modoAcesso === 'setor' && context.scopeRootId) {
    batches.push(listByFilter('Militar', { ...query, grupamento_id: context.scopeRootId }, options));
    batches.push(listByFilter('Militar', { ...query, subgrupamento_id: context.scopeRootId }, options));
  } else if (context.modoAcesso === 'subsetor' && context.scopeRootId) {
    batches.push(listByFilter('Militar', { ...query, subgrupamento_id: context.scopeRootId }, options));
    for (const unidadeId of context.scopeSubgrupamentoIds || []) {
      batches.push(listByFilter('Militar', { ...query, subgrupamento_id: unidadeId }, options));
    }
  } else if (context.modoAcesso === 'unidade' && context.scopeRootId) {
    batches.push(listByFilter('Militar', { ...query, subgrupamento_id: context.scopeRootId }, options));
  } else if (context.modoAcesso === 'proprio') {
    if (context.linkedMilitarId) {
      batches.push(listByFilter('Militar', { ...query, id: context.linkedMilitarId }, options));
    }
    for (const email of [context.authEmail, context.linkedMilitarEmail].filter(Boolean)) {
      batches.push(listByFilter('Militar', { ...query, email }, options));
      batches.push(listByFilter('Militar', { ...query, email_particular: email }, options));
      batches.push(listByFilter('Militar', { ...query, email_funcional: email }, options));
      batches.push(listByFilter('Militar', { ...query, created_by: email }, options));
      batches.push(listByFilter('Militar', { ...query, militar_email: email }, options));
    }
  }

  return uniqById((await Promise.all(batches)).flat());
}

export async function buildScopedList(entityName, context, query = {}, options = {}) {
  if (entityName === 'Militar') {
    return listScopedMilitares(context, query, options);
  }

  const scopedMilitares = await listScopedMilitares(context, {}, options);
  const militarIds = scopedMilitares.map((row) => row.id).filter(Boolean);
  if (!militarIds.length) {
    return [];
  }

  const batches = await Promise.all(
    militarIds.map((militarId) => listByFilter(entityName, { ...query, militar_id: militarId }, options))
  );

  return uniqById(batches.flat());
}
