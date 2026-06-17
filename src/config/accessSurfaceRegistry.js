/**
 * accessSurfaceRegistry.js — P1.2-B1
 * ----------------------------------------------------------------------------
 * ESPELHO DOCUMENTAL / READ-ONLY da superfície de menu e rotas.
 *
 * NATUREZA E LIMITES (LEIA ANTES DE EDITAR):
 *  - Este arquivo é puramente DOCUMENTAL. Ele NÃO aplica permissões.
 *  - NÃO faz leitura runtime real de App.jsx ou Layout.jsx — é um espelho
 *    manual/controlado da superfície observada nesses arquivos.
 *  - NÃO substitui App.jsx, Layout.jsx, moduleGuardByPage, menuGroups,
 *    guards ou useCurrentUser. Estes permanecem como única fonte de verdade
 *    de enforcement.
 *  - NÃO deve ser usado para enforcement, bloqueio de acesso, navegação ou
 *    qualquer decisão de segurança em runtime.
 *  - É consumido APENAS pelo diagnóstico mirror (P1.2-B / DiagnosticoAcesso).
 *  - PRECISA SER ATUALIZADO MANUALMENTE sempre que o menu (Layout.jsx) ou as
 *    rotas (App.jsx / moduleGuardByPage / adminOnlyPages) forem alterados.
 *    Caso contrário, este espelho ficará defasado em relação ao runtime real.
 *
 * Escopo inicial (P1.2-B1): módulos Militares, Férias e Atestados.
 * Não contém PII, dados operacionais ou qualquer dado sensível — apenas
 * metadados estruturais de superfície (chaves de página, módulo e permissão).
 * ----------------------------------------------------------------------------
 */

