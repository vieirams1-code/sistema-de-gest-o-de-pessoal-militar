import { base44 as defaultBase44 } from '@/api/base44Client';
import { CANONICAL_ACTION_PERMISSIONS, CANONICAL_MODULE_PERMISSIONS } from './constants';
import { ENTITY_ACTION_RULES } from './entityActionRules';
import { ENTITY_MODULE_REGISTRY } from './entityModuleRegistry';

export function getBase44Client(options = {}) {
  return options.base44Client || defaultBase44;
}

export function getEntityGateway(entityName, options = {}) {
  const client = getBase44Client(options);
  const entities = options.useServiceRole === false
    ? client.entities
    : client.asServiceRole?.entities || client.entities;

  return entities?.[entityName] || null;
}

export async function getRecordById(entityName, id, options = {}) {
  const entity = getEntityGateway(entityName, options);
  if (!entity || !id) {
    return null;
  }

  if (typeof entity.getById === 'function') {
    return entity.getById(id);
  }

  if (typeof entity.get === 'function') {
    return entity.get(id);
  }

  if (typeof entity.filter === 'function') {
    const rows = await entity.filter({ id });
    return rows?.[0] || null;
  }

  return null;
}

export async function listByFilter(entityName, query = {}, options = {}) {
  const entity = getEntityGateway(entityName, options);
  if (!entity || typeof entity.filter !== 'function') {
    return [];
  }

  const args = [query];
  if (options.sort) {
    args.push(options.sort);
  }
  if (options.limit != null) {
    if (!options.sort) {
      args.push(undefined);
    }
    args.push(options.limit);
  }

  return entity.filter(...args);
}

export async function listAll(entityName, options = {}) {
  const entity = getEntityGateway(entityName, options);
  if (!entity) {
    return [];
  }

  if (typeof entity.list === 'function') {
    const args = [];
    if (options.sort) {
      args.push(options.sort);
    }
    if (options.limit != null) {
      if (!options.sort) {
        args.push(undefined);
      }
      args.push(options.limit);
    }
    return entity.list(...args);
  }

  return listByFilter(entityName, {}, options);
}

export async function createRecord(entityName, payload, options = {}) {
  const entity = getEntityGateway(entityName, options);
  return entity.create(payload);
}

export async function updateRecord(entityName, id, payload, options = {}) {
  const entity = getEntityGateway(entityName, options);
  return entity.update(id, payload);
}

export async function deleteRecord(entityName, id, options = {}) {
  const entity = getEntityGateway(entityName, options);
  return entity.delete(id);
}

export function uniqById(records = []) {
  const ids = new Set();
  return records.filter((record) => {
    if (!record?.id || ids.has(record.id)) {
      return false;
    }
    ids.add(record.id);
    return true;
  });
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

export function isLegacyAdminUser(authUser) {
  return authUser?.role === 'admin' || authUser?.isAdmin === true;
}

export function buildModuleAccessSet(usuarioAcesso, isAdminFallback = false) {
  const modules = new Set();

  if (isAdminFallback) {
    for (const key of CANONICAL_MODULE_PERMISSIONS) {
      modules.add(key);
    }
    return modules;
  }

  for (const key of CANONICAL_MODULE_PERMISSIONS) {
    if (usuarioAcesso?.tipo_acesso === 'admin') {
      if (usuarioAcesso[key] !== false) {
        modules.add(key);
      }
      continue;
    }

    if (usuarioAcesso?.[key] === true) {
      modules.add(key);
    }
  }

  return modules;
}

export function buildActionAccessSet(usuarioAcesso, isAdminFallback = false) {
  const actions = new Set();

  if (isAdminFallback) {
    for (const key of CANONICAL_ACTION_PERMISSIONS) {
      actions.add(key);
    }
    return actions;
  }

  for (const key of CANONICAL_ACTION_PERMISSIONS) {
    if (usuarioAcesso?.tipo_acesso === 'admin') {
      if (usuarioAcesso[key] !== false) {
        actions.add(key);
      }
      continue;
    }

    if (usuarioAcesso?.[key] === true) {
      actions.add(key);
    }
  }

  return actions;
}

export function resolveModulePermissionKey(moduleOrEntity) {
  if (!moduleOrEntity) {
    return null;
  }

  if (moduleOrEntity.startsWith?.('acesso_')) {
    return moduleOrEntity;
  }

  return `acesso_${ENTITY_MODULE_REGISTRY[moduleOrEntity] || moduleOrEntity}`;
}

export function resolveActionPermissionKey(actionOrRuleKey) {
  if (!actionOrRuleKey) {
    return null;
  }

  if (actionOrRuleKey.startsWith?.('perm_')) {
    return actionOrRuleKey;
  }

  return ENTITY_ACTION_RULES[actionOrRuleKey] || `perm_${actionOrRuleKey}`;
}

export function matchesEmailFallback(record, emails = []) {
  const candidates = [
    record?.email,
    record?.email_particular,
    record?.email_funcional,
    record?.militar_email,
    record?.user_email,
    record?.usuario_email,
    record?.created_by,
  ]
    .map(normalizeEmail)
    .filter(Boolean);

  const known = emails.map(normalizeEmail).filter(Boolean);
  return known.some((email) => candidates.includes(email));
}

export async function loadSubgrupamentos(options = {}) {
  const rows = await listAll('Subgrupamento', { ...options, sort: options.sort || 'nome' });
  return Array.isArray(rows) ? rows : [];
}
