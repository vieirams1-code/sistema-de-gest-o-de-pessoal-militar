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

const aliasByCanonical = canonicalPermissionKeys.reduce((acc, key) => {
  const aliases = [];

  if (key.startsWith('perm_')) {
    aliases.push(key.replace(/^perm_/, ''));
  }

  if (key.startsWith('acesso_')) {
    aliases.push(key.replace(/^acesso_/, ''));
  }

  if (key === 'perm_gerir_dom_pedro_ii') {
    aliases.push('perm_gerir_fluxo_dom_pedro_ii', 'gerir_fluxo_dom_pedro_ii');
  }

  acc[key] = aliases;
  return acc;
}, {});

const nestedMatrixKeys = [
  'matriz_permissoes',
  'permission_matrix',
  'permissions_matrix',
  'permissions',
  'permissoes',
];

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const collectPermissionSources = (source = {}) => {
  const sources = [source];

  nestedMatrixKeys.forEach((nestedKey) => {
    const nested = source?.[nestedKey];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      sources.push(nested);
    }
  });

  return sources;
};

const getPermissionFromCandidate = (candidate = {}, key) => {
  if (hasOwn(candidate, key)) return toBooleanPermission(candidate[key]);

  const aliases = aliasByCanonical[key] || [];
  for (const alias of aliases) {
    if (hasOwn(candidate, alias)) return toBooleanPermission(candidate[alias]);
  }

  return null;
};

const getPermissionFromSource = (source = {}, key) => {
  const sources = collectPermissionSources(source);

  for (const candidate of sources) {
    const value = getPermissionFromCandidate(candidate, key);
    if (value !== null) return value;
  }

  return false;
};

const hasPermissionInSource = (source = {}, key) => {
  const aliases = aliasByCanonical[key] || [];

  return collectPermissionSources(source).some((candidate) =>
    hasOwn(candidate, key) || aliases.some((alias) => hasOwn(candidate, alias))
  );
};

export const buildPermissionsFromSource = (source = {}, fallback = {}) => {
  return canonicalPermissionKeys.reduce((acc, key) => {
    const value = hasPermissionInSource(source, key)
      ? getPermissionFromSource(source, key)
      : getPermissionFromSource(fallback, key);
    acc[key] = toBooleanPermission(value);
    return acc;
  }, {});
};

export const buildPermissionPayload = (source = {}) => {
  const normalized = buildPermissionsFromSource(source);

  const payload = canonicalPermissionKeys.reduce((acc, key) => {
    const value = normalized[key] === true;
    acc[key] = value;

    (aliasByCanonical[key] || []).forEach((alias) => {
      acc[alias] = value;
    });

    return acc;
  }, {});

  payload.matriz_permissoes = normalized;
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
    const hasLegacyValue = hasPermissionInSource(userPermissions, key);
    if (hasLegacyValue) merged[key] = legacyUser[key];

    const hasOverrideValue = hasPermissionInSource(userOverrides, key);
    if (hasOverrideValue) merged[key] = explicitOverrides[key];
  });

  return merged;
};
