import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isAdminRecoveryPermission,
  buildPermissionPayload,
  buildPermissionsFromSource,
  computePermissionOverrides,
  getPermissionMismatches,
  getProfileSnapshot,
  getUserSnapshot,
  isValidPermissionSnapshot,
  mergeProfileAndUserPermissions,
  nestedMatrixKeys,
  resolveProfilePermissionsWithSnapshot,
  resolveUserPermissionsWithSnapshots,
  upsertProfileSnapshot,
  upsertUserSnapshot,
} from '../permissionMatrixService.js';

test('normaliza chaves granulares de medalhas com e sem prefixo perm_', () => {
  const normalized = buildPermissionsFromSource({
    indicar_medalhas: true,
    conceder_medalhas: '1',
    resetar_indicacoes_medalhas: 'true',
    gerir_impedimentos_medalha: 1,
    gerir_fluxo_dom_pedro_ii: true,
    exportar_medalhas: 'true',
  });

  assert.equal(normalized.perm_indicar_medalhas, true);
  assert.equal(normalized.perm_conceder_medalhas, true);
  assert.equal(normalized.perm_resetar_indicacoes_medalhas, true);
  assert.equal(normalized.perm_gerir_impedimentos_medalha, true);
  assert.equal(normalized.perm_gerir_dom_pedro_ii, true);
  assert.equal(normalized.perm_exportar_medalhas, true);
});

test('normaliza chaves de acesso_* usando alias sem prefixo', () => {
  const normalized = buildPermissionsFromSource({
    folha_alteracoes: true,
    militares: '1',
  });

  assert.equal(normalized.acesso_folha_alteracoes, true);
  assert.equal(normalized.acesso_militares, true);
});

test('payload de persistência inclui aliases legados para manter compatibilidade', () => {
  const payload = buildPermissionPayload({
    perm_indicar_medalhas: true,
    perm_gerir_dom_pedro_ii: true,
    acesso_folha_alteracoes: true,
  });

  assert.equal(payload.perm_indicar_medalhas, true);
  assert.equal(payload.indicar_medalhas, true);
  assert.equal(payload.perm_gerir_dom_pedro_ii, true);
  assert.equal(payload.gerir_dom_pedro_ii, true);
  assert.equal(payload.perm_gerir_fluxo_dom_pedro_ii, true);
  assert.equal(payload.gerir_fluxo_dom_pedro_ii, true);
  assert.equal(payload.acesso_folha_alteracoes, true);
  assert.equal(payload.folha_alteracoes, true);

  nestedMatrixKeys.forEach((matrixKey) => {
    assert.equal(payload[matrixKey].perm_indicar_medalhas, true);
    assert.equal(payload[matrixKey].acesso_folha_alteracoes, true);
  });
});

test('merge aplica perfil base e sobrescreve com override explícito do usuário', () => {
  const merged = mergeProfileAndUserPermissions({
    profilePermissions: {
      perm_indicar_medalhas: true,
      perm_conceder_medalhas: true,
      perm_exportar_medalhas: false,
    },
    userPermissions: {
      perm_exportar_medalhas: true,
    },
    userOverrides: {
      perm_conceder_medalhas: false,
    },
  });

  assert.equal(merged.perm_indicar_medalhas, true);
  assert.equal(merged.perm_exportar_medalhas, true);
  assert.equal(merged.perm_conceder_medalhas, false);
});

test('calcula diff determinístico entre perfil base e permissões finais do usuário', () => {
  const diff = computePermissionOverrides(
    {
      perm_indicar_medalhas: true,
      perm_conceder_medalhas: false,
      perm_resetar_indicacoes_medalhas: true,
    },
    {
      perm_indicar_medalhas: true,
      perm_conceder_medalhas: true,
      perm_resetar_indicacoes_medalhas: false,
    }
  );

  assert.deepEqual(diff, {
    perm_conceder_medalhas: false,
    perm_resetar_indicacoes_medalhas: true,
  });
});

