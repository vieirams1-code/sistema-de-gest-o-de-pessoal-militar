import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const userPermissions = read('../../../../base44/functions/getUserPermissions/entry.ts');
const criarAjuste = read('../../../../base44/functions/criarAjusteSaldoFerias/entry.ts');
const cancelarAjuste = read('../../../../base44/functions/cancelarAjusteSaldoFerias/entry.ts');
const criarDesconto = read('../../../../base44/functions/criarDescontoFeriasGateway/entry.ts');
const ativarDesconto = read('../../../../base44/functions/ativarDescontoFeriasPublicado/entry.ts');
const cancelarDesconto = read('../../../../base44/functions/cancelarDescontoFeriasPendente/entry.ts');
const solicitarReversao = read('../../../../base44/functions/solicitarReversaoDescontoFerias/entry.ts');
const ativarReversao = read('../../../../base44/functions/ativarReversaoDescontoFeriasPublicado/entry.ts');
const jisoWhatsApp = read('../../../../base44/functions/notificarJisoWhatsAppTemplate/entry.ts');
const signedUrl = read('../../../../base44/functions/getAtestadoAnexoSignedUrl/entry.ts');
const zipAtestados = read('../../../../base44/functions/gerarZipAnexosAtestados/entry.ts');
const atestadoActionsMenu = read('../../atestado/AtestadoActionsMenu.jsx');
const extratoAtestados = read('../../../pages/ExtratoAtestadosMedicos.jsx');
const acervo = read('../../../../base44/functions/gerirAcervoHistorico/entry.ts');
const lotacao = read('../../../../base44/functions/moverMilitaresLotacao/entry.ts');
const antiguidade = read('../../../../base44/functions/getPreviaAntiguidadeMilitares/entry.ts');
const auditoriaAtestados = read('../../../../base44/functions/registrarAuditoriaExtratoAtestados/entry.ts');
const cud = read('../../../../base44/functions/cudEscopado/entry.ts');

