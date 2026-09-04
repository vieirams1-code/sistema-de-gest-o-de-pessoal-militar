import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const publicacoes = read('../../../pages/Publicacoes.jsx');
const cadastrarRp = read('../../../pages/CadastrarRegistroRP.jsx');
const publicacaoCard = read('../../publicacao/PublicacaoCard.jsx');
const ajustesFerias = read('../../../pages/AjustesSaldoFerias.jsx');
const lotacao = read('../../../pages/LotacaoMilitares.jsx');
const funcoes = read('../../../pages/Funcoes.jsx');
const cursos = read('../../../pages/CursosFormacao.jsx');
const fichaTabs = read('../../../services/militarFichaTabsVisibility.js');
const contratos = read('../../../pages/ContratosDesignacao.jsx');
const verMilitar = read('../../../pages/VerMilitar.jsx');
const backendCud = read('../../../../base44/functions/cudEscopado/entry.ts');
const perfis = read('../../../pages/PerfisPermissao.jsx');
const permissoesUsuarios = read('../../../pages/PermissoesUsuarios.jsx');
const atestados = read('../../../pages/Atestados.jsx');
const permissionStructure = read('../../../config/permissionStructure.js');
const agendarJiso = read('../../../pages/AgendarJISO.jsx');
const editarJiso = read('../../../pages/EditarJISO.jsx');
const centralAtestado = read('../../central-pendencias/CentralPendenciaAtestadoModal.jsx');
const quadroCard = read('../../quadro/CardDetalheModal.jsx');
const medalhasPage = read('../../../pages/Medalhas.jsx');
const cadastroMedalha = read('../../../pages/CadastrarMedalha.jsx');
const domPedro = read('../../../pages/IndicacoesDomPedroII.jsx');
const apuracaoMedalhas = read('../../../pages/ApuracaoMedalhasTempoServico.jsx');
const verMilitarPage = read('../../../pages/VerMilitar.jsx');
const antiguidadeImportar = read('../../../pages/AntiguidadeImportarPromocoes.jsx');
const carreiraAntiguidade = read('../../antiguidade/CarreiraAntiguidadePanel.jsx');
const cadastroArmamento = read('../../../pages/CadastrarArmamento.jsx');
const solicitarAtualizacao = read('../../militar/SolicitarAtualizacaoModal.jsx');
const solicitacoesAtualizacao = read('../../../pages/SolicitacoesAtualizacao.jsx');
const configuracoesPortal = read('../../../pages/ConfiguracoesPortal.jsx');
const portalServicos = read('../../../../base44/functions/portal_servicos/entry.ts');
const tiposPublicacaoManager = read('../../configuracoes/TiposPublicacaoManager.jsx');
const medicosPage = read('../../../pages/Medicos.jsx');
const medicoForm = read('../../atestado/MedicoFormDialog.jsx');
const tiposMedalhaPage = read('../../../pages/TiposMedalha.jsx');
const subtiposDoemsPage = read('../../../pages/SubtiposDOEMS.jsx');
const templatesTextoPage = read('../../../pages/TemplatesTexto.jsx');
const funcaoSelector = read('../../militar/FuncaoSelector.jsx');
const lotacaoSelector = read('../../militar/LotacaoSelector.jsx');
const saneamentoQuadroMilitar = read('../../../services/saneamentoQuadroMilitarService.js');
const promocoesPage = read('../../../pages/Promocoes.jsx');
const detalhePromocaoPage = read('../../../pages/DetalhePromocao.jsx');
const antiguidadeConfigQuadros = read('../../../pages/AntiguidadeConfigQuadros.jsx');
const periodoGenerator = read('../../ferias/PeriodoAquisitivoGenerator.jsx');
const acervoHistoricoService = read('../../../services/acervoHistoricoService.js');
const gratificacoesService = read('../../../services/gratificacoesFuncaoService.js');
const publicarPromocaoBackend = read('../../../../base44/functions/publicarPromocaoOficial/entry.ts');
const reverterPromocaoBackend = read('../../../../base44/functions/reverterPublicacaoPromocaoMilitarTx/entry.ts');
const excluirPromocaoBackend = read('../../../../base44/functions/excluirCadeiaPromocaoMilitarTx/entry.ts');
const gerirGratificacaoBackend = read('../../../../base44/functions/gerirRascunhoGratificacaoFuncao/entry.ts');

