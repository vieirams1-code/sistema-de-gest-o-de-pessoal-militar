import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPermissionPayload,
  buildPermissionsFromSource,
  computePermissionOverrides,
  mergeProfileAndUserPermissions,
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

test('payload de persistência inclui aliases legados para manter compatibilidade', () => {
  const payload = buildPermissionPayload({
    perm_indicar_medalhas: true,
    perm_gerir_dom_pedro_ii: true,
  });

  assert.equal(payload.perm_indicar_medalhas, true);
  assert.equal(payload.indicar_medalhas, true);
  assert.equal(payload.perm_gerir_dom_pedro_ii, true);
  assert.equal(payload.gerir_dom_pedro_ii, true);
  assert.equal(payload.perm_gerir_fluxo_dom_pedro_ii, true);
  assert.equal(payload.gerir_fluxo_dom_pedro_ii, true);
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
