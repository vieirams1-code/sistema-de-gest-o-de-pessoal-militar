import { secureCreate, secureDelete, secureGetById, secureList, secureUpdate } from '@/server/authz';

export function listUsuarioAcessos(query = {}, options = {}) {
  return secureList('UsuarioAcesso', query, options);
}

export function getUsuarioAcessoById(id, options = {}) {
  return secureGetById('UsuarioAcesso', id, options);
}

export function createUsuarioAcesso(payload, options = {}) {
  return secureCreate('UsuarioAcesso', payload, options);
}

export function updateUsuarioAcesso(id, payload, options = {}) {
  return secureUpdate('UsuarioAcesso', id, payload, options);
}

export function deleteUsuarioAcesso(id, options = {}) {
  return secureDelete('UsuarioAcesso', id, options);
}