test('criação de publicação depende somente de adicionar_publicacoes', () => {
  assert.match(publicacoes, /const canCriarPublicacoes = canAccessAction\('adicionar_publicacoes'\);/);
  assert.doesNotMatch(publicacoes, /canCriarPublicacoes = .*editar_publicacoes/);
  assert.doesNotMatch(publicacoes, /canCriarPublicacoes = .*admin_mode/);
});

test('editar e publicar RP não herdam admin_mode', () => {
  assert.match(cadastrarRp, /const canGerirPublicacoes = canAccessAction\('editar_publicacoes'\);/);
  assert.match(cadastrarRp, /const canPublicarBg = canAccessAction\('publicar_bg'\);/);
});

test('PublicacaoCard exige permissões exatas para publicar e excluir', () => {
  assert.match(publicacaoCard, /const podePublicarBg = canAccessAction\('publicar_bg'\);/);
  assert.match(publicacaoCard, /canAccessAction\('excluir_publicacoes'\)\s*&&\s*canAccessAction\('admin_mode'\)/s);
});

test('créditos de férias separam visualizar, criar e cancelar', () => {
  assert.match(ajustesFerias, /canAccessModule\('ferias'\) && canAccessAction\('visualizar_creditos_ferias'\)/);
  assert.match(ajustesFerias, /const canCriar = canAccessAction\('criar_credito_extra_ferias'\);/);
  assert.match(ajustesFerias, /const canCancelar = canAccessAction\('cancelar_credito_extra_ferias'\);/);
  assert.doesNotMatch(ajustesFerias, /canCriar = .*editar_credito_extra_ferias/);
  assert.doesNotMatch(ajustesFerias, /canCancelar = .*editar_credito_extra_ferias/);
});

test('lotação usa permissões próprias, sem herdar estrutura ou permissões de usuários', () => {
  assert.match(lotacao, /canAccessModule\('lotacao_militares'\) && canAccessAction\('visualizar_lotacao_militares'\)/);
  assert.match(lotacao, /const canManageLotacao = canAccessAction\('gerir_lotacao_militares'\);/);
  assert.doesNotMatch(lotacao, /canAccessAction\('gerir_estrutura'\) \|\| canAccessAction\('gerir_permissoes'\)/);
});

test('funções e cursos não usam OR para substituir módulo por ação', () => {
  assert.match(funcoes, /canAccessModule\('adicoes_personalizacoes'\) && canAccessAction\('gerir_adicoes_personalizacoes'\)/);
  assert.doesNotMatch(funcoes, /canAccessAction\('gerir_configuracoes'\) \|\|/);
  assert.match(cursos, /canAccessModule\('cursos_formacao'\) && canAccessAction\('visualizar_cursos_formacao'\)/);
});

test('abas sensíveis da ficha exigem permissão explícita de visualização', () => {
  assert.match(fichaTabs, /canAccessModule\('atestados'\)\s*&& canAccessAction\('visualizar_atestados'\)/s);
  assert.match(fichaTabs, /canAccessModule\('armamentos'\)\s*&& canAccessAction\('visualizar_armamentos'\)/s);
});

test('contratos usam capacidades separadas no frontend e backend', () => {
  for (const key of ['visualizar_contratos_designacao', 'criar_contrato_designacao', 'editar_metadados_contrato_designacao', 'encerrar_contrato_designacao', 'excluir_contrato_designacao']) {
    assert.match(contratos, new RegExp(`canAccessAction\\('${key}'\\)`));
  }
  assert.doesNotMatch(contratos, /gerir_contratos_designacao/);
  assert.doesNotMatch(verMilitar, /gerir_contratos_designacao/);
  assert.doesNotMatch(backendCud, /ou gerir_contratos_designacao/);
});

