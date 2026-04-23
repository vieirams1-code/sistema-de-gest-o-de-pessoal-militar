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

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const isObjectRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const collectPermissionSources = (source = {}) => {
  const rootSource = isObjectRecord(source) ? source : {};
  const sources = [rootSource];

  nestedMatrixKeys.forEach((nestedKey) => {
    const nestedSource = rootSource[nestedKey];
    if (isObjectRecord(nestedSource)) {
      sources.push(nestedSource);
    }
  });

  return sources;
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

export const buildPermissionPayload = (source = {}) => {
  const normalized = buildPermissionsFromSource(source);
  const payload = buildPermissionAliases(normalized);

  nestedMatrixKeys.forEach((matrixKey) => {
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

export const mergeProfileAndUserPermissions = ({
  profilePermissions = {},
  userPermissions = {},
  userOverrides = {},
}) => {
  const profile = buildPermissionsFromSource(profilePermissions);
  const merged = { ...profile };
  const legacyUser = buildPermissionsFromSource(userPermissions);
  const explicitOverrides = buildPermissionsFromSource(userOverrides);

  canonicalPermissionKeys.forEach((key) => {
    const hasLegacyValue = sourceHasPermissionValue(userPermissions, key);
    if (hasLegacyValue) merged[key] = legacyUser[key];

    const hasOverrideValue = sourceHasPermissionValue(userOverrides, key);
    if (hasOverrideValue) merged[key] = explicitOverrides[key];
  });

  return merged;
};
