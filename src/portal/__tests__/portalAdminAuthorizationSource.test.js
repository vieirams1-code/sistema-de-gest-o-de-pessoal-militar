import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../../base44/functions/portal_servicos/entry.ts', import.meta.url), 'utf8');

test('rotas administrativas do Portal exigem usuário autenticado real', () => {
  assert.match(source, /user\s*=\s*await base44\.auth\.me\(\)/);
  assert.match(source, /if \(!user\)/);
  assert.doesNotMatch(source, /Boolean\(user \|\| req\.headers\.get\('Authorization'\) \|\| req\.headers\.get\('X-App-Id'\)\)/);
});

test('rotas administrativas validam permissão no servidor antes do switch', () => {
  assert.match(source, /autorizado\s*=\s*await autorizarAcaoAdminPortal\(base44, user, acao\)/);
  assert.match(source, /status:\s*403/);
  assert.match(source, /perm_configurar_portal/);
  assert.match(source, /perm_gerir_respostas/);
  assert.match(source, /perm_gerir_campanhas/);
});

test('headers X-App-Id e Authorization não funcionam como autorização administrativa', () => {
  const adminBlockStart = source.indexOf('if (isAdminAction)');
  const adminBlockEnd = source.indexOf('// ========================================================================\n    // ROTAS DO MILITAR', adminBlockStart);
  const adminBlock = source.slice(adminBlockStart, adminBlockEnd);
  assert.doesNotMatch(adminBlock, /req\.headers\.get\('X-App-Id'\)/);
  assert.doesNotMatch(adminBlock, /req\.headers\.get\('Authorization'\)/);
});
