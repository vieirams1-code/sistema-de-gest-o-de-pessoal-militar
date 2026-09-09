import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildAccessScopeKey } from '../../../lib/accessScopeKey.js';

const backendSource = readFileSync(new URL('../../../../base44/functions/getUserPermissions/entry.ts', import.meta.url), 'utf8');
const backendCudSource = readFileSync(new URL('../../../../base44/functions/cudEscopado/entry.ts', import.meta.url), 'utf8');
const frontendSource = readFileSync(new URL('../useCurrentUser.jsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../../../Layout.jsx', import.meta.url), 'utf8');
const publicacoesSource = readFileSync(new URL('../../../pages/Publicacoes.jsx', import.meta.url), 'utf8');
const rpSource = readFileSync(new URL('../../../pages/RP.jsx', import.meta.url), 'utf8');
const livroServiceSource = readFileSync(new URL('../../livro/livroService.js', import.meta.url), 'utf8');
const publicacoesBundleSource = readFileSync(new URL('../../../../base44/functions/getScopedPublicacoesBundle/entry.ts', import.meta.url), 'utf8');
const agendaAcoesSource = readFileSync(new URL('../../../pages/AgendaAcoesOperacionais.jsx', import.meta.url), 'utf8');
const quadroOperacionalSource = readFileSync(new URL('../../../pages/QuadroOperacional.jsx', import.meta.url), 'utf8');
const cardDetalheSource = readFileSync(new URL('../../quadro/CardDetalheModal.jsx', import.meta.url), 'utf8');
const quadroHelpersSource = readFileSync(new URL('../../quadro/quadroHelpers.js', import.meta.url), 'utf8');

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
  assert.match(frontendSource, /String\(modulo\)\.trim\(\)\.replace\(\/\^acesso_\//);
  assert.match(frontendSource, /return Boolean\(key\) && modules\[key\] === true;/);
  assert.match(frontendSource, /String\(acao\)\.trim\(\)\.replace\(\/\^perm_\//);
  assert.match(frontendSource, /return Boolean\(key\) && actions\[key\] === true;/);
});

test('escopo de Livro/Publicações/RP é resolvido no backend sem elevar privilégio funcional', () => {
  assert.match(publicacoesSource, /getLivroRegistrosContrato\(\)/);
  assert.match(publicacoesSource, /listarPublicacoesExOfficioEscopo\(\{ purpose: 'CONTROL' \}\)/);
  assert.match(publicacoesSource, /listarAtestadosPublicacaoEscopo\(\{ isAdmin, hasGlobalScope, getMilitarScopeFilters \}\)/);
  assert.match(rpSource, /listarPublicacoesExOfficioEscopo\(\{ purpose: 'RP' \}\)/);
  assert.match(livroServiceSource, /fetchScopedPublicacoesBundle\(\{ purpose: 'CONTROL' \}\)/);
  assert.match(livroServiceSource, /fetchScopedPublicacoesBundle\(\{ purpose: 'RP' \}\)/);
  assert.match(publicacoesBundleSource, /functions\.invoke\('getUserPermissions'/);
  assert.match(publicacoesBundleSource, /authz\?\.isAdmin === true \|\| authz\?\.hasGlobalScope === true/);
  assert.match(publicacoesBundleSource, /listarMilitarIdsDoEscopo/);
  assert.match(publicacoesBundleSource, /asServiceRole\.entities\[entityName\]/);
});

test('chave canônica de cache distingue escopos efetivos diferentes', () => {
  const global = buildAccessScopeKey({ hasGlobalScope: true, modoAcesso: 'admin', effectiveEmail: 'global@sgp.local' });
  const unidadeA = buildAccessScopeKey({ modoAcesso: 'unidade', effectiveEmail: 'operador@sgp.local', subgrupamentoId: 'u-a' });
  const unidadeB = buildAccessScopeKey({ modoAcesso: 'unidade', effectiveEmail: 'operador@sgp.local', subgrupamentoId: 'u-b' });
  assert.notDeepEqual(global, unidadeA);
  assert.notDeepEqual(unidadeA, unidadeB);
});

test('permissão de gerir ações não substitui escopo organizacional na Agenda', () => {
  assert.match(agendaAcoesSource, /useScopedMilitarIds\(\)/);
  assert.match(agendaAcoesSource, /if \(semRestricaoEscopo\) return listAllCardAcoes\(3000\);/);
  assert.match(agendaAcoesSource, /return listAllCardAcoes\(3000, \{ militar_id: \{ \$in: scopedIds \} \}\);/);
  assert.doesNotMatch(agendaAcoesSource, /if \(canManageAcoes\)\s*\{\s*return listAllCardAcoes\(3000\)/);
});

test('cudEscopado não transforma escopo global em privilégio funcional absoluto', () => {
  assert.match(backendCudSource, /const authIsAdmin = authIsAdminByRole;/);
  assert.match(backendCudSource, /const targetIsAdmin = !isImpersonating && authIsAdminByRole;/);
  assert.doesNotMatch(backendCudSource, /const authIsAdmin = authIsAdminByRole \|\| authPerms\.isAdminByAccess;/);
});

test('gravações do Quadro passam pelo portão escopado', () => {
  for (const source of [quadroOperacionalSource, cardDetalheSource, quadroHelpersSource]) {
    assert.doesNotMatch(source, /base44\.entities\.(CardOperacional|CardComentario|CardChecklistItem|CardVinculo|ColunaOperacional|QuadroOperacional)\.(create|update|delete|bulkUpdate|bulkCreate)/);
  }
  assert.match(backendCudSource, /'CardOperacional'/);
  assert.match(backendCudSource, /'CardComentario'/);
  assert.match(backendCudSource, /'CardChecklistItem'/);
  assert.match(backendCudSource, /'CardVinculo'/);
});

test('bulk de cards resolve militar canônico no backend antes de validar escopo', () => {
  assert.match(backendCudSource, /registroBulkExistente = await buscarRegistroExistente\(base44, entityName, itemIdSeguro\)/);
  assert.match(backendCudSource, /mid = registroBulkExistente\?\.militar_id \|\| null;/);
  assert.match(backendCudSource, /delete itemData\.militar_id;/);
});

test('campos legado de UsuarioAcesso não participam mais da autorização funcional', () => {
  assert.match(backendSource, /function consolidarModulesActions\(perfis\)/);
  assert.match(backendSource, /const \{ modules, actions \} = consolidarModulesActions\(perfis\);/);
  assert.doesNotMatch(backendSource, /\(acessos \|\| \[\]\)\.forEach\(aplicarFonte\)/);
  assert.match(backendCudSource, /function consolidarActions\(perfis\)/);
  assert.doesNotMatch(backendCudSource, /\(acessos \|\| \[\]\)\.forEach\(aplicarFonte\)/);
});

test('menu normaliza chaves acesso_/perm_ antes de consultar o resolvedor canônico', () => {
  assert.match(layoutSource, /value\.replace\(\/\^acesso_\//);
  assert.match(layoutSource, /value\.replace\(\/\^perm_\//);
  assert.match(layoutSource, /canAccessAction\(normalizeMenuPermissionKey\(entry\.actionKey, 'action'\)\)/);
  assert.match(layoutSource, /canAccessModule\(normalizeMenuPermissionKey\(entry\.moduleKey, 'module'\)\)/);
});