test('desligar módulo limpa ações filhas; ligar módulo não concede ações automaticamente', () => {
  for (const source of [perfis, permissoesUsuarios]) {
    assert.match(source, /const ativarModulo = prev\[mod\.key\] !== true;/);
    assert.match(source, /if \(ativarModulo\) return \{ \.\.\.prev, \[mod\.key\]: true \};/);
    assert.match(source, /\(mod\.actions \|\| \[\]\)\.forEach\(\(act\) => \{ next\[act\.key\] = false; \}\);/);
  }
});

test('Atestados possui uma única permissão canônica de exclusão', () => {
  assert.match(atestados, /const canExcluirAtestado = canAccessAction\('excluir_atestado'\);/);
  assert.doesNotMatch(permissionStructure, /perm_excluir_atestados/);
  assert.match(permissionStructure, /perm_excluir_atestado/);
});

test('JISO separa gestão administrativa de registro da decisão', () => {
  assert.match(agendarJiso, /const canViewJisoAgenda = canAccessAction\('gerir_jiso'\) \|\| canAccessAction\('registrar_decisao_jiso'\);/);
  assert.match(editarJiso, /const canRegistrarDecisaoJiso = canAccessAction\('registrar_decisao_jiso'\);/);
  assert.doesNotMatch(editarJiso, /canAccessAction\('gerir_jiso'\) \|\| canAccessAction\('registrar_decisao_jiso'\)/);
  assert.match(centralAtestado, /&& canAccessAction\('gerir_jiso'\)/);
  assert.match(quadroCard, /permiteEditarDataJiso = !!vinculoAtestado\?\.referencia_id && canAccessAction\('gerir_jiso'\)/);
  assert.match(backendCud, /requiredPermission = 'registrar_decisao_jiso';\s*allowed = targetPerms\.actions\?\.\['registrar_decisao_jiso'\] === true;/s);
  assert.doesNotMatch(backendCud, /registrar_decisao_jiso ou gerir_jiso/);
});

test('medalhas usam permissões específicas no backend e não gravam direto pelo SDK', () => {
  assert.match(backendCud, /statusFinal === 'CONCEDIDA'.*requiredPermission = 'conceder_medalhas'/s);
  assert.match(backendCud, /resetar_indicacoes_medalhas/);
  assert.match(medalhasPage, /const podeExcluirMedalha = canAccessAction\('excluir_medalhas'\);/);
  for (const source of [medalhasPage, cadastroMedalha, domPedro, apuracaoMedalhas, verMilitarPage]) {
    assert.doesNotMatch(source, /base44\.entities\.(Medalha|ImpedimentoMedalha)\.(create|update|delete|bulkUpdate|bulkCreate)/);
  }
});

test('histórico de promoções possui escrita administrativa server-side', () => {
  assert.match(backendCud, /entityName === 'HistoricoPromocaoMilitarV2'/);
  assert.match(backendCud, /alterações no histórico de promoções são restritas ao administrador da plataforma/);
  assert.match(antiguidadeImportar, /if \(!isAdmin\) return <AccessDenied modulo="Gestão da Antiguidade" \/>/);
  for (const source of [antiguidadeImportar, carreiraAntiguidade]) {
    assert.doesNotMatch(source, /base44\.entities\.HistoricoPromocaoMilitarV2\.(create|update|delete)/);
  }
});