// =====================================================================
// SUPERFÍCIE DE MENU (espelho de Layout.jsx -> menuGroups)
// ---------------------------------------------------------------------
// appearsInMenu: a página possui entrada visível no menu/sidebar.
// menuType: 'main' (item de menu navegável) | 'contextual' (acessada por
//   navegação interna, não listada no menu) | 'hidden' (sem entrada de menu).
// =====================================================================
export const menuSurfaceRegistry = {
  // ---------------------- MÓDULO: MILITARES ----------------------
  Militares: {
    pageKey: 'Militares',
    label: 'Consulta Militar',
    moduleKey: 'militares',
    menuGroup: 'Efetivo',
    appearsInMenu: true,
    menuType: 'main',
    viewPermission: null,
    actionKey: 'visualizar_militares',
    source: 'Layout.jsx mirror',
    notes: 'Entrada principal do módulo Efetivo. Menu usa moduleKey + actionKey.',
  },
  CadastrarMilitar: {
    pageKey: 'CadastrarMilitar',
    label: 'Cadastrar Militar',
    moduleKey: 'militares',
    menuGroup: 'Efetivo',
    appearsInMenu: false,
    menuType: 'contextual',
    viewPermission: null,
    actionKey: null,
    source: 'Layout.jsx mirror',
    notes: 'Página de cadastro/edição acessada por CTA interno, sem item de menu.',
  },
  VerMilitar: {
    pageKey: 'VerMilitar',
    label: 'Ver Militar',
    moduleKey: 'militares',
    menuGroup: 'Efetivo',
    appearsInMenu: false,
    menuType: 'contextual',
    viewPermission: null,
    actionKey: 'visualizar_militares',
    source: 'Layout.jsx mirror',
    notes: 'Detalhe do militar (rota inicial/home). Acessada por navegação interna.',
  },

  // ---------------------- MÓDULO: FÉRIAS ----------------------
  Ferias: {
    pageKey: 'Ferias',
    label: 'Férias',
    moduleKey: 'ferias',
    menuGroup: 'Férias',
    appearsInMenu: true,
    menuType: 'main',
    viewPermission: 'visualizar_ferias',
    actionKey: null,
    source: 'Layout.jsx mirror',
    notes: 'Entrada principal do módulo Férias. Menu usa viewPermission.',
  },
  CadastrarFerias: {
    pageKey: 'CadastrarFerias',
    label: 'Cadastrar Férias',
    moduleKey: 'ferias',
    menuGroup: 'Férias',
    appearsInMenu: false,
    menuType: 'contextual',
    viewPermission: null,
    actionKey: null,
    source: 'Layout.jsx mirror',
    notes: 'Página de cadastro/edição de férias acessada por CTA interno.',
  },
  PlanoAnualFerias: {
    pageKey: 'PlanoAnualFerias',
    label: 'Plano Anual de Férias',
    moduleKey: 'ferias',
    menuGroup: 'Férias',
    appearsInMenu: false,
    menuType: 'contextual',
    viewPermission: null,
    actionKey: 'visualizar_ferias',
    source: 'Layout.jsx mirror',
    notes: 'Não listada como item próprio no menu atual; acessada por navegação.',
  },
  PeriodosAquisitivos: {
    pageKey: 'PeriodosAquisitivos',
    label: 'Períodos Aquisitivos',
    moduleKey: 'ferias',
    menuGroup: 'Férias',
    appearsInMenu: false,
    menuType: 'contextual',
    viewPermission: null,
    actionKey: null,
    source: 'Layout.jsx mirror',
    notes: 'Acessada por navegação interna; sem item de menu próprio.',
  },
  CreditosExtraordinariosFerias: {
    pageKey: 'CreditosExtraordinariosFerias',
    label: 'Dias Adicionais',
    moduleKey: 'ferias',
    menuGroup: 'Férias',
    appearsInMenu: true,
    menuType: 'main',
    viewPermission: 'visualizar_ferias',
    actionKey: null,
    source: 'Layout.jsx mirror',
    notes: 'Item de menu "Dias Adicionais" dentro do grupo Férias.',
  },

  // ---------------------- MÓDULO: ATESTADOS ----------------------
  Atestados: {
    pageKey: 'Atestados',
    label: 'Atestados',
    moduleKey: 'atestados',
    menuGroup: 'Saúde',
    appearsInMenu: true,
    menuType: 'main',
    viewPermission: 'visualizar_atestados',
    actionKey: null,
    source: 'Layout.jsx mirror',
    notes: 'Entrada principal do módulo Atestados (grupo Saúde).',
  },
  CadastrarAtestado: {
    pageKey: 'CadastrarAtestado',
    label: 'Cadastrar Atestado',
    moduleKey: 'atestados',
    menuGroup: 'Saúde',
    appearsInMenu: false,
    menuType: 'contextual',
    viewPermission: null,
    actionKey: null,
    source: 'Layout.jsx mirror',
    notes: 'Página de cadastro acessada por CTA interno, sem item de menu.',
  },
  VerAtestado: {
    pageKey: 'VerAtestado',
    label: 'Ver Atestado',
    moduleKey: 'atestados',
    menuGroup: 'Saúde',
    appearsInMenu: false,
    menuType: 'contextual',
    viewPermission: null,
    actionKey: null,
    source: 'Layout.jsx mirror',
    notes: 'Detalhe do atestado acessado por navegação interna.',
  },
  AgendarJISO: {
    pageKey: 'AgendarJISO',
    label: 'Agendar JISO',
    moduleKey: 'atestados',
    menuGroup: 'Saúde',
    appearsInMenu: false,
    menuType: 'contextual',
    viewPermission: null,
    actionKey: null,
    source: 'Layout.jsx mirror',
    notes: 'Fluxo JISO vinculado a atestados; sem item de menu próprio.',
  },
  EditarJISO: {
    pageKey: 'EditarJISO',
    label: 'Editar JISO',
    moduleKey: 'atestados',
    menuGroup: 'Saúde',
    appearsInMenu: false,
    menuType: 'contextual',
    viewPermission: null,
    actionKey: null,
    source: 'Layout.jsx mirror',
    notes: 'Edição de JISO; possui aliases legados (AgendaJISO/EditarJiso) em App.jsx.',
  },
  ExtratoAtestadosMedicos: {
    pageKey: 'ExtratoAtestadosMedicos',
    label: 'Extrato de Atestados',
    moduleKey: 'atestados',
    menuGroup: 'Saúde',
    appearsInMenu: true,
    menuType: 'main',
    viewPermission: 'visualizar_atestados',
    actionKey: null,
    source: 'Layout.jsx mirror',
    notes: 'Item de menu com path explícito /ExtratoAtestadosMedicos.',
  },
  Medicos: {
    pageKey: 'Medicos',
    label: 'Cadastro de Médicos',
    moduleKey: 'atestados',
    menuGroup: 'Saúde',
    appearsInMenu: true,
    menuType: 'main',
    viewPermission: null,
    actionKey: null,
    source: 'Layout.jsx mirror',
    notes: 'Item de menu marcado como adminOnly no Layout (visível apenas a admin).',
  },
};

