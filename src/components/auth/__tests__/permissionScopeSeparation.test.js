import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backendSource = readFileSync(new URL('../../../../base44/functions/getUserPermissions/entry.ts', import.meta.url), 'utf8');
const frontendSource = readFileSync(new URL('../useCurrentUser.jsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../../../Layout.jsx', import.meta.url), 'utf8');

test('tipo_acesso admin representa escopo global, não privilégio absoluto', () => {
  assert.match(backendSource, /const isAdmin = isAdminByRole;/);
  assert.match(backendSource, /const hasGlobalScope = isAdminByRole \|\| isAdminByAccess;/);
  assert.doesNotMatch(backendSource, /const isAdmin = isAdminByRole \|\| isAdminByAccess;/);
});

test('impersonação exige administrador real da plataforma', () => {
  assert.match(backendSource, /const authIsAdmin = authIsAdminByRole;/);
  assert.doesNotMatch(backendSource, /const authIsAdmin = authIsAdminByRole \|\| authIsAdminByAccess;/);
});

test('frontend mantém bypass funcional somente para role administrativa real', () => {
  assert.match(frontendSource, /const isAdmin = isAdminByRole;/);
  assert.match(frontendSource, /const hasAbsoluteAccess = isAdmin;/);
  assert.doesNotMatch(frontendSource, /const isAdmin = Boolean\(data\?\.isAdmin\);/);
  assert.match(frontendSource, /if \(hasAbsoluteAccess\) return true;/);
});

test('escopo Administrador Global continua abrangendo todos os registros sem liberar módulos', () => {
  assert.match(frontendSource, /if \(hasAbsoluteAccess \|\| modoAcesso === 'admin'\) return true;/);
  assert.match(frontendSource, /if \(hasAbsoluteAccess \|\| modoAcesso === 'admin'\) return \[\];/);
  assert.match(frontendSource, /return modules\[modulo\] === true;/);
  assert.match(frontendSource, /return actions\[acao\] === true;/);
});

test('campos legado de UsuarioAcesso não participam mais da autorização funcional', () => {
  assert.match(backendSource, /function consolidarModulesActions\(perfis\)/);
  assert.match(backendSource, /const \{ modules, actions \} = consolidarModulesActions\(perfis\);/);
  assert.doesNotMatch(backendSource, /\(acessos \|\| \[\]\)\.forEach\(aplicarFonte\)/);
});

test('menu normaliza chaves acesso_/perm_ antes de consultar o resolvedor canônico', () => {
  assert.match(layoutSource, /value\.replace\(\/\^acesso_\//);
  assert.match(layoutSource, /value\.replace\(\/\^perm_\//);
  assert.match(layoutSource, /canAccessAction\(normalizeMenuPermissionKey\(entry\.actionKey, 'action'\)\)/);
  assert.match(layoutSource, /canAccessModule\(normalizeMenuPermissionKey\(entry\.moduleKey, 'module'\)\)/);
});
