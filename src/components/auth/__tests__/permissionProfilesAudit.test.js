import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  deprecatedAdminPermissionKeys,
  deprecatedAdminModuleKeys,
  isPermissionVisibleInAdminMatrix,
  isModuleVisibleInAdminMatrix,
  permissionStructure,
} from '../../../config/permissionStructure.js';

const source = fs.readFileSync(new URL('../../../pages/PerfisPermissao.jsx', import.meta.url), 'utf8');
const usuariosSource = fs.readFileSync(new URL('../../../pages/PermissoesUsuarios.jsx', import.meta.url), 'utf8');

test('auditoria de perfis personalizados usa perfil_id real do UsuarioAcesso', () => {
  assert.match(source, /new Map\(/);
  assert.match(source, /String\(acesso\.perfil_id\)/);
  assert.doesNotMatch(source, /Usuário vinculado: \{perfil\.usuario_vinculado_id/);
});

test('auditoria separa perfis personalizados vinculados e órfãos sem alterar registros', () => {
  assert.match(source, /vinculadosAtivos: itens\.filter/);
  assert.match(source, /orfaos: itens\.filter/);
  assert.match(source, /Sem referência em UsuarioAcesso — candidato a legado órfão/);
  assert.match(source, /Diagnóstico somente leitura/);
});

test('PERM-CORE-003: permissões órfãs ficam ocultas da matriz administrativa sem remoção destrutiva do contrato', () => {
  const expected = [
    'perm_adicionar_folha_alteracoes',
    'perm_editar_folha_alteracoes',
    'perm_excluir_folha_alteracoes',
    'perm_adicionar_migracao_legado',
    'perm_editar_migracao_legado',
    'perm_excluir_migracao_legado',
    'perm_adicionar_quadro_operacional',
    'perm_editar_quadro_operacional',
    'perm_aplicar_transicao_legado_ativa',
    'perm_aplicar_transicao_designacao_manual',
    'perm_excluir_processo_controle',
    'perm_reset_operacional',
    'perm_visualizar_central_pendencias',
  ];
  assert.deepEqual([...deprecatedAdminPermissionKeys].sort(), expected.sort());

  const canonicalActions = permissionStructure.flatMap((group) =>
    group.modules.flatMap((module) => module.actions.map((action) => action.key)),
  );
  for (const key of expected) {
    assert.ok(canonicalActions.includes(key), `${key} deve permanecer no contrato durante a descontinuação suave`);
    assert.equal(isPermissionVisibleInAdminMatrix(key), false, `${key} não deve ser selecionável no painel`);
  }

  assert.deepEqual(
    [...deprecatedAdminModuleKeys].sort(),
    ['acesso_central_pendencias', 'acesso_operacoes_administrativas'].sort(),
  );
  assert.equal(isModuleVisibleInAdminMatrix('acesso_central_pendencias'), false);
  assert.equal(isModuleVisibleInAdminMatrix('acesso_operacoes_administrativas'), false);
});

test('PERM-CORE-003: telas de perfil e usuário aplicam o filtro administrativo de depreciação', () => {
  for (const pageSource of [source, usuariosSource]) {
    assert.match(pageSource, /filter\(isModuleVisibleInAdminMatrix\)/);
    assert.match(pageSource, /filter\(isPermissionVisibleInAdminMatrix\)/);
  }
});
