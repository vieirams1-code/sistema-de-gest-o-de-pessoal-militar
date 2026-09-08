import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const authz = read('../../../../base44/functions/authz.ts');

test('contrato backend separa PerfilPermissao, escopo global e admin real', () => {
  assert.match(authz, /PerfilPermissao define O QUE/);
  assert.match(authz, /UsuarioAcesso define ONDE/);
  assert.match(authz, /Somente User\.role === 'admin'/);
  assert.match(authz, /tipo_acesso === 'admin' significa somente escopo global/);
  assert.match(authz, /const authIsPlatformAdmin = isPlatformAdminRole\(authUser\);/);
  assert.match(authz, /const targetIsPlatformAdmin = !isImpersonating && authIsPlatformAdmin;/);
  assert.match(authz, /const hasGlobalScope = targetIsPlatformAdmin \|\| targetAccess\.hasGlobalScope;/);
});

test('autorização funcional consolidada ignora campos perm_* e acesso_* de UsuarioAcesso', () => {
  assert.match(authz, /consolidarPermissoesFuncionais\(perfis/);
  assert.doesNotMatch(authz, /consolidarPermissoesFuncionais\([^\n]*acessos/);
  assert.match(authz, /const \{ modules, actions \} = consolidarPermissoesFuncionais\(perfis \|\| \[\]\);/);
});

test('impersonação backend exige administrador real da plataforma', () => {
  assert.match(authz, /if \(wantsImpersonation && !authIsPlatformAdmin\)/);
  assert.match(authz, /IMPERSONATION_REQUIRES_PLATFORM_ADMIN/);
  assert.doesNotMatch(authz, /wantsImpersonation && ![^\n]*hasGlobalScope/);
});
