/**
 * accessRegistry.js — P1.1 (MIRROR / READ-ONLY)
 * ============================================================================
 * ATENÇÃO: Este arquivo é TOTALMENTE PASSIVO.
 *
 *  - mode: 'mirror'
 *  - NÃO aplica enforcement.
 *  - NÃO altera comportamento do sistema.
 *  - NÃO é importado por Layout.jsx, App.jsx ou useCurrentUser.jsx.
 *  - Serve apenas para DOCUMENTAÇÃO TÉCNICA, DIAGNÓSTICO e COMPARAÇÃO FUTURA.
 *
 * Esta é a fotografia fiel ("mirror") de como o controle de acesso REALMENTE
 * funciona hoje, extraída literalmente de:
 *   - src/App.jsx                          (moduleGuardByPage / adminOnlyPages)
 *   - src/components/.../layout             (menuGroups / canViewMenuEntry)
 *   - src/config/permissionStructure.js     (nomes oficiais perm_/acesso_)
 *   - src/components/auth/useCurrentUser.jsx (canAccessModule / canAccessAction)
 *   - páginas e componentes específicos     (validações internas)
 *
 * A integração real (P1.2) NÃO está incluída aqui.
 * ============================================================================
 */

export const ACCESS_REGISTRY_MODE = 'mirror';

/**
 * Schema de referência (apenas documental).
 * Cada módulo do `accessRegistry` segue este formato.
 *
 * @typedef {Object} AccessModuleDefinition
 * @property {string}   label
 * @property {string}   canonicalModuleKey       Chave canônica sem prefixo (ex: 'militares')
 * @property {string[]} legacyModuleKeys         Chaves legadas, ex: ['acesso_militares']
 * @property {Array}    aliases                  Aliases/relatedAlias com observação
 * @property {Object}   permissions              { canonical, legacyPerm, legacyAcesso }
 * @property {Object[]} menuRules                Regras de visibilidade no menu (layout)
 * @property {Object[]} routeRules               Regras de rota (App.jsx)
 * @property {Object}   pageInternalChecks       Validações dentro das páginas
 * @property {Object}   componentsInternalChecks Validações dentro de componentes
 * @property {string[]} services                 Services do frontend
 * @property {string[]} backendFunctions         Funções backend (Deno)
 * @property {Object}   scope                    { applicable, enforcement }
 * @property {string}   scopeSource              Origem do escopo
 * @property {Object[]} knownDivergences         Divergências confirmadas/prováveis
 * @property {Object[]} relatedModules           Módulos relacionados / out-of-module
 * @property {Object[]} crossModuleActions       Ações de outro módulo usadas aqui
 * @property {string}   externalActionSource     Módulo de origem de ações externas (quando aplicável)
 * @property {string}   mirrorStatus             Sempre 'read-only'
 * @property {string}   risk                     'alto' | 'medio' | 'baixo'
 * @property {string}   recommendationFuture     Recomendação para P1.2+
 */

export const ACCESS_SCHEMA_FIELDS = [
  'canonicalModuleKey',
  'legacyModuleKeys',
  'aliases',
  'permissions.canonical',
  'permissions.legacyPerm',
  'permissions.legacyAcesso',
  'menuRules',
  'routeRules',
  'anyOf',
  'allOf',
  'adminOnly',
  'contextualOnly',
  'pageInternalChecks',
  'componentsInternalChecks',
  'services',
  'backendFunctions',
  'scope',
  'scopeSource',
  'knownDivergences',
  'relatedModules',
  'crossModuleActions',
  'externalActionSource',
  'mirrorStatus',
  'risk',
  'recommendationFuture',
];