test('normaliza permissões a partir das fontes aninhadas suportadas', () => {
  const normalized = buildPermissionsFromSource({
    permissions: {
      folha_alteracoes: true,
    },
    permission_matrix: {
      exportar_medalhas: true,
    },
  });

  assert.equal(normalized.acesso_folha_alteracoes, true);
  assert.equal(normalized.perm_exportar_medalhas, true);
});

test('buildPermissionsFromSource usa fallback inclusive quando está aninhado', () => {
  const normalized = buildPermissionsFromSource(
    {},
    {
      matriz_permissoes: {
        acesso_folha_alteracoes: true,
      },
    }
  );

  assert.equal(normalized.acesso_folha_alteracoes, true);
});

test('detecta divergências entre esperado e recarregado usando fonte aninhada', () => {
  const mismatches = getPermissionMismatches(
    { acesso_folha_alteracoes: true, acesso_militares: true },
    { permissoes: { acesso_militares: true, acesso_folha_alteracoes: false } }
  );

  assert.deepEqual(mismatches, ['acesso_folha_alteracoes']);
});

const createMockBase44 = () => {
  const profileSnapshots = [];
  const userSnapshots = [];
  let idCounter = 1;

  const createEntityApi = (store) => ({
    async filter(where = {}) {
      return store.filter((item) => Object.entries(where).every(([key, value]) => item[key] === value));
    },
    async create(payload) {
      const item = { id: `snap_${idCounter++}`, ...payload };
      store.push(item);
      return item;
    },
    async update(id, payload) {
      const idx = store.findIndex((item) => item.id === id);
      if (idx < 0) throw new Error('snapshot not found');
      store[idx] = { ...store[idx], ...payload };
      return store[idx];
    },
  });

  return {
    entities: {
      PerfilPermissaoSnapshot: createEntityApi(profileSnapshots),
      UsuarioPermissaoSnapshot: createEntityApi(userSnapshots),
    },
  };
};

test('cria e lê snapshot de perfil como fonte prioritária', async () => {
  const base44 = createMockBase44();
  await upsertProfileSnapshot({
    base44,
    perfilId: 'perfil_1',
    matrizPermissoes: { acesso_folha_alteracoes: true, perm_indicar_medalhas: true },
    updatedBy: 'tester',
  });

  const snap = await getProfileSnapshot(base44, 'perfil_1');
  assert.equal(snap.perfil_id, 'perfil_1');

  const resolved = await resolveProfilePermissionsWithSnapshot({
    base44,
    profileSource: { id: 'perfil_1', acesso_folha_alteracoes: false, perm_indicar_medalhas: false },
  });

  assert.equal(resolved.permissions.acesso_folha_alteracoes, true);
  assert.equal(resolved.permissions.perm_indicar_medalhas, true);
});

test('save mantém snapshot como fonte de verdade para chaves instáveis', async () => {
  const base44 = createMockBase44();
  await upsertUserSnapshot({
    base44,
    usuarioAcessoId: 'ua_1',
    userId: 'militar@pm.rj',
    matrizPermissoes: {
      acesso_folha_alteracoes: true,
      perm_indicar_medalhas: true,
      perm_conceder_medalhas: true,
      perm_resetar_indicacoes_medalhas: true,
      perm_gerir_impedimentos_medalha: true,
      perm_gerir_dom_pedro_ii: true,
      perm_exportar_medalhas: true,
      perm_reset_operacional: true,
    },
  });

  const resolved = await resolveUserPermissionsWithSnapshots({
    base44,
    userSource: { id: 'ua_1', acesso_folha_alteracoes: false },
    profileSource: {},
  });

  assert.equal(resolved.permissions.acesso_folha_alteracoes, true);
  assert.equal(resolved.permissions.perm_indicar_medalhas, true);
  assert.equal(resolved.permissions.perm_conceder_medalhas, true);
  assert.equal(resolved.permissions.perm_resetar_indicacoes_medalhas, true);
  assert.equal(resolved.permissions.perm_gerir_impedimentos_medalha, true);
  assert.equal(resolved.permissions.perm_gerir_dom_pedro_ii, true);
  assert.equal(resolved.permissions.perm_exportar_medalhas, true);
  assert.equal(resolved.permissions.perm_reset_operacional, true);
});

