import { secureCreate, secureDelete, secureGetById, secureList, secureUpdate } from '@/server/authz';

export function listMilitares(query = {}, options = {}) {
  return secureList('Militar', query, options);
}

export function getMilitarById(id, options = {}) {
  return secureGetById('Militar', id, options);
}

export function createMilitar(payload, options = {}) {
  return secureCreate('Militar', payload, options);
}

export function updateMilitar(id, payload, options = {}) {
  return secureUpdate('Militar', id, payload, options);
}

export function deleteMilitar(id, options = {}) {
  return secureDelete('Militar', id, options);
}