// ============================================================================
// MÓDULO: MILITARES / EFETIVO
// ============================================================================
const militares = {
  label: 'Militares / Efetivo',
  canonicalModuleKey: 'militares',
  legacyModuleKeys: ['acesso_militares'],
  aliases: [
    {
      key: 'efetivo',
      type: 'relatedAlias',
      ambiguous: true,
      observation:
        "'efetivo' NÃO é alias canônico de 'militares'. App.jsx usa moduleKey 'efetivo' apenas na rota Tags ({ moduleKey: 'efetivo', actionKey: 'gerir_configuracoes' }), relacionado a Tags/configurações. Tratado aqui como alias ambíguo.",
    },
  ],
  permissions: {
    canonical: {
      view: 'visualizar_militares',
      adicionar: 'adicionar_militares',
      editar: 'editar_militares',
      excluir: 'excluir_militares',
    },
    legacyPerm: {
      view: 'perm_visualizar_militares',
      adicionar: 'perm_adicionar_militares',
      editar: 'perm_editar_militares',
      excluir: 'perm_excluir_militares',
    },
    legacyAcesso: {
      module: 'acesso_militares',
    },
  },
  // Não confirmado em permissionStructure.js: 'acesso_dados_sensiveis' para Militares.
  // Mantido apenas como nota de pendência (vide knownDivergences/relatedModules).
  menuRules: [
    {
      label: 'Consulta Militar',
      pageKey: 'Militares',
      source: 'layout.menuGroups',
      rule: { moduleKey: 'militares', actionKey: 'visualizar_militares' },
    },
    {
      label: 'Organograma',
      pageKey: 'VisualizacaoGestorEfetivo',
      source: 'layout.menuGroups',
      rule: { moduleKey: 'militares', actionKey: 'visualizar_militares' },
    },
  ],
  routeRules: [
    {
      pageKey: 'Militares',
      type: 'main',
      menuVisible: true,
      adminOnly: false,
      contextualOnly: false,
      appGuard: { moduleKey: 'militares', moduleName: 'Efetivo' },
      source: 'App.jsx.moduleGuardByPage',
    },
    {
      pageKey: 'CadastrarMilitar',
      type: 'cadastro',
      menuVisible: false,
      adminOnly: false,
      contextualOnly: true,
      appGuard: { moduleKey: 'militares', moduleName: 'Efetivo' },
      note: 'Guardado apenas por módulo no App.jsx — NÃO exige adicionar_militares na rota.',
      source: 'App.jsx.moduleGuardByPage',
    },
    {
      pageKey: 'VerMilitar',
      type: 'detail',
      menuVisible: false,
      adminOnly: false,
      contextualOnly: true,
      appGuard: { moduleKey: 'militares', actionKey: 'visualizar_militares', moduleName: 'Efetivo' },
      source: 'App.jsx.moduleGuardByPage',
    },
  ],
  pageInternalChecks: {
    'pages/Militares.jsx': [
      { check: "canAccessModule('militares')", effect: 'AccessDenied se falso' },
      { check: "canAccessAction('adicionar_militares')", effect: 'Exibe CTA "Novo Militar"' },
      { check: "canAccessAction('perm_visualizar_conferencias_militares')", effect: 'Carrega mapa de conferências' },
    ],
    'pages/VerMilitar.jsx': [
      { check: 'hasAccess(militar) || hasSelfAccess(militar)', effect: 'canViewMilitar' },
      { check: 'isAdmin', effect: 'Exibe botão Editar' },
      { check: "canAccessAction('visualizar_acervo_historico')", effect: 'Aba Acervo Histórico' },
      { check: "canAccessAction('gerir_acervo_historico')", effect: 'Gestão de acervo' },
      { check: "canAccessAction('baixar_acervo_historico')", effect: 'Download de PDFs' },
      { check: "canAccessAction('perm_visualizar_conferencias_militares')", effect: 'Conferências do militar' },
    ],
    'pages/CadastrarMilitar.jsx': [
      { check: "canAccessModule('militares')", effect: 'Acesso ao formulário (não validada action de adicionar)' },
    ],
  },
  componentsInternalChecks: {
    'components/militar/MilitarConsultaRow': [
      { check: 'canAccessAction(...) / isAdmin', effect: 'Ações por linha (passadas via props da página)' },
    ],
  },
  services: [
    'services/getScopedMilitaresClient.js#fetchScopedMilitares',
    'services/getScopedLotacoesClient.js#fetchScopedLotacoes',
    'services/getPreviaAntiguidadeMilitaresClient.js#fetchPreviaAntiguidadeMilitares',
    'services/matriculaMilitarViewService.js',
    'services/militarExclusaoService.js#excluirMilitarComDependencias',
  ],
  backendFunctions: ['getScopedMilitares', 'getScopedLotacoes', 'getPreviaAntiguidadeMilitares'],
  scope: {
    applicable: ['proprio', 'setor', 'subsetor', 'unidade', 'admin'],
    enforcement: 'misto',
    note: 'Frontend resolve via useCurrentUser (modoAcesso/getMilitarScopeFilters); escopo efetivo é aplicado no backend getScopedMilitares.',
  },
  scopeSource: 'getUserPermissions + getScopedMilitares (backend)',
  relatedModules: [
    {
      moduleKey: 'acesso_conferencias_militares',
      reason:
        'ConferenciasMilitares NÃO é ação nativa de Militares. App.jsx guarda por { moduleKey: "acesso_conferencias_militares", actionKey: "perm_visualizar_conferencias_militares" }. Permissões reais em permissionStructure.js: perm_visualizar_conferencias_militares / perm_gerir_conferencias_militares.',
      type: 'out-of-module',
    },
  ],
  crossModuleActions: [],
  externalActionSource: null,
  mirrorStatus: 'read-only',
  risk: 'medio',
  knownDivergences: [
    {
      location: 'pages/Militares.jsx (CTA) vs App.jsx (rota CadastrarMilitar)',
      affectedPageKeys: ['CadastrarMilitar'],
      ruleMenu: 'CTA "Novo Militar" exige canAccessAction("adicionar_militares")',
      ruleRoute: 'Rota CadastrarMilitar exige apenas { moduleKey: "militares" }',
      impact:
        'Usuário sem adicionar_militares não vê o botão, mas pode acessar a rota /CadastrarMilitar diretamente (a página só valida o módulo).',
      status: 'confirmado',
    },
    {
      location: "permissionStructure.js (acesso_dados_sensiveis / acesso_militares)",
      ruleMenu: 'n/a',
      ruleRoute: 'n/a',
      impact:
        "VALIDADO P1.1-C: 'acesso_dados_sensiveis' NÃO foi encontrado em permissionStructure.js nem em useCurrentUser. Não há mapeamento explícito confirmado para esse item no módulo Militares. 'acesso_militares' existe apenas como módulo. Mantido como pendência documental/artefato legado, sem enforcement.",
      status: 'nao_encontrado',
      risco: 'baixo/documental',
    },
  ],
  recommendationFuture:
    'P1.2: alinhar guard da rota CadastrarMilitar com a action adicionar_militares; manter ConferenciasMilitares como módulo próprio.',
};

