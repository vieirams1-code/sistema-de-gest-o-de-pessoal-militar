import {
  COMUNICACOES_ACCESS_PERMISSION,
  COMUNICACOES_MODULE_KEY,
} from "./comunicacoes.constants";

function extractPermissions(currentUser) {
  if (!currentUser) return [];

  if (Array.isArray(currentUser.permissions)) {
    return currentUser.permissions;
  }

  if (Array.isArray(currentUser.permissoes)) {
    return currentUser.permissoes;
  }

  return [];
}

export function isComunicacoesFeatureEnabled(featureFlags) {
  return featureFlags?.[COMUNICACOES_MODULE_KEY] === true;
}

export function hasComunicacoesPermission(currentUser) {
  const permissions = extractPermissions(currentUser);
  return permissions.includes(COMUNICACOES_ACCESS_PERMISSION);
}

export function canAccessComunicacoes({ currentUser, featureFlags }) {
  return (
    isComunicacoesFeatureEnabled(featureFlags) &&
    hasComunicacoesPermission(currentUser)
  );
}
