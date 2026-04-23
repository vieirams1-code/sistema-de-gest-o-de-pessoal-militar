import { permissionStructure } from '../config/permissionStructure.js';

const toBooleanPermission = (value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0' || normalized === '') return false;
  }

  return value === true || value === 1;
};

const modulePermissionKeys = permissionStructure.flatMap((group) =>
  group.modules.map((module) => module.key)
);

const actionPermissionKeys = permissionStructure.flatMap((group) =>
  group.modules.flatMap((module) => module.actions.map((action) => action.key))
);

export const canonicalPermissionKeys = [...modulePermissionKeys, ...actionPermissionKeys];

const SPECIAL_ALIASES_BY_KEY = {
  perm_gerir_dom_pedro_ii: ['perm_gerir_fluxo_dom_pedro_ii', 'gerir_fluxo_dom_pedro_ii'],
};

const getAliasesForCanonicalKey = (key) => {
  const aliases = [];

  if (key.startsWith('perm_')) aliases.push(key.replace(/^perm_/, ''));
  if (key.startsWith('acesso_')) aliases.push(key.replace(/^acesso_/, ''));

  return [...aliases, ...(SPECIAL_ALIASES_BY_KEY[key] || [])];
};

const aliasByCanonical = canonicalPermissionKeys.reduce((acc, key) => {
  acc[key] = getAliasesForCanonicalKey(key);
  return acc;
}, {});

export const nestedMatrixKeys = [
  'matrix_v2',
  '__matrix_v2',
  'matriz_permissoes',
  'permission_matrix',
  'permissions_matrix',
  'permissions',
  'permissoes',
];

export const PROFILE_MATRIX_START_MARKER = '[SGP_PERMISSIONS_MATRIX]';
export const PROFILE_MATRIX_END_MARKER = '[/SGP_PERMISSIONS_MATRIX]';

export const ADMIN_RECOVERY_MODULE_KEYS = [
  'acesso_militares',
  'acesso_configuracoes',
];

export const ADMIN_RECOVERY_ACTION_KEYS = [
  'perm_gerir_permissoes',
  'perm_gerir_configuracoes',
];

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const isObjectRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const extractProfileMatrixFromDescription = (rawDescricao = '') => {
  const descricao = typeof rawDescricao === 'string' ? rawDescricao : '';
  const startIdx = descricao.indexOf(PROFILE_MATRIX_START_MARKER);
  const endIdx = descricao.indexOf(PROFILE_MATRIX_END_MARKER);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { cleanDescricao: descricao.trim(), matrix: null, hasMatrixBlock: false };
  }

  const before = descricao.slice(0, startIdx).trimEnd();
  const after = descricao.slice(endIdx + PROFILE_MATRIX_END_MARKER.length).trimStart();
  const cleanDescricao = [before, after].filter(Boolean).join('\n\n').trim();
  const jsonRaw = descricao
    .slice(startIdx + PROFILE_MATRIX_START_MARKER.length, endIdx)
    .trim();

  if (!jsonRaw) {
    return { cleanDescricao, matrix: null, hasMatrixBlock: true };
  }

  try {
    const parsed = JSON.parse(jsonRaw);
    if (!isObjectRecord(parsed)) {
      return { cleanDescricao, matrix: null, hasMatrixBlock: true };
    }

    return {
      cleanDescricao,
      matrix: sanitizePermissionsMatrix(parsed),
      hasMatrixBlock: true,
    };
  } catch {
    return { cleanDescricao, matrix: null, hasMatrixBlock: true };
  }
};

export const mergeProfileDescriptionWithMatrix = (cleanDescricao = '', matrix = {}) => {
  const sanitizedDescricao = typeof cleanDescricao === 'string' ? cleanDescricao.trim() : '';
  const sanitizedMatrix = sanitizePermissionsMatrix(matrix);
  const serialized = JSON.stringify(sanitizedMatrix);
  const matrixBlock = `${PROFILE_MATRIX_START_MARKER}${serialized}${PROFILE_MATRIX_END_MARKER}`;

  return sanitizedDescricao ? `${sanitizedDescricao}\n\n${matrixBlock}` : matrixBlock;
};

export const extractUserMatrixFromOverrides = (permissoes_override = {}) => {
  if (!isObjectRecord(permissoes_override)) return null;
  const matrix = permissoes_override.matrix_v2 || permissoes_override.__matrix_v2;
  if (!isObjectRecord(matrix)) return null;
  return sanitizePermissionsMatrix(matrix);
};

export const mergeUserOverridesWithMatrix = (existingOverrides = {}, matrix = {}, source = 'usuario') => {
  const baseOverrides = isObjectRecord(existingOverrides) ? { ...existingOverrides } : {};
  delete baseOverrides.__matrix_v2;
  delete baseOverrides.__source;
  baseOverrides.matrix_v2 = sanitizePermissionsMatrix(matrix);
  baseOverrides.source = source;
  return baseOverrides;
};

const collectPermissionSources = (source = {}) => {
  const rootSource = isObjectRecord(source) ? source : {};
  const matrixSource = nestedMatrixKeys
    .map((nestedKey) => rootSource[nestedKey])
    .find((candidate) => isObjectRecord(candidate));

  return matrixSource ? [matrixSource, rootSource] : [rootSource];
};