// ============================================================================
// MÓDULO: FÉRIAS
// ============================================================================
const ferias = {
  label: 'Férias',
  canonicalModuleKey: 'ferias',
  legacyModuleKeys: ['acesso_ferias'],
  aliases: [],
  permissions: {
    canonical: {
      view: 'visualizar_ferias',
      visualizar_plano: 'visualizar_plano_ferias',
      visualizar_periodos_aquisitivos: 'visualizar_periodos_aquisitivos',
      visualizar_creditos: 'visualizar_creditos_ferias',
      adicionar: 'adicionar_ferias',
      criar: 'criar_ferias',
      editar: 'editar_ferias',
      alterar_data_inicio: 'alterar_data_inicio_ferias',
      lancar_inicio: 'lancar_inicio_ferias',
      interromper: 'interromper_ferias',
      continuar: 'continuar_ferias',
      lancar_retorno: 'lancar_retorno_ferias',
      excluir: 'excluir_ferias',
      gerir_cadeia: 'gerir_cadeia_ferias',
      recalcular: 'recalcular_ferias',
    },
    legacyPerm: {
      view: 'perm_visualizar_ferias',
      visualizar_plano: 'perm_visualizar_plano_ferias',
      visualizar_periodos_aquisitivos: 'perm_visualizar_periodos_aquisitivos',
      visualizar_creditos: 'perm_visualizar_creditos_ferias',
      adicionar: 'perm_adicionar_ferias',
      criar: 'perm_criar_ferias',
      editar: 'perm_editar_ferias',
      alterar_data_inicio: 'perm_alterar_data_inicio_ferias',
      lancar_inicio: 'perm_lancar_inicio_ferias',
      interromper: 'perm_interromper_ferias',
      continuar: 'perm_continuar_ferias',
      lancar_retorno: 'perm_lancar_retorno_ferias',
      excluir: 'perm_excluir_ferias',
      gerir_cadeia: 'perm_gerir_cadeia_ferias',
      recalcular: 'perm_recalcular_ferias',
    },
    legacyAcesso: {
      module: 'acesso_ferias',
    },
  },
  // Dependência externa/global — NÃO pertence ao bloco acesso_ferias.
  externalDependencies: [
    {
      key: 'admin_mode',
      legacyPerm: 'perm_admin_mode',
      sourceModule: 'acesso_configuracoes',
      observation:
        'admin_mode (perm_admin_mode) é definido em acesso_configuracoes (Administração do Sistema). Em Ferias.jsx é exigido junto com runtimeState modoAdmin para ações sensíveis.',
    },
  ],
  menuRules: [
    {
      label: 'Férias',
      pageKey: 'Ferias',
      source: 'layout.menuGroups',
      rule: { moduleKey: 'ferias', actionKey: 'visualizar_ferias', viewPermission: 'visualizar_ferias' },
    },
    {
      label: 'Dias Adicionais',
      pageKey: 'CreditosExtraordinariosFerias',
      source: 'layout.menuGroups',
      rule: { moduleKey: 'ferias', actionKey: 'visualizar_creditos_ferias' },
    },
  ],
  routeRules: [
    {
      pageKey: 'Ferias',
      type: 'main',
      menuVisible: true,
      contextualOnly: false,
      appGuard: { moduleKey: 'ferias', moduleName: 'Férias' },
      note: 'Rota module-only no App.jsx.',
      source: 'App.jsx.moduleGuardByPage',
    },
    {
      pageKey: 'CadastrarFerias',
      type: 'cadastro',
      menuVisible: false,
      contextualOnly: true,
      appGuard: { moduleKey: 'ferias', moduleName: 'Férias' },
      note: 'Rota module-only no App.jsx para não quebrar a decisão contextual; CadastrarFerias.jsx exige criar_ferias sem id e editar_ferias com id/editId.',
      source: 'App.jsx.moduleGuardByPage + pages/CadastrarFerias.jsx',
    },
    {
      pageKey: 'PlanoAnualFerias',
      type: 'contextual',
      menuVisible: false,
      contextualOnly: true,
      appGuard: { moduleKey: 'ferias', actionKey: 'visualizar_plano_ferias', moduleName: 'Férias' },
      source: 'App.jsx.moduleGuardByPage/actionGuardByPage',
    },
    {
      pageKey: 'PeriodosAquisitivos',
      type: 'contextual',
      menuVisible: false,
      contextualOnly: true,
      appGuard: { moduleKey: 'ferias', actionKey: 'visualizar_periodos_aquisitivos', moduleName: 'Férias' },
      source: 'App.jsx.moduleGuardByPage/actionGuardByPage',
    },
    {
      pageKey: 'CreditosExtraordinariosFerias',
      type: 'main',
      menuVisible: true,
      contextualOnly: false,
      appGuard: { moduleKey: 'ferias', actionKey: 'visualizar_creditos_ferias', moduleName: 'Férias' },
      source: 'App.jsx.moduleGuardByPage/actionGuardByPage',
    },
  ],
  // Ações sensíveis modeladas como allOf incorporando runtimeState e escopo.
  composedActions: {
    excluir: {
      allOf: ['excluir_ferias', 'admin_mode'],
      runtimeState: 'modoAdmin === true',
      scopeCheck: 'validarEscopoMilitar(militar_id).permitido',
      sourcePage: 'pages/Ferias.jsx#handleDelete/confirmDelete',
      note: 'handleDelete exige canAccessAction("excluir_ferias") && canAccessAction("admin_mode") && modoAdmin && escopo.',
    },
    gerir_cadeia: {
      anyOf: ['gerir_cadeia_ferias', 'recalcular_ferias'],
      dependsOn: ['isAdmin (quando aplicável)', 'admin_mode', 'runtimeState: modoAdmin'],
      sourcePage: 'pages/Ferias.jsx + components/ferias/FamiliaFeriasPanel (modoAdmin)',
      note: 'Administração da cadeia / recálculo depende de modoAdmin e admin_mode no fluxo da página.',
    },
  },
  pageInternalChecks: {
    'pages/Ferias.jsx': [
      { check: "canAccessModule('ferias')", effect: 'AccessDenied se falso' },
      { check: "canAccessAction('admin_mode')", effect: 'Exibe toggle "Modo Admin"' },
      { check: "canAccessAction('criar_ferias')", effect: 'Exibe CTA "Nova Férias" / "Cadastrar Férias"' },
      { check: "canAccessAction('editar_ferias')", effect: 'Exibe ação "Editar Férias"' },
      { check: "canAccessAction('alterar_data_inicio_ferias')", effect: 'Exibe ação "Alterar Data de Início"' },
      { check: "canAccessAction('lancar_inicio_ferias')", effect: 'Exibe ação "Início" / saída de férias' },
      { check: "canAccessAction('interromper_ferias')", effect: 'Exibe ação "Interrupção"' },
      { check: "canAccessAction('continuar_ferias')", effect: 'Exibe ação "Continuação" / nova saída / retomada' },
      { check: "canAccessAction('lancar_retorno_ferias')", effect: 'Exibe ação "Término" / retorno de férias' },
      { check: "canAccessAction('excluir_ferias') && canAccessAction('admin_mode') && modoAdmin", effect: 'Permite exclusão' },
      { check: 'validarEscopoMilitar(militar_id)', effect: 'Bloqueia ações fora do escopo' },
    ],
    'pages/CadastrarFerias.jsx': [
      { check: "canAccessModule('ferias')", effect: 'AccessDenied("Férias") se falso' },
      { check: "sem id/editId: canAccessAction('criar_ferias')", effect: 'P1.3-B.4: bloqueia entrada/salvamento de criação sem action criar_ferias' },
      { check: "com id/editId: canAccessAction('editar_ferias')", effect: 'P1.3-B.4: bloqueia entrada/salvamento de edição sem action editar_ferias' },
      { check: 'useUsuarioPodeAgirSobreMilitar().validar(militar_id)', effect: 'bloqueia salvar fora do escopo do militar (handleSubmit)' },
      { check: 'route guard', effect: 'App.jsx mantém rota module-only para permitir que a página decida a action conforme modo criação/edição.' },
    ],
  },
  componentsInternalChecks: {
    'components/ferias/FamiliaFeriasPanel': [
      { check: 'modoAdmin (prop)', effect: 'Habilita administração da cadeia operacional' },
    ],
  },
  services: [
    'services/getScopedFeriasBundleClient.js#fetchScopedFeriasBundle',
    'services/cudEscopadoClient.js#atualizarEscopado/excluirEscopado',
    'services/creditoExtraFeriasService.js',
    'services/feriasMilitarContextService.js#enriquecerFeriasComContextoMilitar',
    'components/ferias/feriasService.js#sincronizarPeriodoAquisitivoDaFerias',
  ],
  backendFunctions: ['getScopedFeriasBundle', 'cudEscopado'],
  scope: {
    applicable: ['proprio', 'setor', 'subsetor', 'unidade', 'admin'],
    enforcement: 'backend',
    note: 'Bundle escopado via getScopedFeriasBundle; escopo de escrita validado por useUsuarioPodeAgirSobreMilitar.',
  },
  scopeSource: 'getUserPermissions + getScopedFeriasBundle (backend)',
  relatedModules: [
    {
      moduleKey: 'acesso_configuracoes',
      reason: 'Origem de admin_mode/perm_admin_mode usado como dependência global.',
      type: 'external-dependency',
    },
  ],
  crossModuleActions: [],
  externalActionSource: null,
  mirrorStatus: 'read-only',
  risk: 'alto',
  knownDivergences: [
    {
      location: 'layout.menuGroups (Férias) vs App.jsx (rotas Férias)',
      ruleMenu: 'Menu "Férias" exige visualizar_ferias; menu "Dias Adicionais" exige visualizar_creditos_ferias.',
      ruleRoute: 'Rotas PlanoAnualFerias, PeriodosAquisitivos e CreditosExtraordinariosFerias exigem actions granulares; CadastrarFerias mantém route guard por módulo e aplica action contextual internamente.',
      impact:
        'Mitigado em P1.3-B.1 para visualizações granulares de plano, períodos aquisitivos e créditos; mitigado em P1.3-B.3 para visibilidade dos CTAs internos de Ferias.jsx; mitigado em P1.3-B.4 para entrada direta em CadastrarFerias por criar_ferias/editar_ferias conforme modo.',
      status: 'mitigado_p1_3_b_4',
    },
    {
      location: 'pages/Ferias.jsx (admin_mode)',
      ruleMenu: 'n/a',
      ruleRoute: 'n/a',
      impact:
        'admin_mode é permissão do módulo acesso_configuracoes, mas é consumida dentro de Férias; acoplamento cross-module não declarado no guard de rota.',
      status: 'confirmado',
    },
    {
      location: 'pages/CadastrarFerias.jsx',
      ruleMenu: 'n/a',
      ruleRoute: '{ moduleKey: "ferias" } (module-only) + enforcement interno contextual',
      impact:
        'P1.3-B.4: rota permanece module-only para não aplicar RequireAction único e cego; CadastrarFerias exige criar_ferias em criação e editar_ferias em edição, além do escopo do militar.',
      status: 'mitigado_p1_3_b_4',
    },
  ],
  recommendationFuture:
    'P1.2: declarar admin_mode explicitamente como dependência cross-module; padronizar guards de rota com visualizar_ferias quando o menu o exige.',
};

