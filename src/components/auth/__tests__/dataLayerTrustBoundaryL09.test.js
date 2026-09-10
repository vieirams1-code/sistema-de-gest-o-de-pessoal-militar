import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const perfisPage = await readFile(new URL('../../../pages/PerfisPermissao.jsx', import.meta.url), 'utf8');
const usuariosPage = await readFile(new URL('../../../pages/PermissoesUsuarios.jsx', import.meta.url), 'utf8');
const gatewayClient = await readFile(new URL('../../../services/permissoesAdminGatewayClient.js', import.meta.url), 'utf8');
const gatewayBackend = await readFile(new URL('../../../../base44/functions/permissoesAdminGateway/entry.ts', import.meta.url), 'utf8');
const gatewayManifest = await readFile(new URL('../../../../base44/functions/permissoesAdminGateway/permissionManifest.ts', import.meta.url), 'utf8');
const permissionsBackend = await readFile(new URL('../../../../base44/functions/getUserPermissions/entry.ts', import.meta.url), 'utf8');
const cadastroMedalha = await readFile(new URL('../../../pages/CadastrarMedalha.jsx', import.meta.url), 'utf8');
const importacaoMedalha = await readFile(new URL('../../../services/importacaoMedalhaService.js', import.meta.url), 'utf8');
const medalhasBundleBackend = await readFile(new URL('../../../../base44/functions/getScopedMedalhasBundle/entry.ts', import.meta.url), 'utf8');
const medalhasAcessoService = await readFile(new URL('../../../services/medalhasAcessoService.js', import.meta.url), 'utf8');
const medalhasTempoService = await readFile(new URL('../../../services/medalhasTempoServicoService.js', import.meta.url), 'utf8');
const timelineService = await readFile(new URL('../../../services/militarTimelineService.js', import.meta.url), 'utf8');
const cudBackend = await readFile(new URL('../../../../base44/functions/cudEscopado/entry.ts', import.meta.url), 'utf8');
const processosBackend = await readFile(new URL('../../../../base44/functions/controleProcessosEscopado/entry.ts', import.meta.url), 'utf8');
const processosService = await readFile(new URL('../../../services/controleProcessosService.js', import.meta.url), 'utf8');
const registrosMilitarService = await readFile(new URL('../../../services/registrosMilitarService.js', import.meta.url), 'utf8');
const registrosMilitarGateway = await readFile(new URL('../../../../base44/functions/registrosMilitarGateway/entry.ts', import.meta.url), 'utf8');
const publicacoesBundleBackend = await readFile(new URL('../../../../base44/functions/getScopedPublicacoesBundle/entry.ts', import.meta.url), 'utf8');
const comportamentoRPService = await readFile(new URL('../../../services/comportamentoRPService.js', import.meta.url), 'utf8');
const migracaoLegadoService = await readFile(new URL('../../../services/migracaoAlteracoesLegadoService.js', import.meta.url), 'utf8');
const feriasBundleBackend = await readFile(new URL('../../../../base44/functions/getScopedFeriasBundle/entry.ts', import.meta.url), 'utf8');
const periodosBundleBackend = await readFile(new URL('../../../../base44/functions/getScopedPeriodosAquisitivosBundle/entry.ts', import.meta.url), 'utf8');
const descontoFeriasService = await readFile(new URL('../../../services/descontoFeriasService.js', import.meta.url), 'utf8');
const feriasPage = await readFile(new URL('../../../pages/Ferias.jsx', import.meta.url), 'utf8');
const periodosPage = await readFile(new URL('../../../pages/PeriodosAquisitivos.jsx', import.meta.url), 'utf8');
const cadastrarFeriasPage = await readFile(new URL('../../../pages/CadastrarFerias.jsx', import.meta.url), 'utf8');
const ajustesSaldoPage = await readFile(new URL('../../../pages/AjustesSaldoFerias.jsx', import.meta.url), 'utf8');
const diagnosticoSaldoPage = await readFile(new URL('../../../pages/DiagnosticoSaldoFerias.jsx', import.meta.url), 'utf8');
const registroLivroModal = await readFile(new URL('../../../components/ferias/RegistroLivroModal.jsx', import.meta.url), 'utf8');
const recalcularPeriodoJs = await readFile(new URL('../../../components/ferias/recalcularPeriodoAquisitivo.js', import.meta.url), 'utf8');
const recalcularPeriodoJsx = await readFile(new URL('../../../components/ferias/recalcularPeriodoAquisitivo.jsx', import.meta.url), 'utf8');
const migracaoMilitaresService = await readFile(new URL('../../../services/migracaoMilitaresService.js', import.meta.url), 'utf8');
const historicoImportacoesService = await readFile(new URL('../../../services/historicoImportacoesMilitaresService.js', import.meta.url), 'utf8');
const historicoImportacoesPage = await readFile(new URL('../../../pages/HistoricoImportacoesMilitares.jsx', import.meta.url), 'utf8');
const historicoImportacoesLista = await readFile(new URL('../../../components/migracao-militares/HistoricoImportacoesMilitaresLista.jsx', import.meta.url), 'utf8');
const importacaoHistoricoGateway = await readFile(new URL('../../../../base44/functions/importacaoMilitaresHistoricoGateway/entry.ts', import.meta.url), 'utf8');
const importacaoHistoricoClient = await readFile(new URL('../../../services/importacaoMilitaresHistoricoGatewayClient.js', import.meta.url), 'utf8');
const importacaoMilitaresSchema = await readFile(new URL('../../../../base44/entities/ImportacaoMilitares.jsonc', import.meta.url), 'utf8');
async function listarFontesRecursivamente(dirUrl) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const fontes = [];
  for (const entry of entries) {
    const childUrl = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, dirUrl);
    if (entry.isDirectory()) {
      fontes.push(...await listarFontesRecursivamente(childUrl));
      continue;
    }
    if (!/\.(js|jsx|ts|tsx)$/.test(entry.name)) continue;
    fontes.push({ path: childUrl.pathname, source: await readFile(childUrl, 'utf8') });
  }
  return fontes;
}

