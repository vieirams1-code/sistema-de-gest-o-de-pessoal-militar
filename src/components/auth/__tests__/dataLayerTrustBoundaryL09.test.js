import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const perfisPage = await readFile(new URL('../../../pages/PerfisPermissao.jsx', import.meta.url), 'utf8');
const usuariosPage = await readFile(new URL('../../../pages/PermissoesUsuarios.jsx', import.meta.url), 'utf8');
const gatewayClient = await readFile(new URL('../../../services/permissoesAdminGatewayClient.js', import.meta.url), 'utf8');
const gatewayBackend = await readFile(new URL('../../../../base44/functions/permissoesAdminGateway/entry.ts', import.meta.url), 'utf8');
const permissionsBackend = await readFile(new URL('../../../../base44/functions/getUserPermissions/entry.ts', import.meta.url), 'utf8');
const cadastroMedalha = await readFile(new URL('../../../pages/CadastrarMedalha.jsx', import.meta.url), 'utf8');
const importacaoMedalha = await readFile(new URL('../../../services/importacaoMedalhaService.js', import.meta.url), 'utf8');
const medalhasBundleBackend = await readFile(new URL('../../../../base44/functions/getScopedMedalhasBundle/entry.ts', import.meta.url), 'utf8');
const medalhasAcessoService = await readFile(new URL('../../../services/medalhasAcessoService.js', import.meta.url), 'utf8');
const medalhasTempoService = await readFile(new URL('../../../services/medalhasTempoServicoService.js', import.meta.url), 'utf8');
const timelineService = await readFile(new URL('../../../services/militarTimelineService.js', import.meta.url), 'utf8');
const cudBackend = await readFile(new URL('../../../../base44/functions/cudEscopado/entry.ts', import.meta.url), 'utf8');

test('L09: páginas administrativas não leem UsuarioAcesso ou PerfilPermissao diretamente pelo SDK', () => {
  for (const source of [perfisPage, usuariosPage]) {
    assert.doesNotMatch(source, /base44\.entities\.(UsuarioAcesso|PerfilPermissao)\.(list|filter|get|create|update|delete|bulkCreate|bulkUpdate)/);
  }
  assert.match(perfisPage, /listarPerfisPermissaoAdmin/);
  assert.match(perfisPage, /listarUsoPerfisAdmin/);
  assert.match(usuariosPage, /listarAcessosUsuariosAdmin/);
  assert.match(usuariosPage, /obterAcessoUsuarioAdmin/);
});

test('L09: gateway administrativo usa getUserPermissions e separa gestão de perfis da gestão de usuários', () => {
  assert.match(gatewayBackend, /functions\.invoke\('getUserPermissions'/);
  assert.match(gatewayBackend, /gerir_perfis_permissao/);
  assert.match(gatewayBackend, /gerir_permissoes_usuarios/);
  assert.match(gatewayBackend, /if \(!podeGerirUsuarios\)/);
  assert.match(gatewayBackend, /if \(!podeGerirPerfis\)/);
  assert.match(gatewayBackend, /asServiceRole\.entities\.PerfilPermissao/);
  assert.match(gatewayBackend, /asServiceRole\.entities\.UsuarioAcesso/);
});

test('L09: uso de perfil expõe somente vínculo mínimo e não o UsuarioAcesso completo', () => {
  assert.match(gatewayBackend, /LIST_PROFILE_USAGE/);
  assert.match(gatewayBackend, /perfil_id: item\?\.perfil_id/);
  assert.match(gatewayBackend, /ativo: item\?\.ativo !== false/);
  assert.doesNotMatch(gatewayClient, /base44\.entities\.(UsuarioAcesso|PerfilPermissao)/);
});

test('L09: getUserPermissions continua resolvendo a fonte de autorização via service role', () => {
  assert.match(permissionsBackend, /asServiceRole\.entities\.UsuarioAcesso/);
  assert.match(permissionsBackend, /asServiceRole\.entities\.PerfilPermissao/);
});

test('L09: Medalha não possui leitura ou escrita direta no frontend', () => {
  for (const source of [cadastroMedalha, importacaoMedalha]) {
    assert.doesNotMatch(source, /base44\.entities\.Medalha\.(list|filter|get|create|update|delete|bulkCreate|bulkUpdate)/);
  }
  assert.match(cadastroMedalha, /readPurpose: 'EDIT'/);
  assert.match(importacaoMedalha, /readPurpose: 'MIGRATION'/);
});

test('L09: bundle de Medalhas separa edição, migração, apuração e visualização', () => {
  assert.match(medalhasBundleBackend, /purpose === 'EDIT'/);
  assert.match(medalhasBundleBackend, /editar_medalhas/);
  assert.match(medalhasBundleBackend, /purpose === 'MIGRATION'/);
  assert.match(medalhasBundleBackend, /migracao_alteracoes_legado/);
  assert.match(medalhasBundleBackend, /purpose === 'APURACAO'/);
  assert.match(medalhasBundleBackend, /indicar_medalhas/);
  assert.match(medalhasBundleBackend, /gerir_dom_pedro_ii/);
  assert.match(medalhasBundleBackend, /visualizar_medalhas/);
  assert.match(medalhasBundleBackend, /medalhaId é obrigatório para leitura de edição/);
  assert.match(medalhasBundleBackend, /tipoMedalhaCodigo é obrigatório para leitura de migração/);
  assert.match(medalhasBundleBackend, /militarIds/);
});

test('L09: consumidores indiretos de Medalha usam gateway em produção e mantêm fallback apenas para mocks', () => {
  assert.match(medalhasAcessoService, /functions\?\.invoke === 'function'[\s\S]*getScopedMedalhasBundle[\s\S]*readPurpose: 'APURACAO'/);
  assert.match(medalhasAcessoService, /Fallback exclusivo para clientes simulados em testes unitários/);
  assert.match(medalhasTempoService, /functions\?\.invoke === 'function'[\s\S]*cudEscopado/);
  assert.match(medalhasTempoService, /Fallback exclusivo para clientes simulados em testes unitários/);
  assert.match(timelineService, /fetchScopedMedalhasBundle\([\s\S]*readPurpose: 'VIEW'[\s\S]*militarId/);
  assert.match(timelineService, /Fallback exclusivo para o cliente injetado pelos testes unitários/);
});

test('L09: reindicação APURACAO/INDICACAO exige indicar_medalhas, não editar_medalhas', () => {
  assert.match(cudBackend, /origemRegistro\.startsWith\('INDICACAO_'\) \|\| origemRegistro\.startsWith\('APURACAO_'\)/);
  assert.match(cudBackend, /statusFinal === 'INDICADA' && ehFluxoIndicacao[\s\S]*'indicar_medalhas'[\s\S]*'editar_medalhas'/);
  assert.match(medalhasTempoService, /origem_registro: origemRegistro/);
});
