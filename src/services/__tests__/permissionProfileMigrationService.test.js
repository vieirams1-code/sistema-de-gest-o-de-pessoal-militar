import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_PROFILE_MATRIX_VERSION,
  extractProfileMatrixVersion,
  previewProfilePermissionMigration,
  previewProfilesPermissionMigration,
} from '../permissionProfileMigrationService.js';

const wrap = (matrix, prefix = '') => `${prefix}${prefix ? '\n\n' : ''}[SGP_PERMISSIONS_MATRIX]${JSON.stringify(matrix)}[/SGP_PERMISSIONS_MATRIX]`;

test('perfil canônico recebe versão formal sem alterar intenção', () => {
  const preview = previewProfilePermissionMigration({
    id: 'p1',
    nome_perfil: 'Teste',
    descricao: wrap({ acesso_militares: true, perm_visualizar_militares: true }),
  });
  assert.equal(preview.finalMatrix.acesso_militares, true);
  assert.equal(preview.finalMatrix.perm_visualizar_militares, true);
  assert.equal(extractProfileMatrixVersion(preview.finalDescricao), CURRENT_PROFILE_MATRIX_VERSION);
});

test('ação filha verdadeira repara módulo pai sem conceder outras ações', () => {
  const preview = previewProfilePermissionMigration({
    descricao: wrap({ acesso_atestados: false, perm_visualizar_atestados: true, perm_editar_atestados: false }),
  });
  assert.equal(preview.finalMatrix.acesso_atestados, true);
  assert.equal(preview.finalMatrix.perm_visualizar_atestados, true);
  assert.equal(preview.finalMatrix.perm_editar_atestados, false);
  assert.equal(preview.moduleRepairs.some((item) => item.moduleKey === 'acesso_atestados'), true);
});

test('alias singulariza exclusão de atestado', () => {
  const preview = previewProfilePermissionMigration({
    descricao: wrap({ acesso_atestados: true, perm_excluir_atestados: true }),
  });
  assert.equal(preview.finalMatrix.perm_excluir_atestado, true);
  assert.equal(preview.aliasesApplied.some((item) => item.legacyKey === 'perm_excluir_atestados'), true);
});

test('perfil legado de campanhas expande permissões antigas em capacidades canônicas equivalentes', () => {
  const preview = previewProfilePermissionMigration({
    descricao: wrap({
      acesso_campanhas: true,
      perm_visualizar_campanhas: true,
      perm_gerir_campanhas: true,
      perm_gerir_respostas: true,
    }),
  });
  assert.equal(preview.finalMatrix.acesso_campanhas_ferias, true);
  assert.equal(preview.finalMatrix.acesso_campanhas_gerais, true);
  assert.equal(preview.finalMatrix.perm_criar_campanhas, true);
  assert.equal(preview.finalMatrix.perm_editar_campanhas_ferias, true);
  assert.equal(preview.finalMatrix.perm_aprovar_ferias, true);
  assert.equal(preview.finalMatrix.perm_exportar_respostas_campanhas, true);
});

test('chaves desconhecidas e depreciadas são reportadas, não copiadas silenciosamente', () => {
  const preview = previewProfilePermissionMigration({
    descricao: wrap({
      acesso_militares: true,
      perm_chave_inexistente: true,
      acesso_rotinas_administrativas: true,
    }),
  });
  assert.deepEqual(preview.unknownKeys, ['perm_chave_inexistente']);
  assert.deepEqual(preview.deprecatedKeys, ['acesso_rotinas_administrativas']);
  assert.equal(Object.prototype.hasOwnProperty.call(preview.finalMatrix, 'perm_chave_inexistente'), false);
});

test('migração é idempotente', () => {
  const first = previewProfilePermissionMigration({
    id: 'p1',
    nome_perfil: 'Teste',
    descricao: wrap({ acesso_militares: false, perm_visualizar_militares: true }),
  });
  const second = previewProfilePermissionMigration({
    id: 'p1',
    nome_perfil: 'Teste',
    descricao: first.finalDescricao,
  });
  assert.equal(second.finalDescricao, first.finalDescricao);
  assert.equal(second.changed, false);
  assert.deepEqual(second.changedKeys, []);
});

test('preview em lote preserva um resultado por perfil', () => {
  const result = previewProfilesPermissionMigration([
    { id: 'a', descricao: wrap({}) },
    { id: 'b', descricao: wrap({ acesso_ferias: true }) },
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.profileId), ['a', 'b']);
});