// =====================================================================
// SUPERFÍCIE DE ROTA (espelho de App.jsx -> moduleGuardByPage / adminOnlyPages)
// ---------------------------------------------------------------------
// routeType: 'index'|'list'|'detail'|'cadastro'|'edicao'|'extrato'|'cadastro_auxiliar'.
// adminOnly: a rota está em adminOnlyPages OU o guard documenta admin puro.
// appearsInMenu: espelha a superfície de menu (para conveniência do comparador).
// =====================================================================
export const routeSurfaceRegistry = {
  // ---------------------- MÓDULO: MILITARES ----------------------
  Militares: {
    pageKey: 'Militares',
    path: '/Militares',
    routeType: 'list',
    moduleKey: 'militares',
    actionKey: null,
    adminOnly: false,
    appearsInMenu: true,
    source: 'App.jsx mirror',
    notes: 'Guard moduleKey "militares" (moduleName "Efetivo").',
  },
  CadastrarMilitar: {
    pageKey: 'CadastrarMilitar',
    path: '/CadastrarMilitar',
    routeType: 'cadastro',
    moduleKey: 'militares',
    actionKey: null,
    adminOnly: false,
    appearsInMenu: false,
    source: 'App.jsx mirror',
    notes: 'Guard moduleKey "militares". Contextual: herda acesso do módulo.',
  },
  VerMilitar: {
    pageKey: 'VerMilitar',
    path: '/VerMilitar',
    routeType: 'detail',
    moduleKey: 'militares',
    actionKey: 'visualizar_militares',
    adminOnly: false,
    appearsInMenu: false,
    source: 'App.jsx mirror',
    notes: 'Guard moduleKey "militares" + actionKey "visualizar_militares". Rota home (redirect de "/").',
  },

  // ---------------------- MÓDULO: FÉRIAS ----------------------
  Ferias: {
    pageKey: 'Ferias',
    path: '/Ferias',
    routeType: 'list',
    moduleKey: 'ferias',
    actionKey: null,
    adminOnly: false,
    appearsInMenu: true,
    source: 'App.jsx mirror',
    notes: 'Guard moduleKey "ferias".',
  },
  CadastrarFerias: {
    pageKey: 'CadastrarFerias',
    path: '/CadastrarFerias',
    routeType: 'cadastro',
    moduleKey: 'ferias',
    actionKey: null,
    adminOnly: false,
    appearsInMenu: false,
    source: 'App.jsx mirror',
    notes: 'Guard moduleKey "ferias". Contextual: herda acesso do módulo.',
  },
  PlanoAnualFerias: {
    pageKey: 'PlanoAnualFerias',
    path: '/PlanoAnualFerias',
    routeType: 'list',
    moduleKey: 'ferias',
    actionKey: 'visualizar_ferias',
    adminOnly: false,
    appearsInMenu: false,
    source: 'App.jsx mirror',
    notes: 'Guard moduleKey "ferias" + actionKey "visualizar_ferias".',
  },
  PeriodosAquisitivos: {
    pageKey: 'PeriodosAquisitivos',
    path: '/PeriodosAquisitivos',
    routeType: 'list',
    moduleKey: 'ferias',
    actionKey: null,
    adminOnly: false,
    appearsInMenu: false,
    source: 'App.jsx mirror',
    notes: 'Guard moduleKey "ferias".',
  },
  CreditosExtraordinariosFerias: {
    pageKey: 'CreditosExtraordinariosFerias',
    path: '/CreditosExtraordinariosFerias',
    routeType: 'list',
    moduleKey: 'ferias',
    actionKey: null,
    adminOnly: false,
    appearsInMenu: true,
    source: 'App.jsx mirror',
    notes: 'Guard moduleKey "ferias". Menu usa viewPermission "visualizar_ferias".',
  },

  // ---------------------- MÓDULO: ATESTADOS ----------------------
  Atestados: {
    pageKey: 'Atestados',
    path: '/Atestados',
    routeType: 'list',
    moduleKey: 'atestados',
    actionKey: null,
    adminOnly: false,
    appearsInMenu: true,
    source: 'App.jsx mirror',
    notes: 'Guard moduleKey "atestados".',
  },
  CadastrarAtestado: {
    pageKey: 'CadastrarAtestado',
    path: '/CadastrarAtestado',
    routeType: 'cadastro',
    moduleKey: 'atestados',
    actionKey: null,
    adminOnly: false,
    appearsInMenu: false,
    source: 'App.jsx mirror',
    notes: 'Guard moduleKey "atestados". Contextual: herda acesso do módulo.',
  },
  VerAtestado: {
    pageKey: 'VerAtestado',
    path: '/VerAtestado',
    routeType: 'detail',
    moduleKey: 'atestados',
    actionKey: null,
    adminOnly: false,
    appearsInMenu: false,
    source: 'App.jsx mirror',
    notes: 'Guard moduleKey "atestados".',
  },
  AgendarJISO: {
    pageKey: 'AgendarJISO',
    path: '/AgendarJISO',
    routeType: 'cadastro_auxiliar',
    moduleKey: 'atestados',
    actionKey: null,
    adminOnly: false,
    appearsInMenu: false,
    source: 'App.jsx mirror',
    notes: 'Guard moduleKey "atestados". Possui alias legado AgendaJISO em App.jsx.',
  },
  EditarJISO: {
    pageKey: 'EditarJISO',
    path: '/EditarJISO',
    routeType: 'edicao',
    moduleKey: 'atestados',
    actionKey: null,
    adminOnly: false,
    appearsInMenu: false,
    source: 'App.jsx mirror',
    notes: 'Guard moduleKey "atestados". Possui alias legado EditarJiso em App.jsx.',
  },
  ExtratoAtestadosMedicos: {
    pageKey: 'ExtratoAtestadosMedicos',
    path: '/ExtratoAtestadosMedicos',
    routeType: 'extrato',
    moduleKey: 'atestados',
    actionKey: null,
    adminOnly: false,
    appearsInMenu: true,
    source: 'App.jsx mirror',
    notes: 'Menu usa viewPermission "visualizar_atestados"; verificar guard de rota correspondente.',
  },
  Medicos: {
    pageKey: 'Medicos',
    path: '/Medicos',
    routeType: 'cadastro_auxiliar',
    moduleKey: 'atestados',
    actionKey: null,
    adminOnly: true,
    appearsInMenu: true,
    source: 'App.jsx mirror',
    notes: 'Listada em adminOnlyPages (RequireAdmin) + guard moduleKey "atestados".',
  },
};

