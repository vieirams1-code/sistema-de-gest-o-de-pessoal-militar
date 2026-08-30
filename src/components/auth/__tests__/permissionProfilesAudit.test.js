import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../../pages/PerfisPermissao.jsx', import.meta.url), 'utf8');

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