// ============================================================================
// MÓDULO: ATESTADOS / JISO
// ============================================================================
const atestados = {
  label: 'Atestados Médicos',
  canonicalModuleKey: 'atestados',
  legacyModuleKeys: ['acesso_atestados'],
  aliases: [],
  permissions: {
    canonical: {
      view: 'visualizar_atestados',
      adicionar: 'adicionar_atestados',
      editar: 'editar_atestados',
      // Canonical atual de runtime: SINGULAR (Atestados.jsx usa 'excluir_atestado').
      excluir: 'excluir_atestado',
      ver_dados_sensiveis: 'ver_dados_sensiveis_atestado',
      gerar_relatorio_dp_dintel: 'gerar_relatorio_dp_dintel_atestados',
      gerir_encaminhamento_dp_dintel: 'gerir_encaminhamento_dp_dintel_atestado',
    },
    legacyPerm: {
      view: 'perm_visualizar_atestados',
      adicionar: 'perm_adicionar_atestados',
      editar: 'perm_editar_atestados',
      excluir: 'perm_excluir_atestado',
      // Plural mantido como legacy/declared extra (existe em permissionStructure.js).
      excluir_plural: 'perm_excluir_atestados',
      ver_dados_sensiveis: 'perm_ver_dados_sensiveis_atestado',
      gerar_relatorio_dp_dintel: 'perm_gerar_relatorio_dp_dintel_atestados',
      gerir_encaminhamento_dp_dintel: 'perm_gerir_encaminhamento_dp_dintel_atestado',
    },
    legacyAcesso: {
      module: 'acesso_atestados',
    },
    declaredExtra: {
      // Existe em permissionStructure.js mas runtime usa o singular.
      excluir_plural_canonical: 'excluir_atestados',
      note: "excluir_atestados (plural) é declarado/legacy. Runtime atual em Atestados.jsx usa 'excluir_atestado' (singular).",
    },
  },
  menuRules: [
    {
      label: 'Atestados',
      pageKey: 'Atestados',
      source: 'layout.menuGroups',
      rule: { moduleKey: 'atestados', viewPermission: 'visualizar_atestados' },
    },
    {
      label: 'Extrato de Atestados',
      pageKey: 'ExtratoAtestadosMedicos',
      source: 'layout.menuGroups',
      rule: { viewPermission: 'visualizar_atestados' },
    },
    {
      label: 'Cadastro de Médicos',
      pageKey: 'Medicos',
      source: 'layout.menuGroups',
      rule: { adminOnly: true, moduleKey: 'atestados' },
    },
  ],
  routeRules: [
    {
      pageKey: 'Atestados',
      type: 'main',
      menuVisible: true,
      contextualOnly: false,
      appGuard: { moduleKey: 'atestados', moduleName: 'Atestados' },
      source: 'App.jsx.moduleGuardByPage',
    },
    {
      pageKey: 'CadastrarAtestado',
      type: 'cadastro',
      menuVisible: false,
      contextualOnly: true,
      appGuard: { moduleKey: 'atestados', moduleName: 'Atestados' },
      note: 'Protegido apenas por moduleKey atestados no App.jsx — NÃO exige adicionar_atestados.',
      source: 'App.jsx.moduleGuardByPage',
    },
    {
      pageKey: 'VerAtestado',
      type: 'detail',
      menuVisible: false,
      contextualOnly: true,
      appGuard: { moduleKey: 'atestados', moduleName: 'Atestados' },
      source: 'App.jsx.moduleGuardByPage',
    },
    {
      pageKey: 'AgendarJISO',
      type: 'main',
      menuVisible: false,
      contextualOnly: false,
      appGuard: { moduleKey: 'atestados', moduleName: 'Atestados' },
      note: 'Rota module-only; ações internas validam registrar_decisao_jiso.',
      source: 'App.jsx.moduleGuardByPage',
    },
    {
      pageKey: 'EditarJISO',
      type: 'edicao',
      menuVisible: false,
      contextualOnly: true,
      appGuard: { moduleKey: 'atestados', moduleName: 'Atestados' },
      note: 'Rota module-only; página exige internamente gerir_jiso || registrar_decisao_jiso.',
      source: 'App.jsx.moduleGuardByPage',
    },
    {
      pageKey: 'ExtratoAtestadosMedicos',
      type: 'main',
      menuVisible: true,
      contextualOnly: false,
      appGuard: { note: 'Guard de rota: sem entrada explícita em moduleGuardByPage do App.jsx (pendente). Menu exige visualizar_atestados. Uso interno da página validado com canAccessModule("atestados").' },
      source: 'layout.menuGroups (path /ExtratoAtestadosMedicos)',
    },
    {
      pageKey: 'Medicos',
      type: 'main',
      menuVisible: true,
      adminOnly: true,
      contextualOnly: false,
      appGuard: { moduleKey: 'atestados', moduleName: 'Atestados', requireAdmin: true },
      note: 'Rota adminOnly: App.jsx inclui Medicos em adminOnlyPages (RequireAdmin) E aplica moduleGuardByPage { moduleKey: "atestados" }. Menu (layout) também marca adminOnly: true. Não é rota comum apenas de módulo.',
      source: 'App.jsx.adminOnlyPages + App.jsx.moduleGuardByPage + layout.menuGroups',
    },
  ],
  pageInternalChecks: {
    'pages/Atestados.jsx': [
      { check: "canAccessModule('atestados')", effect: 'AccessDenied se falso' },
      { check: "canAccessAction('adicionar_atestados')", effect: 'Exibe CTA "Novo Atestado"' },
      { check: "canAccessAction('editar_atestados')", effect: 'Habilita edição' },
      { check: "canAccessAction('excluir_atestado')", effect: 'Habilita exclusão (SINGULAR)' },
      { check: 'validarEscopoMilitar(militar_id)', effect: 'Bloqueia ações fora do escopo' },
    ],
    'pages/CadastrarAtestado.jsx': [
      { check: "canAccessModule('atestados')", effect: 'AccessDenied se falso (não valida adicionar/editar)' },
      { check: 'validarEscopoMilitar(militar_id)', effect: 'Bloqueia salvar fora do escopo' },
    ],
    'pages/AgendarJISO.jsx': [
      { check: "canAccessModule('atestados')", effect: 'AccessDenied se falso' },
      { check: "canAccessAction('registrar_decisao_jiso')", effect: 'Exibe botão Registrar/Editar JISO' },
      { check: 'validarEscopoMilitar(militar_id)', effect: 'Bloqueia abrir edição fora do escopo' },
    ],
    'pages/EditarJISO.jsx': [
      { check: "canAccessModule('atestados')", effect: 'Parte do AccessDenied' },
      { check: "canAccessAction('gerir_jiso') || canAccessAction('registrar_decisao_jiso')", effect: 'canGerirJiso; AccessDenied se falso' },
      { check: 'validarEscopoMilitar(militar_id)', effect: 'Bloqueia salvar fora do escopo' },
    ],
    'pages/ExtratoAtestadosMedicos.jsx': [
      { check: "canAccessModule('atestados')", effect: 'VALIDADO P1.1-C: hasAccess; AccessDenied("Atestados") se falso (linha 157/534)' },
      { check: "canAccessAction('gerar_relatorio_dp_dintel_atestados')", effect: 'VALIDADO P1.1-C: habilita botão PDF DP/DINTEL (action interna do extrato)' },
      { check: "canAccessAction('gerir_encaminhamento_dp_dintel_atestado')", effect: 'VALIDADO P1.1-C: habilita marcar/desmarcar DP/DINTEL (action interna do extrato)' },
      { check: 'ver_dados_sensiveis_atestado', effect: 'VALIDADO P1.1-C: NÃO encontrado enforcement no componente; permissão declarada/passiva.' },
    ],
  },
  componentsInternalChecks: {
    'components/atestado/AtestadoCard': [
      { check: 'canEdit / canDelete (props vindas de Atestados.jsx)', effect: 'Botões editar/excluir no card' },
    ],
  },
  services: [
    'services/getScopedAtestadosBundleClient.js#fetchScopedAtestadosBundle',
    'services/atestadoJisoMilitarContextService.js#enriquecerAtestadosComContextoMilitar',
    'services/cudEscopadoClient.js#criarEscopado/atualizarEscopado',
    'services/getAtestadoAnexoSignedUrlClient.js',
    'services/gerarExtratoAtestadosClient.js',
    'services/gerarRelatorioDpDintelAtestadosClient.js',
    'services/alterarEncaminhamentoAtestadoClient.js',
  ],
  backendFunctions: [
    'getScopedAtestadosBundle',
    'getAtestadoAnexoSignedUrl',
    'getScopedExtratoAtestados',
    'gerarExtratoAtestados',
    'gerarRelatorioDpDintelAtestados',
    'gerarZipAnexosAtestados',
    'alterarEncaminhamentoAtestado',
    'cudEscopado',
  ],
  scope: {
    applicable: ['proprio', 'setor', 'subsetor', 'unidade', 'admin'],
    enforcement: 'backend',
    note: 'Bundle escopado via getScopedAtestadosBundle. Anexos têm regra própria de permissão+escopo no backend getAtestadoAnexoSignedUrl (valida visualizar_atestados e escopo do atestado).',
  },
  scopeSource: 'getUserPermissions + getScopedAtestadosBundle + getAtestadoAnexoSignedUrl (backend)',
  relatedModules: [
    {
      moduleKey: 'acesso_publicacoes',
      reason: 'JISO/publicações pertencem a Publicações, não a acesso_atestados.',
      type: 'external-action-source',
    },
    {
      moduleKey: 'acesso_controle_atestados_temporarios',
      reason: 'ControleAtestadosTemporarios é módulo próprio (perm_visualizar_controle_atestados_temporarios).',
      type: 'related',
    },
  ],
  // JISO / Publicações: ações de OUTRO módulo (acesso_publicacoes) usadas no contexto de Atestados.
  crossModuleActions: [
    { action: 'gerir_jiso', legacyPerm: 'perm_gerir_jiso', externalActionSource: 'acesso_publicacoes' },
    { action: 'registrar_decisao_jiso', legacyPerm: 'perm_registrar_decisao_jiso', externalActionSource: 'acesso_publicacoes' },
    { action: 'publicar_ata_jiso', legacyPerm: 'perm_publicar_ata_jiso', externalActionSource: 'acesso_publicacoes' },
    { action: 'publicar_homologacao', legacyPerm: 'perm_publicar_homologacao', externalActionSource: 'acesso_publicacoes' },
  ],
  externalActionSource: 'acesso_publicacoes',
  mirrorStatus: 'read-only',
  risk: 'alto',
  knownDivergences: [
    {
      location: 'pages/Atestados.jsx (CTA/lista) vs App.jsx (rota CadastrarAtestado)',
      affectedPageKeys: ['CadastrarAtestado'],
      ruleMenu: 'CTA/lista restringem adicionar_atestados / editar_atestados / excluir_atestado',
      ruleRoute: 'Rota CadastrarAtestado exige apenas { moduleKey: "atestados" }',
      impact:
        'Usuário sem adicionar/editar não vê os CTAs, mas pode acessar /CadastrarAtestado diretamente (form só valida o módulo + escopo).',
      status: 'confirmado',
    },
    {
      location: 'pages/AgendarJISO.jsx vs App.jsx (rota AgendarJISO)',
      affectedPageKeys: ['AgendarJISO'],
      ruleMenu: 'n/a (não está no menu principal)',
      ruleRoute: '{ moduleKey: "atestados" } (module-only)',
      impact:
        'Rota é module-only; o controle de registrar_decisao_jiso ocorre apenas em botões internos (UI), não na rota.',
      status: 'confirmado',
    },
    {
      location: 'permissionStructure.js (excluir_atestado vs excluir_atestados)',
      ruleMenu: 'n/a',
      ruleRoute: 'n/a',
      impact:
        'Existem ambas: perm_excluir_atestado (singular) e perm_excluir_atestados (plural). Runtime usa o singular; o plural é legacy/declared extra.',
      status: 'confirmado',
    },
    {
      location: 'pages/ExtratoAtestadosMedicos.jsx (guard de rota)',
      affectedPageKeys: ['ExtratoAtestadosMedicos'],
      ruleMenu: 'menu exige visualizar_atestados',
      ruleRoute: 'Sem entrada explícita em moduleGuardByPage do App.jsx',
      impact:
        'Separar dois pontos: (1) USO INTERNO da página — VALIDADO P1.1-C: canAccessModule("atestados") e ações gerar_relatorio_dp_dintel_atestados / gerir_encaminhamento_dp_dintel_atestado; (2) GUARD DA ROTA no App.jsx — pendente/sem entrada explícita em moduleGuardByPage. O uso interno estar validado não implica que a rota tenha guard de módulo declarado.',
      status: 'pendente_validacao',
    },
    {
      location: 'ver_dados_sensiveis_atestado (uso real)',
      ruleMenu: 'n/a',
      ruleRoute: 'n/a',
      impact:
        'VALIDADO P1.1-C: pertence ao contexto do módulo Atestados, mas NÃO foi encontrado enforcement claro em rota ou nos componentes auditados (ExtratoAtestadosMedicos.jsx). Não bloqueia rota. Permissão declarada/passiva (uso indireto/legado). Relevante para futura revisão de dados sensíveis.',
      status: 'nao_encontrado_em_enforcement',
      risco: 'baixo (estado atual); relevante para revisão futura de dados sensíveis',
    },
  ],
  recommendationFuture:
    'P1.2: declarar JISO/publicações como crossModule de acesso_publicacoes nos guards; alinhar CadastrarAtestado com adicionar_atestados; confirmar guard de ExtratoAtestadosMedicos.',
};

// ============================================================================
// REGISTRY
// ============================================================================
export const accessRegistry = {
  mode: ACCESS_REGISTRY_MODE, // 'mirror'
  generatedFor: 'P1.1',
  modules: {
    militares,
    ferias,
    atestados,
  },
};

export default accessRegistry;