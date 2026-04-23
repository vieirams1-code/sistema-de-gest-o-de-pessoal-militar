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

  if (key === 'perm_gerir_dom_pedro_ii') {
    aliases.push('perm_gerir_fluxo_dom_pedro_ii', 'gerir_fluxo_dom_pedro_ii');
  }

  acc[key] = aliases;
  return acc;
}, {});

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const getPermissionFromSource = (source = {}, key) => {
  if (hasOwn(source, key)) return toBooleanPermission(source[key]);

  const aliases = aliasByCanonical[key] || [];
  for (const alias of aliases) {
    if (hasOwn(source, alias)) return toBooleanPermission(source[alias]);
  }

  return false;
};

export const buildPermissionsFromSource = (source = {}, fallback = {}) => {
  return canonicalPermissionKeys.reduce((acc, key) => {
    const hasPrimaryOrAlias = hasOwn(source, key) || (aliasByCanonical[key] || []).some((alias) => hasOwn(source, alias));
    const value = hasPrimaryOrAlias ? getPermissionFromSource(source, key) : getPermissionFromSource(fallback, key);
    acc[key] = toBooleanPermission(value);
    return acc;
  }, {});
};

export const buildPermissionPayload = (source = {}) => {
  const normalized = buildPermissionsFromSource(source);

  return canonicalPermissionKeys.reduce((acc, key) => {
    const value = normalized[key] === true;
    acc[key] = value;

    (aliasByCanonical[key] || []).forEach((alias) => {
      acc[alias] = value;
    });

    return acc;
  }, {});
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
    const hasLegacyValue = hasOwn(userPermissions, key) || (aliasByCanonical[key] || []).some((alias) => hasOwn(userPermissions, alias));
    if (hasLegacyValue) merged[key] = legacyUser[key];

    const hasOverrideValue = hasOwn(userOverrides, key) || (aliasByCanonical[key] || []).some((alias) => hasOwn(userOverrides, alias));
    if (hasOverrideValue) merged[key] = explicitOverrides[key];
  });

  return merged;
};
