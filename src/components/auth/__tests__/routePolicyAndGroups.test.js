import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const requireModuleAccess = read('../RequireModuleAccess.jsx');
const pagePolicy = read('../../../config/pageAccessPolicy.js');
const app = read('../../../App.jsx');
const layout = read('../../../Layout.jsx');
const permissions = read('../../../config/permissionStructure.js');
const gruposPage = read('../../../pages/GruposEfetivo.jsx');
const gruposGateway = read('../../../../base44/functions/gruposEfetivoGateway/entry.ts');
const tagsPage = read('../../../pages/Tags.jsx');
const tagsGateway = read('../../../../base44/functions/cudFuncoesTagsEscopado/entry.ts');
const estruturaPage = read('../../../pages/EstruturaOrganizacional.jsx');
const migracaoPage = read('../../../pages/MigracaoMilitares.jsx');
const comportamentoPage = read('../../../pages/AvaliacaoComportamento.jsx');

test('RequireModuleAccess exige AND entre módulo e ação quando ambos existem', () => {
  assert.match(requireModuleAccess, /const hasModuleAccess = normalizedModuleKeys\.length === 0/);
  assert.match(requireModuleAccess, /const hasActionAccess = normalizedActionKeys\.length === 0/);
  assert.match(requireModuleAccess, /if \(!hasExplicitRule \|\| !hasModuleAccess \|\| !hasActionAccess\)/);
});

test('menu e rota consultam política canônica compartilhada no L06', () => {
  assert.match(app, /getPageAccessPolicy/);
  assert.match(layout, /getPageAccessPolicy/);
  assert.match(layout, /canAccessPagePolicy/);
  for (const page of ['EstruturaOrganizacional', 'MigracaoMilitares', 'AvaliacaoComportamento', 'Configuracoes', 'Tags', 'GruposEfetivo']) {
    assert.match(pagePolicy, new RegExp(`${page}:`));
  }
});

test('Grupos do Efetivo possui módulo e ações concedíveis na matriz', () => {
  assert.match(permissions, /acesso_grupos_efetivo/);
  assert.match(permissions, /perm_visualizar_grupos_efetivo/);
  assert.match(permissions, /perm_criar_grupos_efetivo/);
  assert.match(permissions, /perm_editar_grupos_efetivo/);
  assert.match(permissions, /perm_gerir_membros_grupos_efetivo/);
  assert.doesNotMatch(layout, /Grupos do efetivo[^\n]*adminOnly: true/);
});

test('Grupos do Efetivo não faz CRUD direto no cliente e backend exige ações específicas', () => {
  assert.doesNotMatch(gruposPage, /base44\.entities\.(GrupoEfetivo|MembroGrupoEfetivo|Militar)/);
  assert.match(gruposPage, /listarGruposEfetivo/);
  assert.match(gruposGateway, /visualizar_grupos_efetivo/);
  assert.match(gruposGateway, /criar_grupos_efetivo/);
  assert.match(gruposGateway, /editar_grupos_efetivo/);
  assert.match(gruposGateway, /gerir_membros_grupos_efetivo/);
  assert.match(gruposGateway, /scopeCheck/);
});

test('Tags possui módulo próprio e backend de catálogo usa gerir_tags', () => {
  assert.match(permissions, /acesso_tags/);
  assert.match(permissions, /perm_visualizar_tags/);
  assert.match(permissions, /perm_gerir_tags/);
  assert.match(tagsPage, /canAccessModule\('tags'\)/);
  assert.match(tagsPage, /canAccessAction\('visualizar_tags'\)/);
  assert.match(tagsGateway, /TagGrupo: \['gerir_tags'\]/);
  assert.match(tagsGateway, /Tag: \['gerir_tags'\]/);
  assert.doesNotMatch(app, /moduleKey: 'efetivo'/);
  assert.doesNotMatch(layout, /moduleKey: 'efetivo'/);
});

test('Estrutura possui modo leitura e controles de gestão separados', () => {
  assert.match(estruturaPage, /podeVisualizarEstrutura/);
  assert.match(estruturaPage, /podeGerirEstrutura/);
  assert.match(estruturaPage, /!hasEstruturaAccess \|\| !podeVisualizarEstrutura/);
  assert.match(estruturaPage, /podeGerirEstrutura && <Button onClick=\{\(\) => setShowNew\(true\)\}/);
});

test('Migração e Comportamento aceitam visualização sem ação mutável escondida', () => {
  assert.match(migracaoPage, /const podeVisualizar = canAccessAction\('visualizar_importacao_militares'\)/);
  assert.match(migracaoPage, /!canAccessModule\('migracao_militares'\) \|\| !podeVisualizar/);
  assert.doesNotMatch(migracaoPage, /\(!podeImportar && !podeConferir\)\) return <AccessDenied/);

  assert.match(comportamentoPage, /canVisualizar = canAccessModule\('controle_comportamento'\) && canAccessAction\('visualizar_controle_comportamento'\)/);
  assert.match(comportamentoPage, /if \(!canVisualizar\) return <AccessDenied/);
  assert.doesNotMatch(comportamentoPage, /if \(!canGerarPendencias && !canAprovarMudanca\)/);
});

test('Antiguidade prévia mantém natureza administrativa refletida no menu', () => {
  assert.match(app, /'AntiguidadePrevia'/);
  assert.match(layout, /name: 'Antiguidade',[\s\S]*?page: 'AntiguidadePrevia',[\s\S]*?adminOnly: true/);
});