test('resolvedor canônico oferece checagem de escopo por militar sem transformar escopo global em ação', () => {
  assert.match(userPermissions, /const scopeMilitarIds = sanitizarScopeMilitarIds\(payload\?\.scopeMilitarIds\);/);
  assert.match(userPermissions, /resolverScopeCheckMilitares\([\s\S]*scopeMilitarIds,[\s\S]*acessos \|\| \[\],[\s\S]*hasGlobalScope/s);
  assert.match(userPermissions, /scopeCheck,/);
  assert.match(userPermissions, /if \(hasGlobalScope\) \{[\s\S]*allowedIds: requestedIds/s);
  assert.doesNotMatch(userPermissions, /hasGlobalScope[^\n]*actions/);
});

test('ajustes manuais de férias exigem capacidades explícitas e escopo', () => {
  assert.match(criarAjuste, /actions\?\.criar_credito_extra_ferias !== true/);
  assert.match(criarAjuste, /scopeCheck\?\.allAllowed !== true/);
  assert.match(cancelarAjuste, /actions\?\.cancelar_credito_extra_ferias !== true/);
  assert.match(cancelarAjuste, /scopeCheck\?\.allAllowed !== true/);
  assert.doesNotMatch(criarAjuste, /tipo_acesso/);
  assert.doesNotMatch(cancelarAjuste, /tipo_acesso/);
});

test('ciclo de desconto de férias exige ações documentais específicas e escopo', () => {
  assert.match(criarDesconto, /const required = \['criar_credito_extra_ferias', 'adicionar_publicacoes'\]/);
  assert.match(criarDesconto, /if \(exigePublicarBg\) required\.push\('publicar_bg'\)/);
  assert.match(criarDesconto, /scopeCheck\?\.allAllowed !== true/);
  assert.doesNotMatch(criarDesconto, /isAdminByAccess|tipo_acesso/);

  assert.match(ativarDesconto, /actions\?\.publicar_bg !== true/);
  assert.match(cancelarDesconto, /actions\?\.excluir_publicacoes !== true/);
  assert.match(solicitarReversao, /actions\?\.tornar_sem_efeito_publicacao !== true/);
  assert.match(ativarReversao, /actions\?\.publicar_bg !== true/);
  for (const source of [ativarDesconto, cancelarDesconto, solicitarReversao, ativarReversao]) {
    assert.match(source, /scopeCheck\?\.allAllowed !== true/);
  }
});

test('notificação JISO via WhatsApp exige gerir_jiso e escopo do militar', () => {
  assert.match(jisoWhatsApp, /actions\?\.gerir_jiso !== true/);
  assert.match(jisoWhatsApp, /scopeMilitarIds: \[militarId\]/);
  assert.match(jisoWhatsApp, /scopeCheck\?\.allAllowed !== true/);
  assert.match(jisoWhatsApp, /jiso_whatsapp_enviado_por: effectiveEmail/);
});

test('downloads de anexos médicos usam capacidades próprias sem dependência oculta de dados sensíveis', () => {
  assert.match(signedUrl, /\['visualizar_atestados', 'baixar_anexos_atestados'\]/);
  assert.match(zipAtestados, /\['visualizar_atestados', 'baixar_zip_atestados'\]/);
  assert.doesNotMatch(signedUrl, /\['visualizar_atestados', 'baixar_anexos_atestados', 'ver_dados_sensiveis_atestado'\]/);
  assert.doesNotMatch(zipAtestados, /\['visualizar_atestados', 'baixar_zip_atestados', 'ver_dados_sensiveis_atestado'\]/);
  assert.match(signedUrl, /getScopedAtestadosBundle/);
  assert.match(zipAtestados, /getScopedAtestadosBundle/);

  assert.match(atestadoActionsMenu, /canDownloadAttachments = canAccessAction\('baixar_anexos_atestados'\)/);
  assert.doesNotMatch(atestadoActionsMenu, /canDownloadAttachments && canViewSensitive/);
  assert.match(extratoAtestados, /if \(!canDownloadZip\)/);
  assert.match(extratoAtestados, /if \(!canDownloadAttachments\)/);
  assert.doesNotMatch(extratoAtestados, /canDownloadZip && canViewSensitive/);
  assert.doesNotMatch(extratoAtestados, /canDownloadAttachments && canViewSensitive/);
});

test('acervo histórico exige gestão explícita e escopo antes da escrita', () => {
  assert.match(acervo, /actions\?\.gerir_acervo_historico !== true/);
  assert.match(acervo, /scopeCheck\?\.allAllowed !== true/);
  assert.match(acervo, /Documento anterior inválido ou pertencente a outro militar/);
  assert.match(acervo, /usuario_cadastro: effectiveEmail/);
});

test('lotação não herda permissão de estrutura nem administração de permissões', () => {
  assert.match(lotacao, /const ACTIONS_AUTORIZADAS = \['gerir_lotacao_militares'\]/);
  assert.doesNotMatch(lotacao, /const ACTIONS_AUTORIZADAS = \[[^\]]*gerir_estrutura/);
  assert.doesNotMatch(lotacao, /const ACTIONS_AUTORIZADAS = \[[^\]]*gerir_permissoes/);
});

test('prévia de antiguidade exige módulo, ação e escopo dos IDs solicitados', () => {
  assert.match(antiguidade, /modules\?\.antiguidade === true/);
  assert.match(antiguidade, /actions\?\.visualizar_rastreamento_promocoes === true/);
  assert.match(antiguidade, /scopeMilitarIds: idsMilitares/);
  assert.match(antiguidade, /scopeCheck\?\.allAllowed !== true/);
});

test('auditoria de extrato deriva identidade e horário do servidor', () => {
  assert.match(auditoriaAtestados, /usuario_email: normalizeString\(authUser\.email/);
  assert.match(auditoriaAtestados, /usuario_id: normalizeString\(authUser\.id/);
  assert.match(auditoriaAtestados, /data_hora: nowIso/);
  assert.doesNotMatch(auditoriaAtestados, /usuario_email: normalizeString\(payload\?\.usuario_email/);
  assert.doesNotMatch(auditoriaAtestados, /usuario_id: normalizeString\(payload\?\.usuario_id/);
  assert.doesNotMatch(auditoriaAtestados, /data_hora: normalizeString\(payload\?\.data_hora/);
});

test('cudEscopado usa capacidades granulares de férias e protege publicação de BG', () => {
  assert.match(cud, /Ferias:\s*\{\s*create: 'criar_ferias'/s);
  assert.match(cud, /PeriodoAquisitivo:\s*\{\s*create: 'gerar_periodos_aquisitivos',[\s\S]*update: 'editar_periodo_aquisitivo',[\s\S]*delete: 'excluir_periodo_aquisitivo'/s);
  assert.match(cud, /CreditoExtraFerias:\s*\{\s*create: 'criar_credito_extra_ferias',[\s\S]*update: 'editar_credito_extra_ferias',[\s\S]*delete: 'excluir_credito_extra_ferias'/s);
  assert.match(cud, /statusCredito === 'CANCELADO'[\s\S]*'cancelar_credito_extra_ferias'/s);
  assert.match(cud, /'vincular_credito_extra_ferias'/);
  assert.match(cud, /'remover_vinculo_credito_extra_ferias'/);
  assert.match(cud, /tipoPublicacao === 'Apostila'.*requiredPermissions = \['apostilar_publicacao'\]/s);
  assert.match(cud, /tipoPublicacao === 'Tornar sem Efeito'.*requiredPermissions = \['tornar_sem_efeito_publicacao'\]/s);
  assert.match(cud, /apenasApostilamento[\s\S]*'apostilar_publicacao'/s);
  assert.match(cud, /apenasTornarSemEfeito[\s\S]*'tornar_sem_efeito_publicacao'/s);
  assert.match(cud, /requiredPermissions = \[\.\.\.requiredPermissions, 'publicar_bg'\]/);
});