test('armamentos exigem permissões específicas e escrita escopada', () => {
  assert.match(cadastroArmamento, /canAccessAction\('adicionar_armamentos'\)/);
  assert.match(cadastroArmamento, /canAccessAction\('editar_armamentos'\)/);
  assert.match(backendCud, /Armamento:\s*\{\s*create: 'adicionar_armamentos',\s*update: 'editar_armamentos',\s*delete: 'excluir_armamentos'/s);
  assert.doesNotMatch(cadastroArmamento, /base44\.entities\.Armamento\.(create|update|delete)/);
});

test('solicitações cadastrais não possuem fallback de escrita direta no frontend', () => {
  assert.doesNotMatch(solicitarAtualizacao, /base44\.entities\.SolicitacaoAtualizacao\.create/);
  assert.doesNotMatch(solicitacoesAtualizacao, /base44\.entities\.(SolicitacaoAtualizacao|Militar)\.(create|update|delete)/);
  assert.doesNotMatch(configuracoesPortal, /base44\.entities\.(SolicitacaoAtualizacao|Militar|PortalAuthConfig)\.(create|update|delete)/);
  assert.match(solicitacoesAtualizacao, /O backend não confirmou a decisão da solicitação/);
  assert.match(configuracoesPortal, /O backend não confirmou a gravação das configurações do Portal/);
});

test('portal_servicos separa escopo global de privilégio e valida escopo nas decisões cadastrais', () => {
  assert.doesNotMatch(portalServicos, /normalizarTipoAcesso\(a\?\.tipo_acesso\) === 'admin'\)\) return true;\s*\n\s*const perfilIds/);
  assert.match(portalServicos, /Apenas role=admin da plataforma possui bypass/);
  assert.match(portalServicos, /usuarioPodeAgirSobreMilitarPortal\(base44, user, String\(sol\.militar_id \|\| ''\)\)/);
  assert.match(portalServicos, /usuarioPodeAgirSobreMilitarPortal\(base44, user, String\(militar_id\)\)/);
});