const entidadesProcessuaisServiceOnly = [
  'CaixaProcessual',
  'ProcessoControle',
  'TramiteProcessual',
  'EventoProcessual',
  'ProcedimentoProcesso',
  'ProcedimentoEnvolvido',
  'ProcedimentoPendencia',
  'ProcedimentoPrazoHistorico',
  'ProcedimentoViatura',
  'Demanda',
  'DemandaComentario',
  'Processo',
];

test('L09: páginas administrativas não leem UsuarioAcesso ou PerfilPermissao diretamente pelo SDK', () => {
  for (const source of [perfisPage, usuariosPage]) {
    assert.doesNotMatch(source, /base44\.entities\.(UsuarioAcesso|PerfilPermissao)\.(list|filter|get|create|update|delete|bulkCreate|bulkUpdate)/);
  }
  assert.match(perfisPage, /listarPerfisPermissaoAdmin/);
  assert.match(perfisPage, /listarUsoPerfisAdmin/);
  assert.match(usuariosPage, /listarAcessosUsuariosAdmin/);
  assert.match(usuariosPage, /obterAcessoUsuarioAdmin/);
});

test('L09 hotfix: PerfisPermissao importa o resolvedor usado durante a renderização da lista', () => {
  assert.match(
    perfisPage,
    /import\s*\{[\s\S]*resolveProfilePermissions[\s\S]*\}\s*from\s*['"]@\/services\/permissionMatrixService['"]/,
  );
  assert.match(perfisPage, /resolveProfilePermissions\(\{ profileSource: p \}\)\.permissions/);
});

test('L09 arquitetura: novos salvamentos de perfil usam matriz estruturada e não reembutem permissões na descricao', () => {
  assert.doesNotMatch(perfisPage, /mergeProfileDescriptionWithMatrix/);
  assert.doesNotMatch(usuariosPage, /mergeProfileDescriptionWithMatrix/);
  assert.match(perfisPage, /buildPermissionPayload\(normalizedPermissions, \{ includeLegacy: false \}\)/);
  assert.match(usuariosPage, /buildPermissionPayload\(normalizedPermissions, \{ includeLegacy: false \}\)/);
  assert.match(gatewayBackend, /function limparDescricaoTecnica/);
  assert.match(gatewayBackend, /patch\.descricao = descricaoLimpa/);
  assert.match(gatewayBackend, /const \[perfilMigrado\] = await backfillPerfis\(base44, \[perfil\]\)/);
});

test('L09 hotfix: gateway administrativo é autossuficiente e usa entidades explícitas service-role', () => {
  assert.match(gatewayClient, /functions\.invoke\('permissoesAdminGateway'/);
  assert.match(gatewayBackend, /resolverCapacidadesAdministrativas/);
  assert.match(gatewayBackend, /perm_gerir_perfis_permissao/);
  assert.match(gatewayBackend, /perm_gerir_permissoes_usuarios/);
  assert.match(gatewayBackend, /perm_gerir_permissoes/);
  assert.match(gatewayBackend, /asServiceRole\.entities\.PerfilPermissao\.list/);
  assert.match(gatewayBackend, /asServiceRole\.entities\.UsuarioAcesso\.list/);
  assert.match(gatewayBackend, /asServiceRole\.entities\.PerfilPermissao\.get/);
  assert.match(gatewayBackend, /asServiceRole\.entities\.UsuarioAcesso\.get/);
  assert.doesNotMatch(gatewayBackend, /functions\.invoke\('getUserPermissions'/);
});

test('L09 hotfix: uso de perfil expõe vínculo mínimo e frontend não acessa entidades diretamente', () => {
  assert.match(gatewayBackend, /perfil_id: item\?\.perfil_id/);
  assert.match(gatewayBackend, /ativo: item\?\.ativo !== false/);
  assert.doesNotMatch(gatewayClient, /base44\.entities\.(UsuarioAcesso|PerfilPermissao)/);
});

test('L09: getUserPermissions continua resolvendo a fonte de autorização via service role', () => {
  assert.match(permissionsBackend, /asServiceRole\.entities\.UsuarioAcesso/);
  assert.match(permissionsBackend, /asServiceRole\.entities\.PerfilPermissao/);
});

test('ARCH-002: matriz estruturada é fonte primária e descricao fica somente como fallback legado', () => {
  assert.match(permissionsBackend, /const estruturada = perfil\?\.matriz_permissoes/);
  assert.match(permissionsBackend, /if \(hasCanonicalKey\) return estruturada/);
  assert.match(cudBackend, /const estruturada = perfil\?\.matriz_permissoes/);
  assert.match(cudBackend, /if \(hasPermissionKey\) return estruturada/);
  assert.match(gatewayBackend, /matrizEstruturadaValida/);
  assert.match(gatewayBackend, /async function backfillPerfis\(/);
  assert.doesNotMatch(gatewayBackend, /perfil\?\.ativo === false/);
  assert.match(gatewayBackend, /asServiceRole\.entities\.PerfilPermissao\.update/);
  assert.match(gatewayBackend, /versao_matriz_permissoes: PROFILE_MATRIX_VERSION/);
  assert.match(gatewayBackend, /from '\.\/permissionManifest\.ts'/);
  assert.match(gatewayManifest, /export const PROFILE_MATRIX_VERSION/);
  assert.match(gatewayManifest, /export const CANONICAL_PERMISSION_KEYS/);
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

test('L09: Controle de Processos exige módulo e ação de visualização no gateway', () => {
  assert.match(processosBackend, /modules\['controle_processos'\] === true && actions\['visualizar_controle_processos'\] === true/);
  assert.match(processosBackend, /visualizar_todas_caixas_processuais/);
  assert.match(processosBackend, /caixasDoUsuarioIds\.has\(p\.caixa_atual_id\)/);
});

test('L09: histórico processual é lido somente após revalidar processo e participação na caixa', () => {
  assert.match(processosBackend, /case 'listarTramitesProcessoEscopado'/);
  assert.match(processosBackend, /case 'listarEventosProcessoEscopado'/);
  assert.match(processosBackend, /getProcesso\(base44, id\)/);
  assert.match(processosBackend, /!podeVerTodas && !participaCaixa\(caixaAtual, email\)/);
  assert.match(processosBackend, /asServiceRole\.entities\.TramiteProcessual\.filter/);
  assert.match(processosBackend, /asServiceRole\.entities\.EventoProcessual\.filter/);
});

test('L09: frontend de Controle de Processos não lê entidades processuais diretamente pelo SDK', () => {
  assert.doesNotMatch(processosService, /base44\.entities\.(ProcessoControle|CaixaProcessual|TramiteProcessual|EventoProcessual)/);
  assert.match(processosService, /listarTramitesProcessoEscopado/);
  assert.match(processosService, /listarEventosProcessoEscopado/);
});

test('L09: entidades processuais ativas e legadas permanecem service-only', async () => {
  for (const entityName of entidadesProcessuaisServiceOnly) {
    const source = await readFile(
      new URL(`../../../../base44/entities/${entityName}.jsonc`, import.meta.url),
      'utf8',
    );
    const schema = JSON.parse(source);
    assert.deepEqual(
      schema.rls,
      { create: false, read: false, update: false, delete: false },
      `${entityName} deve permanecer fechado para o SDK cliente`,
    );
  }
});

test('L09D: AjusteSaldoFerias e DescontoFerias não são lidos diretamente no frontend', () => {
  const frontendSources = [
    descontoFeriasService,
    feriasPage,
    periodosPage,
    cadastrarFeriasPage,
    ajustesSaldoPage,
    diagnosticoSaldoPage,
    registroLivroModal,
    recalcularPeriodoJs,
    recalcularPeriodoJsx,
  ];
  for (const source of frontendSources) {
    assert.doesNotMatch(source, /(base44\.entities\.)?(AjusteSaldoFerias|DescontoFerias)\.(list|filter|get|create|update|delete|bulkCreate|bulkUpdate)/);
  }
  assert.match(descontoFeriasService, /fetchScopedFeriasBundle\(\{ includeDescontos: true \}\)/);
  assert.match(feriasPage, /fetchScopedFeriasBundle\(\{ includeDescontos: true \}\)/);
  assert.match(periodosPage, /paBundle\?\.ajustesSaldoFerias/);
  assert.match(cadastrarFeriasPage, /paBundle\?\.ajustesSaldoFerias/);
  assert.match(ajustesSaldoPage, /includeAjustesDetalhados: true/);
  assert.match(diagnosticoSaldoPage, /includeAjustesDetalhados: true/);
});

test('L09D: bundle de períodos separa ajuste operacional de detalhes administrativos', () => {
  assert.match(periodosBundleBackend, /CAMPOS_AJUSTE_SALDO_SUPORTE/);
  assert.match(periodosBundleBackend, /CAMPOS_AJUSTE_SALDO_DETALHADO/);
  assert.match(periodosBundleBackend, /includeAjustesDetalhados/);
  assert.match(periodosBundleBackend, /visualizar_creditos_ferias/);
  assert.match(periodosBundleBackend, /detalhes de ajustes de saldo exigem visualizar créditos de férias/);
  assert.match(periodosBundleBackend, /asServiceRole\.entities\.AjusteSaldoFerias/);
});

test('L09D: descontos são escopados no backend e publicações vinculadas são projetadas minimamente', () => {
  assert.match(feriasBundleBackend, /includeDescontos/);
  assert.match(feriasBundleBackend, /listarPorEscopoIds\(base44, 'DescontoFerias'/);
  assert.match(feriasBundleBackend, /asServiceRole\.entities\.DescontoFerias/);
  assert.match(feriasBundleBackend, /CAMPOS_PUBLICACAO_DESCONTO/);
  assert.match(feriasBundleBackend, /asServiceRole\.entities\.PublicacaoExOfficio\.filter/);
  assert.doesNotMatch(descontoFeriasService, /base44\.entities\.(DescontoFerias|PublicacaoExOfficio)/);
});

test('L09D: nenhum consumidor frontend lê Ferias ou PeriodoAquisitivo diretamente', async () => {
  const fontes = await listarFontesRecursivamente(new URL('../../../', import.meta.url));
  const padroes = [
    /(?:base44|client|serviceClient)\.entities\.(Ferias|PeriodoAquisitivo)\.(list|filter|get|create|update|delete|bulkCreate|bulkUpdate)/,
    /\b(?:const|let|var)\s+\w+\s*=\s*(?:base44|client|serviceClient)\.entities\.(Ferias|PeriodoAquisitivo)\b/,
    /(?:base44|client|serviceClient)\.entities\[['"](Ferias|PeriodoAquisitivo)['"]\]/,
  ];
  for (const { path, source } of fontes) {
    if (path.endsWith('/src/services/militarTimelineService.js')) continue;
    for (const padrao of padroes) {
      assert.doesNotMatch(source, padrao, `${path} não deve acessar Ferias/PeriodoAquisitivo diretamente`);
    }
  }
  const apiEntitiesSource = await readFile(new URL('../../../api/entities.js', import.meta.url), 'utf8');
  assert.doesNotMatch(apiEntitiesSource, /export const (Ferias|PeriodoAquisitivo)\s*=/);
  assert.match(feriasBundleBackend, /asServiceRole\.entities\.Ferias/);
  assert.match(periodosBundleBackend, /asServiceRole\.entities\.PeriodoAquisitivo/);
  assert.match(periodosBundleBackend, /asServiceRole\.entities\.Ferias/);
});

test('L09D: Timeline usa gateway de Férias no runtime e acesso direto apenas no mock injetado', () => {
  assert.match(timelineService, /const carregarFeriasTimeline = async \(\) => \{[\s\S]*if \(runtimeClient\)[\s\S]*client\.entities\.Ferias\.filter/);
  assert.match(timelineService, /fetchScopedPeriodosAquisitivosBundle\(\)/);
  assert.match(timelineService, /maybe\(allowed\.ferias, carregarFeriasTimeline\)/);
});

test('L09D: Plano Anual e suporte de Publicações têm finalidades explícitas de leitura', () => {
  assert.match(periodosBundleBackend, /'visualizar_plano_ferias'/);
  assert.match(feriasBundleBackend, /supportPurpose === 'PUBLICACOES'/);
  assert.match(feriasBundleBackend, /targetPerms\.modules\?\.controle_publicacoes === true/);
  assert.match(feriasBundleBackend, /targetPerms\.actions\?\.publicar_bg === true/);
  assert.match(feriasBundleBackend, /feriasId é obrigatório para suporte de Publicações/);
  assert.match(feriasBundleBackend, /CAMPOS_PERIODO_PUBLICACOES_SUPORTE/);
});

test('L09D bloco 3: Registros do Militar lista Livro e ExOfficio somente pelo gateway escopado', () => {
  assert.doesNotMatch(registrosMilitarService, /base44\.entities\.(RegistroLivro|PublicacaoExOfficio)\.(list|filter|get)/);
  assert.match(registrosMilitarService, /functions\.invoke\('registrosMilitarGateway', \{ action: 'LIST' \}\)/);
  assert.match(registrosMilitarGateway, /action === 'LIST'/);
  assert.match(registrosMilitarGateway, /modules\?\.registros_militar === true/);
  assert.match(registrosMilitarGateway, /visualizar_registros_militar/);
  assert.match(registrosMilitarGateway, /listarMilitarIdsDoEscopo/);
  assert.match(registrosMilitarGateway, /asServiceRole\.entities\[entityName\]/);
});

test('L09D bloco 3: Livro e ExOfficio não têm acesso direto de produção no frontend', async () => {
  const fontes = await listarFontesRecursivamente(new URL('../../../', import.meta.url));
  const padrao = /(?:base44|client|serviceClient)\.entities\.(RegistroLivro|PublicacaoExOfficio)\.(list|filter|get|create|update|delete|bulkCreate|bulkUpdate)/;
  const excecoesMock = new Set([
    '/src/services/militarTimelineService.js',
    '/src/services/comportamentoRPService.js',
    '/src/services/migracaoAlteracoesLegadoService.js',
  ]);

  for (const { path, source } of fontes) {
    if (!padrao.test(source)) continue;
    const excecao = [...excecoesMock].find((suffix) => path.endsWith(suffix));
    assert.ok(excecao, `${path} não deve acessar RegistroLivro/PublicacaoExOfficio diretamente`);
  }

  assert.match(timelineService, /if \(runtimeClient\) return client\.entities\.RegistroLivro\.filter/);
  assert.match(timelineService, /if \(runtimeClient\) return client\.entities\.PublicacaoExOfficio\.filter/);
  assert.match(timelineService, /fetchScopedPublicacoesBundle\(\{ purpose: 'LIVRO', militarId \}\)/);
  assert.match(timelineService, /fetchScopedPublicacoesBundle\(\{ purpose: 'PUBLICACOES', militarId \}\)/);
  assert.match(comportamentoRPService, /if \(serviceClient !== base44Client\)[\s\S]*serviceClient\.entities\.PublicacaoExOfficio\.filter/);
  assert.match(comportamentoRPService, /purpose: 'COMPORTAMENTO'/);
  assert.match(migracaoLegadoService, /if \(client !== defaultBase44\)[\s\S]*client\.entities\.PublicacaoExOfficio\.filter/);
  assert.match(migracaoLegadoService, /purpose: 'MIGRACAO'/);
});

test('L09D bloco 3: reader canônico separa finalidades e só lê Livro/ExOfficio por service role', () => {
  for (const purpose of ['CONTROL', 'PUBLICACOES', 'LIVRO', 'CONCILIACAO', 'RP', 'REGISTRO_RP', 'MIGRACAO', 'ATESTADOS', 'QUADRO', 'COMPORTAMENTO']) {
    assert.match(publicacoesBundleBackend, new RegExp(`${purpose}:`));
  }
  assert.match(publicacoesBundleBackend, /functions\.invoke\('getUserPermissions'/);
  assert.match(publicacoesBundleBackend, /asServiceRole\.entities\[entityName\]/);
  assert.match(publicacoesBundleBackend, /listarMilitarIdsDoEscopo/);
  assert.match(publicacoesBundleBackend, /purpose === 'MIGRACAO'/);
  assert.match(publicacoesBundleBackend, /purpose === 'COMPORTAMENTO'/);
});

test('L09E: histórico de ImportacaoMilitares usa gateway e não transporta snapshot bruto para a listagem', () => {
  assert.match(migracaoMilitaresService, /criarHistoricoImportacaoMilitaresGateway/);
  assert.match(migracaoMilitaresService, /atualizarHistoricoImportacaoMilitaresGateway/);
  assert.match(migracaoMilitaresService, /obterAnaliseImportacaoMilitaresGateway/);
  assert.match(historicoImportacoesService, /listarHistoricoImportacaoMilitaresGateway/);
  assert.match(historicoImportacoesService, /excluirHistoricoImportacaoMilitaresGateway/);
  assert.match(importacaoHistoricoClient, /functions\.invoke\('importacaoMilitaresHistoricoGateway'/);
  assert.match(importacaoHistoricoGateway, /LIST_HISTORY/);
  assert.match(importacaoHistoricoGateway, /relatorioHistoricoSeguro/);
  assert.match(importacaoHistoricoGateway, /linhaHistoricoSegura/);
  assert.doesNotMatch(historicoImportacoesService, /base44\.entities\.ImportacaoMilitares\.(list|filter|get|create|update|delete)/);
});

test('L09E: exclusão do histórico exige capacidade mutável além da leitura', () => {
  assert.match(importacaoHistoricoGateway, /ver_historico_importacoes/);
  assert.match(importacaoHistoricoGateway, /importar_militares/);
  assert.match(importacaoHistoricoGateway, /exigirExclusao/);
  assert.match(historicoImportacoesPage, /canAccessAction\('importar_militares'\)/);
  assert.match(historicoImportacoesLista, /podeExcluirHistorico/);
});

test('L09E: finalização troca análise ativa por auditoria mínima sem retomada', () => {
  assert.match(migracaoMilitaresService, /AUDITORIA_MINIMA_V1/);
  assert.match(migracaoMilitaresService, /permite_retomada: false/);
  assert.match(migracaoMilitaresService, /relatorioAuditoriaMinimaFromAnalise/);
  assert.match(migracaoMilitaresService, /tipo_relatorio === RELATORIO_IMPORTACAO_TIPO_AUDITORIA_MINIMA/);
  assert.doesNotMatch(historicoImportacoesService, /\bcpf:/);
  assert.doesNotMatch(historicoImportacoesService, /\btelefone:/);
});

test('L09E: migração retroativa de snapshots é admin-only, idempotente e limitada a lotes finalizados', () => {
  assert.match(importacaoHistoricoGateway, /MIGRATE_FINALIZED_SNAPSHOTS/);
  assert.match(importacaoHistoricoGateway, /authz\?\.isAdmin !== true/);
  assert.match(importacaoHistoricoGateway, /new Set\(\['Importado', 'Importado Parcial', 'Falhou'\]\)/);
  assert.match(importacaoHistoricoGateway, /relatorioAuditoriaMinimaPersistente/);
  assert.match(importacaoHistoricoGateway, /tipo_relatorio === 'AUDITORIA_MINIMA_V1'/);
  assert.match(importacaoHistoricoGateway, /permite_retomada === false/);
  assert.match(importacaoHistoricoGateway, /asServiceRole\.entities\[ENTITY\]\.update/);
  assert.match(importacaoHistoricoClient, /migrarSnapshotsFinalizadosImportacaoMilitaresGateway/);
  assert.match(importacaoHistoricoGateway, /action === 'LIST_HISTORY'[\s\S]*authz\?\.isAdmin === true[\s\S]*relatorioAuditoriaMinimaPersistente/);
  assert.match(importacaoHistoricoGateway, /snapshotsMigrados/);
  assert.doesNotMatch(historicoImportacoesPage, /migrarSnapshotsFinalizadosImportacaoMilitaresGateway/);
  assert.doesNotMatch(importacaoHistoricoGateway, /finalStatuses = new Set\(\[[^\]]*Analisado/);
});

test('L09E: ImportacaoMilitares permanece service-only', () => {
  assert.match(importacaoMilitaresSchema, /"create"\s*:\s*false/);
  assert.match(importacaoMilitaresSchema, /"read"\s*:\s*false/);
  assert.match(importacaoMilitaresSchema, /"update"\s*:\s*false/);
  assert.match(importacaoMilitaresSchema, /"delete"\s*:\s*false/);
});

test('L09D: entidades fechadas dos blocos 1, 2 e 3 permanecem service-only', async () => {
  for (const entityName of ['AjusteSaldoFerias', 'DescontoFerias', 'Ferias', 'PeriodoAquisitivo', 'RegistroLivro', 'PublicacaoExOfficio']) {
    const source = await readFile(
      new URL(`../../../../base44/entities/${entityName}.jsonc`, import.meta.url),
      'utf8',
    );
    const schema = JSON.parse(source);
    assert.deepEqual(
      schema.rls,
      { create: false, read: false, update: false, delete: false },
      `${entityName} deve permanecer fechado para o SDK cliente`,
    );
  }
});