const readPermissionFromCandidate = (candidate = {}, key) => {
  if (hasOwn(candidate, key)) return toBooleanPermission(candidate[key]);

  const aliases = aliasByCanonical[key] || [];
  for (const alias of aliases) {
    if (hasOwn(candidate, alias)) return toBooleanPermission(candidate[alias]);
  }

  return null;
};

const readPermissionFromSource = (source = {}, key) => {
  const candidates = collectPermissionSources(source);

  for (const candidate of candidates) {
    const value = readPermissionFromCandidate(candidate, key);
    if (value !== null) return value;
  }

  return false;
};

const sanitizePermissionsMatrix = (source = {}) => (
  canonicalPermissionKeys.reduce((acc, key) => {
    acc[key] = readPermissionFromSource(source, key);
    return acc;
  }, {})
);

const sourceHasPermissionValue = (source = {}, key) => {
  const aliases = aliasByCanonical[key] || [];

  return collectPermissionSources(source).some((candidate) =>
    hasOwn(candidate, key) || aliases.some((alias) => hasOwn(candidate, alias))
  );
};

export const hasValidMatrixContent = (source = {}) => {
  if (!isObjectRecord(source)) return false;

  const matrix = nestedMatrixKeys
    .map((key) => source[key])
    .find((candidate) => isObjectRecord(candidate));

  if (!matrix) return false;
  return canonicalPermissionKeys.some((key) => sourceHasPermissionValue(matrix, key));
};

export const buildPermissionsFromSource = (source = {}, fallback = {}) => {
  return canonicalPermissionKeys.reduce((acc, key) => {
    const value = sourceHasPermissionValue(source, key)
      ? readPermissionFromSource(source, key)
      : readPermissionFromSource(fallback, key);

    acc[key] = toBooleanPermission(value);
    return acc;
  }, {});
};

const buildPermissionAliases = (normalizedPermissions = {}) => {
  return canonicalPermissionKeys.reduce((acc, key) => {
    const value = normalizedPermissions[key] === true;
    acc[key] = value;

    (aliasByCanonical[key] || []).forEach((alias) => {
      acc[alias] = value;
    });

    return acc;
  }, {});
};

export const buildPermissionPayload = (source = {}, { includeLegacy = true } = {}) => {
  const normalized = buildPermissionsFromSource(source);
  const payload = {
    matriz_permissoes: { ...normalized },
  };

  if (!includeLegacy) return payload;

  Object.assign(payload, buildPermissionAliases(normalized));
  nestedMatrixKeys.forEach((matrixKey) => {
    if (matrixKey === 'matriz_permissoes' || matrixKey.startsWith('__')) return;
    payload[matrixKey] = { ...normalized };
  });

  return payload;
};

export const getPermissionMismatches = (expectedPermissions = {}, persistedSource = {}) => {
  const expected = buildPermissionsFromSource(expectedPermissions);
  const persisted = buildPermissionsFromSource(persistedSource);

  return canonicalPermissionKeys.filter((key) => expected[key] !== persisted[key]);
};

export const resolveProfilePermissions = ({ profileSource = {}, fallbackSource = {} }) => ({
  permissions: (() => {
    const parsedProfileDescription = extractProfileMatrixFromDescription(profileSource?.descricao);
    if (parsedProfileDescription.matrix) return buildPermissionsFromSource(parsedProfileDescription.matrix);
    return buildPermissionsFromSource(profileSource, fallbackSource);
  })(),
});

export const resolveUserPermissions = ({
  userSource = {},
  profileSource = {},
  fallbackProfile = {},
}) => {
  const profilePermissions = resolveProfilePermissions({
    profileSource,
    fallbackSource: fallbackProfile,
  }).permissions;
  const userMatrixFromOverrides = extractUserMatrixFromOverrides(userSource?.permissoes_override);
  const hasUserLegacyMatrix = hasValidMatrixContent(userSource);
  const fallbackPermissions = buildPermissionsFromSource(fallbackProfile);
  const profilePermissionsWithFallback = buildPermissionsFromSource(profilePermissions, fallbackPermissions);

  const userPermissions = userMatrixFromOverrides
    ? buildPermissionsFromSource(userMatrixFromOverrides, profilePermissionsWithFallback)
    : hasUserLegacyMatrix
      ? buildPermissionsFromSource(userSource, profilePermissionsWithFallback)
      : profilePermissionsWithFallback;

  return {
    permissions: userPermissions,
    profilePermissions,
    source: userMatrixFromOverrides || hasUserLegacyMatrix ? 'usuario' : 'perfil',
  };
};

export const isAdminRecoveryPermission = (permissionKey, type = 'action') => {
  if (!permissionKey || typeof permissionKey !== 'string') return false;
  const normalized = permissionKey.startsWith('acesso_') || permissionKey.startsWith('perm_')
    ? permissionKey
    : (type === 'module' ? `acesso_${permissionKey}` : `perm_${permissionKey}`);

  if (type === 'module') return ADMIN_RECOVERY_MODULE_KEYS.includes(normalized);
  return ADMIN_RECOVERY_ACTION_KEYS.includes(normalized);
};