// =====================================================================
// AUXILIARES PUROS (sem side effects)
// =====================================================================

// Módulos cobertos por este espelho documental na fase atual (P1.2-B1).
export const ACCESS_SURFACE_MODULES = ['militares', 'ferias', 'atestados'];

/**
 * Retorna as entradas de superfície de MENU pertencentes a um moduleKey.
 * Função pura: não muta estado, não acessa rede/armazenamento.
 * @param {string} moduleKey
 * @returns {Array<object>} lista de entradas de menuSurfaceRegistry
 */
export function getMenuSurfaceByModule(moduleKey) {
  if (!moduleKey) return [];
  return Object.values(menuSurfaceRegistry).filter((entry) => entry.moduleKey === moduleKey);
}

/**
 * Retorna as entradas de superfície de ROTA pertencentes a um moduleKey.
 * Função pura: não muta estado, não acessa rede/armazenamento.
 * @param {string} moduleKey
 * @returns {Array<object>} lista de entradas de routeSurfaceRegistry
 */
export function getRouteSurfaceByModule(moduleKey) {
  if (!moduleKey) return [];
  return Object.values(routeSurfaceRegistry).filter((entry) => entry.moduleKey === moduleKey);
}

export default {
  menuSurfaceRegistry,
  routeSurfaceRegistry,
  ACCESS_SURFACE_MODULES,
  getMenuSurfaceByModule,
  getRouteSurfaceByModule,
};