test('merge perfil + usuário via snapshot respeita prioridade usuário > perfil > fallback', async () => {
  const base44 = createMockBase44();
  await upsertProfileSnapshot({
    base44,
    perfilId: 'perfil_2',
    matrizPermissoes: {
      acesso_folha_alteracoes: true,
      perm_indicar_medalhas: false,
      perm_exportar_medalhas: false,
    },
  });
  await upsertUserSnapshot({
    base44,
    usuarioAcessoId: 'ua_2',
    userId: 'user_2',
    matrizPermissoes: {
      perm_indicar_medalhas: true,
    },
  });

  const merged = await resolveUserPermissionsWithSnapshots({
    base44,
    userSource: { id: 'ua_2', user_id: 'user_2', perm_indicar_medalhas: false, perm_exportar_medalhas: true },
    profileSource: { id: 'perfil_2' },
  });

  assert.equal(merged.permissions.perm_indicar_medalhas, true);
  assert.equal(merged.permissions.acesso_folha_alteracoes, false);
  assert.equal(merged.permissions.perm_exportar_medalhas, false);

  const snapByUser = await getUserSnapshot(base44, 'ua_2', 'user_2');
  assert.equal(snapByUser.usuario_acesso_id, 'ua_2');
});

test('isValidPermissionSnapshot só aceita snapshot com matriz canônica consistente', () => {
  assert.equal(isValidPermissionSnapshot(null), false);
  assert.equal(isValidPermissionSnapshot({}), false);
  assert.equal(isValidPermissionSnapshot({ matriz_permissoes: {} }), false);
  assert.equal(isValidPermissionSnapshot({ matriz_permissoes: { qualquer_coisa: true } }), false);
  assert.equal(isValidPermissionSnapshot({ matriz_permissoes: { acesso_militares: true } }), true);
});

test('ignora snapshot de usuário vazio e usa fallback legado', async () => {
  const base44 = createMockBase44();
  await base44.entities.UsuarioPermissaoSnapshot.create({
    usuario_acesso_id: 'ua_legacy',
    user_id: 'user_legacy',
    matriz_permissoes: {},
    updated_at: new Date().toISOString(),
  });

  const resolved = await resolveUserPermissionsWithSnapshots({
    base44,
    userSource: { id: 'ua_legacy', user_id: 'user_legacy', acesso_militares: true },
    profileSource: {},
  });

  assert.equal(resolved.userSnapshot, null);
  assert.equal(resolved.permissions.acesso_militares, true);
});

test('ignora snapshot de perfil incompleto e usa fallback legado do perfil', async () => {
  const base44 = createMockBase44();
  await base44.entities.PerfilPermissaoSnapshot.create({
    perfil_id: 'perfil_incompleto',
    matriz_permissoes: { metadado: 'sem_chaves_canônicas' },
    updated_at: new Date().toISOString(),
  });

  const resolved = await resolveProfilePermissionsWithSnapshot({
    base44,
    profileSource: { id: 'perfil_incompleto', acesso_militares: true },
  });

  assert.equal(resolved.snapshot, null);
  assert.equal(resolved.permissions.acesso_militares, true);
});

test('modo de recuperação admin mantém acesso mínimo crítico', () => {
  assert.equal(isAdminRecoveryPermission('acesso_militares', 'module'), true);
  assert.equal(isAdminRecoveryPermission('militares', 'module'), true);
  assert.equal(isAdminRecoveryPermission('perm_gerir_permissoes', 'action'), true);
  assert.equal(isAdminRecoveryPermission('gerir_permissoes', 'action'), true);
  assert.equal(isAdminRecoveryPermission('perm_gerir_templates', 'action'), false);
});
