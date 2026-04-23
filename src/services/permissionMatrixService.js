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
  'matriz_permissoes',
  'permission_matrix',
  'permissions_matrix',
  'permissions',
  'permissoes',
];

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
    if (matrixKey === 'matriz_permissoes') return;
    payload[matrixKey] = { ...normalized };
  });

  return payload;
};

export const computePermissionOverrides = (effectivePermissions = {}, baseProfilePermissions = {}) => {
  return canonicalPermissionKeys.reduce((acc, key) => {
    const effective = toBooleanPermission(effectivePermissions[key]);
    const base = toBooleanPermission(baseProfilePermissions[key]);
    if (effective !== base) {
      acc[key] = effective;
    }
    return acc;
  }, {});
};

export const getPermissionMismatches = (expectedPermissions = {}, persistedSource = {}) => {
  const expected = buildPermissionsFromSource(expectedPermissions);
  const persisted = buildPermissionsFromSource(persistedSource);

  return canonicalPermissionKeys.filter((key) => expected[key] !== persisted[key]);
};

export const resolveProfilePermissions = ({ profileSource = {}, fallbackSource = {} }) => ({
  permissions: buildPermissionsFromSource(profileSource, fallbackSource),
});

export const resolveUserPermissions = ({
  userSource = {},
  profileSource = {},
  fallbackProfile = {},
  fallbackUser = {},
}) => {
  const profilePermissions = buildPermissionsFromSource(profileSource, fallbackProfile);

  const userPermissions = hasValidMatrixContent(userSource)
    ? buildPermissionsFromSource(userSource)
    : buildPermissionsFromSource(fallbackUser, profilePermissions);

  return {
    permissions: userPermissions,
    profilePermissions,
    source: hasValidMatrixContent(userSource) ? 'usuario' : 'perfil',
  };
};

export const resolveProfilePermissionsWithSnapshot = async ({
  profileSource = {},
  fallbackSource = {},
}) => resolveProfilePermissions({ profileSource, fallbackSource });

export const resolveUserPermissionsWithSnapshots = async ({
  userSource = {},
  profileSource = {},
  fallbackProfile = {},
  fallbackUser = {},
}) => resolveUserPermissions({ userSource, profileSource, fallbackProfile, fallbackUser });

export const isAdminRecoveryPermission = (permissionKey, type = 'action') => {
  if (!permissionKey || typeof permissionKey !== 'string') return false;
  const normalized = permissionKey.startsWith('acesso_') || permissionKey.startsWith('perm_')
    ? permissionKey
    : (type === 'module' ? `acesso_${permissionKey}` : `perm_${permissionKey}`);

  if (type === 'module') return ADMIN_RECOVERY_MODULE_KEYS.includes(normalized);
  return ADMIN_RECOVERY_ACTION_KEYS.includes(normalized);
};

export const upsertProfileSnapshot = async () => null;
export const upsertUserSnapshot = async () => null;