test('cadastros administrativos e utilitários passam pelo backend seguro', () => {
  for (const source of [tiposPublicacaoManager, medicosPage, medicoForm, tiposMedalhaPage, subtiposDoemsPage, templatesTextoPage, funcaoSelector, lotacaoSelector, saneamentoQuadroMilitar]) {
    assert.doesNotMatch(source, /base44\.entities\.(TipoPublicacaoCustom|Medico|TipoMedalha|SubtipoDOEMS|TemplateTexto|Funcao|Lotacao|Militar)\.(create|update|delete|bulkCreate|bulkUpdate)/);
  }
  assert.match(backendCud, /TipoPublicacaoCustom:\s*\{\s*create: 'gerir_configuracoes'/s);
  assert.match(backendCud, /TipoMedalha:\s*\{\s*create: 'editar_medalhas'/s);
  assert.match(backendCud, /TemplateTexto:\s*\{\s*create: 'gerir_templates'/s);
  assert.match(backendCud, /Medico:\s*\{\s*create: 'adicionar_atestados'/s);
  assert.match(backendCud, /manutenção do cadastro de médicos é administrativa/);
  assert.match(backendCud, /manutenção de subtipos DOEMS é administrativa/);
});

test('cadastros rápidos respeitam permissões estruturais existentes', () => {
  assert.match(funcaoSelector, /canAccessAction\('gerir_adicoes_personalizacoes'\)/);
  assert.match(lotacaoSelector, /canAccessAction\('gerir_estrutura_organizacional'\)/);
  assert.match(backendCud, /Funcao:\s*\{\s*create: 'gerir_adicoes_personalizacoes'/s);
  assert.match(backendCud, /Lotacao:\s*\{\s*create: 'gerir_estrutura_organizacional'/s);
  assert.match(saneamentoQuadroMilitar, /atualizarEscopado\('Militar', militar\.id, QBMPT_PARA_QPTBM_PAYLOAD\)/);
});

test('tipos de medalha exigem permissão de edição do módulo', () => {
  assert.match(tiposMedalhaPage, /const podeEditarTiposMedalha = canAccessAction\('editar_medalhas'\);/);
  assert.match(tiposMedalhaPage, /if \(!podeEditarTiposMedalha\) return <AccessDenied modulo="Configuração de Tipos de Medalha" \/>/);
});

test('promoções e configuração de antiguidade têm escrita administrativa server-side', () => {
  assert.match(backendCud, /\['Promocao', 'PromocaoMilitar', 'ConfiguracaoAntiguidade'\]\.includes\(entityName\)/);
  assert.match(backendCud, /gestão de promoções\/antiguidade é restrita ao administrador da plataforma/);
  for (const source of [promocoesPage, detalhePromocaoPage, antiguidadeConfigQuadros]) {
    assert.doesNotMatch(source, /base44\.entities\.(Promocao|PromocaoMilitar|ConfiguracaoAntiguidade)\.(create|update|delete|bulkCreate|bulkUpdate)/);
  }
  assert.match(promocoesPage, /\{isAdmin && \(\s*<Button[\s\S]*Nova Promoção/);
  assert.match(detalhePromocaoPage, /\{isAdmin && \(\s*<Button[\s\S]*Salvar alterações/);
});

test('functions transacionais de promoção exigem administrador real', () => {
  for (const source of [publicarPromocaoBackend, reverterPromocaoBackend, excluirPromocaoBackend]) {
    assert.match(source, /String\(authUser\.role \|\| ''\)\.trim\(\)\.toLowerCase\(\) !== 'admin'/);
    assert.match(source, /requer_administrador_plataforma/);
  }
  assert.match(publicarPromocaoBackend, /import \{ atualizarCadastroMilitar \} from '\.\/utils\.ts';/);
});

test('períodos aquisitivos e acervo residual usam cudEscopado', () => {
  assert.match(periodoGenerator, /bulkEscopado\('PeriodoAquisitivo'/);
  assert.match(backendCud, /entityName === 'PeriodoAquisitivo' && subOp === 'create'[\s\S]*'gerar_periodos_aquisitivos'/);
  assert.doesNotMatch(periodoGenerator, /base44\.entities\.PeriodoAquisitivo\.bulkCreate/);
  assert.match(acervoHistoricoService, /atualizarEscopado\('AcervoFuncionalHistorico'/);
  assert.doesNotMatch(acervoHistoricoService, /base44\.entities\.AcervoFuncionalHistorico\.update/);
});

test('gratificações separam permissão funcional de escopo organizacional', () => {
  assert.match(gratificacoesService, /excluirEscopado\('GratificacaoFuncao', id\)/);
  assert.match(backendCud, /GratificacaoFuncao:\s*\{\s*delete: 'gerir_gratificacoes_funcao'/s);
  assert.match(gerirGratificacaoBackend, /const authIsAdmin = String\(authUser\.role \|\| ''\)\.toLowerCase\(\) === 'admin';/);
  assert.match(gerirGratificacaoBackend, /podeAgirSobreMilitar\(base44, authUser, authPerms\.acessos, data\.militar_id\)/);
  assert.match(gerirGratificacaoBackend, /militar fora do escopo organizacional/);
  assert.doesNotMatch(gerirGratificacaoBackend, /authPerms\.isAdminByAccess/);
});

test('ações JISO independentes conseguem persistir apenas seus próprios reflexos', () => {
  assert.match(backendCud, /const camposGestaoJiso = new Set\(\['necessita_jiso', 'status_jiso', 'data_jiso_agendada', 'hora_jiso_agendada'\]\);/);
  assert.match(backendCud, /requiredPermission = 'gerir_jiso';\s*allowed = targetPerms\.actions\?\.\['gerir_jiso'\] === true;/s);
  assert.match(backendCud, /const camposDecisaoJiso = new Set\(\['dias_original', 'dias_jiso', 'data_termino_jiso', 'data_retorno_jiso', 'jiso_id'\]\);/);
  assert.match(backendCud, /if \(tipoPublicacao === 'Ata JISO'\) requiredPermission = 'publicar_ata_jiso';/);
  assert.match(backendCud, /if \(tipoPublicacao === 'Homologação de Atestado'\) requiredPermission = 'publicar_homologacao';/);
});
