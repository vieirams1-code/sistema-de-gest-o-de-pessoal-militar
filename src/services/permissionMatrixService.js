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

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_PROFILE_ENTITY = 'PerfilPermissaoSnapshot';
export const SNAPSHOT_USER_ENTITY = 'UsuarioPermissaoSnapshot';
export const SNAPSHOT_RUNTIME_ENABLED = false;
export const ADMIN_RECOVERY_MODULE_KEYS = ['acesso_militares'];
export const ADMIN_RECOVERY_ACTION_KEYS = ['perm_gerir_permissoes'];

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

const parseSnapshotMatrix = (snapshot) => {
  if (!snapshot) return {};
  const matrix = snapshot.matriz_permissoes;
  if (isObjectRecord(matrix)) return matrix;

  if (typeof matrix === 'string') {
    try {
      const parsed = JSON.parse(matrix);
      return isObjectRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
};

export const isValidPermissionSnapshot = (snapshot) => {
  if (!snapshot) return false;
  const matrix = parseSnapshotMatrix(snapshot);
  if (!isObjectRecord(matrix)) return false;

  return canonicalPermissionKeys.some((key) => sourceHasPermissionValue(matrix, key));
};

export const isAdminRecoveryPermission = (permissionKey, type = 'action') => {
  if (!permissionKey || typeof permissionKey !== 'string') return false;
  const normalized = permissionKey.startsWith('acesso_') || permissionKey.startsWith('perm_')
    ? permissionKey
    : (type === 'module' ? `acesso_${permissionKey}` : `perm_${permissionKey}`);

  if (type === 'module') return ADMIN_RECOVERY_MODULE_KEYS.includes(normalized);
  return ADMIN_RECOVERY_ACTION_KEYS.includes(normalized);
};

const getSnapshotEntity = (base44, entityName) => {
  if (!SNAPSHOT_RUNTIME_ENABLED || !base44?.entities || !entityName) return null;

  try {
    return base44.entities[entityName] || null;
  } catch {
    return null;
  }
};

const findLatestSnapshot = (records = []) => {
  if (!Array.isArray(records) || records.length === 0) return null;
  return [...records].sort((a, b) => {
    const aUpdated = new Date(a?.updated_at || a?.updatedAt || a?.created_at || 0).getTime();
    const bUpdated = new Date(b?.updated_at || b?.updatedAt || b?.created_at || 0).getTime();
    return bUpdated - aUpdated;
  })[0];
};

export const getProfileSnapshot = async (base44, perfilId) => {
  if (!perfilId) return null;
  const entity = getSnapshotEntity(base44, SNAPSHOT_PROFILE_ENTITY);
  if (!entity?.filter) return null;
  const records = await entity.filter({ perfil_id: perfilId });
  return findLatestSnapshot(records);
};

export const getUserSnapshot = async (base44, usuarioAcessoId, userId = null) => {
  const entity = getSnapshotEntity(base44, SNAPSHOT_USER_ENTITY);
  if (!entity?.filter) return null;

  if (usuarioAcessoId) {
    const byAcesso = await entity.filter({ usuario_acesso_id: usuarioAcessoId });
    const found = findLatestSnapshot(byAcesso);
    if (found) return found;
  }

  if (userId) {
    const byUser = await entity.filter({ user_id: userId });
    return findLatestSnapshot(byUser);
  }

  return null;
};

export const resolveProfilePermissionsWithSnapshot = async ({
  base44,
  profileSource = {},
  fallbackSource = {},
}) => {
  if (!SNAPSHOT_RUNTIME_ENABLED) {
    return {
      permissions: buildPermissionsFromSource(profileSource, fallbackSource),
      snapshot: null,
    };
  }

  const snapshot = await getProfileSnapshot(base44, profileSource?.id);
  const snapshotIsValid = isValidPermissionSnapshot(snapshot);
  const snapshotPermissions = buildPermissionsFromSource(parseSnapshotMatrix(snapshot));
  const legacyPermissions = buildPermissionsFromSource(profileSource, fallbackSource);
  return {
    permissions: snapshotIsValid ? snapshotPermissions : legacyPermissions,
    snapshot: snapshotIsValid ? snapshot : null,
  };
};

export const resolveUserPermissionsWithSnapshots = async ({
  base44,
  userSource = {},
  profileSource = {},
  fallbackProfile = {},
  fallbackUser = {},
}) => {
  if (!SNAPSHOT_RUNTIME_ENABLED) {
    const profilePermissions = buildPermissionsFromSource(profileSource, fallbackProfile);
    return {
      permissions: mergeProfileAndUserPermissions({
        profilePermissions,
        userPermissions: userSource,
        userOverrides: userSource?.permissoes_override || fallbackUser || {},
      }),
      profilePermissions,
      userSnapshot: null,
      profileSnapshot: null,
    };
  }

  const [profileSnapshot, userSnapshot] = await Promise.all([
    getProfileSnapshot(base44, profileSource?.id),
    getUserSnapshot(base44, userSource?.id, userSource?.user_id || userSource?.user_email || null),
  ]);

  const profileSnapshotIsValid = isValidPermissionSnapshot(profileSnapshot);
  const userSnapshotIsValid = isValidPermissionSnapshot(userSnapshot);
  const profileFromSnapshot = buildPermissionsFromSource(parseSnapshotMatrix(profileSnapshot));
  const profileLegacy = buildPermissionsFromSource(profileSource, fallbackProfile);
  const profilePermissions = profileSnapshotIsValid ? profileFromSnapshot : profileLegacy;

  if (userSnapshotIsValid) {
    return {
      permissions: buildPermissionsFromSource(parseSnapshotMatrix(userSnapshot)),
      profilePermissions,
      userSnapshot,
      profileSnapshot: profileSnapshotIsValid ? profileSnapshot : null,
    };
  }

  return {
    permissions: mergeProfileAndUserPermissions({
      profilePermissions,
      userPermissions: userSource,
      userOverrides: userSource?.permissoes_override || fallbackUser || {},
    }),
    profilePermissions,
    userSnapshot: null,
    profileSnapshot: profileSnapshotIsValid ? profileSnapshot : null,
  };
};

const serializeMatrix = (normalizedPermissions = {}) => ({ ...buildPermissionsFromSource(normalizedPermissions) });

export const upsertProfileSnapshot = async ({
  base44,
  perfilId,
  matrizPermissoes,
  updatedBy = '',
  versao = SNAPSHOT_VERSION,
}) => {
  if (!SNAPSHOT_RUNTIME_ENABLED) return null;
  const entity = getSnapshotEntity(base44, SNAPSHOT_PROFILE_ENTITY);
  if (!entity || !perfilId) return null;

  const payload = {
    perfil_id: perfilId,
    matriz_permissoes: serializeMatrix(matrizPermissoes),
    versao,
    updated_by: updatedBy || '',
    updated_at: new Date().toISOString(),
  };

  const current = await getProfileSnapshot(base44, perfilId);
  if (current?.id && entity.update) return entity.update(current.id, payload);
  if (entity.create) return entity.create(payload);
  return null;
};

export const upsertUserSnapshot = async ({
  base44,
  usuarioAcessoId,
  userId = '',
  matrizPermissoes,
  updatedBy = '',
  versao = SNAPSHOT_VERSION,
}) => {
  if (!SNAPSHOT_RUNTIME_ENABLED) return null;
  const entity = getSnapshotEntity(base44, SNAPSHOT_USER_ENTITY);
  if (!entity || (!usuarioAcessoId && !userId)) return null;

  const payload = {
    usuario_acesso_id: usuarioAcessoId || '',
    user_id: userId || '',
    matriz_permissoes: serializeMatrix(matrizPermissoes),
    versao,
    updated_by: updatedBy || '',
    updated_at: new Date().toISOString(),
  };

  const current = await getUserSnapshot(base44, usuarioAcessoId, userId);
  if (current?.id && entity.update) return entity.update(current.id, payload);
  if (entity.create) return entity.create(payload);
  return null;
};
