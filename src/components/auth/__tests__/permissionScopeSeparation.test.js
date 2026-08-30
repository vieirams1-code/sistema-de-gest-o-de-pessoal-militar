import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backendSource = readFileSync(new URL('../../../../base44/functions/getUserPermissions/entry.ts', import.meta.url), 'utf8');
const frontendSource = readFileSync(new URL('../useCurrentUser.jsx', import.meta.url), 'utf8');

test('tipo_acesso admin representa escopo global, não privilégio absoluto', () => {
  assert.match(backendSource, /const isAdmin = isAdminByRole;/);
  assert.match(backendSource, /const hasGlobalScope = isAdminByRole \|\| isAdminByAccess;/);
  assert.doesNotMatch(backendSource, /const isAdmin = isAdminByRole \|\| isAdminByAccess;/);
});

test('impersonação exige administrador real da plataforma', () => {
  assert.match(backendSource, /const authIsAdmin = authIsAdminByRole;/);
  assert.doesNotMatch(backendSource, /const authIsAdmin = authIsAdminByRole \|\| authIsAdminByAccess;/);
});

test('frontend mantém bypass funcional somente para isAdmin real', () => {
  assert.match(frontendSource, /const hasAbsoluteAccess = isAdmin;/);
  assert.match(frontendSource, /if \(hasAbsoluteAccess\) return true;/);
});

test('escopo Administrador Global continua abrangendo todos os registros sem liberar módulos', () => {
  assert.match(frontendSource, /if \(hasAbsoluteAccess \|\| modoAcesso === 'admin'\) return true;/);
  assert.match(frontendSource, /if \(hasAbsoluteAccess \|\| modoAcesso === 'admin'\) return \[\];/);
  assert.match(frontendSource, /return modules\[modulo\] === true;/);
  assert.match(frontendSource, /return actions\[acao\] === true;/);
});
