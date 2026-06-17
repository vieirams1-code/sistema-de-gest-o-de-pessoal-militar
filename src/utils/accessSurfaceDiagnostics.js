/**
 * accessSurfaceDiagnostics.js — P1.2-B2
 * ============================================================================
 * Helper DOCUMENTAL / READ-ONLY de comparação de superfície de acesso.
 *
 * NATUREZA E LIMITES (LEIA ANTES DE EDITAR):
 *  - Compara APENAS registries estáticos:
 *      - accessSurfaceRegistry.js (menuSurfaceRegistry / routeSurfaceRegistry)
 *      - accessRegistry.js (mirror P1.1)
 *  - NÃO aplica permissões e NÃO decide acesso.
 *  - NÃO substitui App.jsx, Layout.jsx, moduleGuardByPage, menuGroups, guards
 *    ou useCurrentUser — estes permanecem como única fonte de enforcement.
 *  - NÃO deve ser usado para enforcement, bloqueio, navegação ou qualquer
 *    decisão de segurança em runtime.
 *  - É consumido APENAS pelo diagnóstico mirror (P1.2-B / DiagnosticoAcesso).
 *  - Funções puras: sem side effects, sem backend, sem base44.entities, sem
 *    storage, sem router, sem console, sem componentes visuais.
 *  - NÃO contém PII nem dados operacionais — apenas metadados estruturais.
 *
 * Esta etapa (P1.2-B2) NÃO cria interface visual e NÃO inicia a P1.2-B3.
 * ============================================================================
 */

import { menuSurfaceRegistry, routeSurfaceRegistry } from '@/config/accessSurfaceRegistry';
import { accessRegistry } from '@/config/accessRegistry';

const MODULES = accessRegistry?.modules || {};

// ----------------------------------------------------------------------------
// Status e severidade suportados
// ----------------------------------------------------------------------------

export const SURFACE_STATUS = {
  ALIGNED: 'aligned',
  CONTEXTUAL_EXPECTED: 'contextual_expected',
  MENU_ONLY: 'menu_only',
  ROUTE_ONLY: 'route_only',
  REGISTRY_ONLY: 'registry_only',
  MISSING_REGISTRY: 'missing_registry',
  MODULE_DIVERGENCE: 'module_divergence',
  ACTION_DIVERGENCE: 'action_divergence',
  ADMIN_DIVERGENCE: 'admin_divergence',
  KNOWN_DIVERGENCE: 'known_divergence',
  PENDING_MAPPING: 'pending_mapping',
};

export const SURFACE_SEVERITY = {
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

// Ordem de prioridade para resolver o status final de uma página
// (do mais grave/relevante para o mais informativo).
const STATUS_PRIORITY = [
  SURFACE_STATUS.ADMIN_DIVERGENCE,
  SURFACE_STATUS.MODULE_DIVERGENCE,
  SURFACE_STATUS.ACTION_DIVERGENCE,
  SURFACE_STATUS.ROUTE_ONLY,
  SURFACE_STATUS.MENU_ONLY,
  SURFACE_STATUS.REGISTRY_ONLY,
  SURFACE_STATUS.MISSING_REGISTRY,
  SURFACE_STATUS.PENDING_MAPPING,
  SURFACE_STATUS.KNOWN_DIVERGENCE,
  SURFACE_STATUS.CONTEXTUAL_EXPECTED,
  SURFACE_STATUS.ALIGNED,
];

const SEVERITY_PRIORITY = [
  SURFACE_SEVERITY.HIGH,
  SURFACE_SEVERITY.MEDIUM,
  SURFACE_SEVERITY.LOW,
  SURFACE_SEVERITY.INFO,
];

// ----------------------------------------------------------------------------
// Normalização
// ----------------------------------------------------------------------------

/**
 * Normaliza uma chave de superfície (pageKey/moduleKey/permission) removendo
 * espaços e prefixos legados conhecidos. Função pura.
 */
export function normalizeSurfaceKey(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('perm_')) return raw.slice('perm_'.length);
  if (raw.startsWith('acesso_')) return raw.slice('acesso_'.length);
  return raw;
}

// ----------------------------------------------------------------------------
// Leitura de definições do accessRegistry (mirror P1.1)
// ----------------------------------------------------------------------------

/**
 * Retorna a definição de módulo do accessRegistry a partir do moduleKey
 * (canônico ou legado). Função pura.
 */
export function getSurfaceModuleDefinition(moduleKey) {
  const normalized = normalizeSurfaceKey(moduleKey);
  if (!normalized) return null;
  for (const moduleDef of Object.values(MODULES)) {
    if (normalizeSurfaceKey(moduleDef.canonicalModuleKey) === normalized) return moduleDef;
    const legacy = (moduleDef.legacyModuleKeys || []).map(normalizeSurfaceKey);
    if (legacy.includes(normalized)) return moduleDef;
  }
  return null;
}

/** Localiza a routeRule do registry para um pageKey. Pura. */
function findRegistryRouteRule(moduleDef, pageKey) {
  const target = normalizeSurfaceKey(pageKey);
  return (moduleDef?.routeRules || []).find(
    (r) => normalizeSurfaceKey(r.pageKey) === target,
  ) || null;
}

/**
 * Localiza, em todos os módulos do accessRegistry, a routeRule de um pageKey.
 * Usado para detectar páginas que existem no registry mas não na superfície. Pura.
 */
function findRegistryRouteByPageKey(pageKey) {
  const target = normalizeSurfaceKey(pageKey);
  if (!target) return null;
  for (const moduleDef of Object.values(MODULES)) {
    const route = (moduleDef.routeRules || []).find(
      (r) => normalizeSurfaceKey(r.pageKey) === target,
    );
    if (route) return { module: moduleDef.canonicalModuleKey, route };
  }
  return null;
}

/** Coleta divergências conhecidas do registry que afetam um pageKey. Pura. */
function findRegistryKnownDivergences(moduleDef, pageKey) {
  const target = normalizeSurfaceKey(pageKey);
  return (moduleDef?.knownDivergences || []).filter((d) => {
    const affected = (d.affectedPageKeys || []).map(normalizeSurfaceKey);
    return affected.includes(target);
  });
}

// ----------------------------------------------------------------------------
// Comparação de uma página
// ----------------------------------------------------------------------------

/**
 * Compara a superfície (menu + rota) de uma página com o accessRegistry.
 * Retorna um objeto estrutural descritivo. Função pura (read-only).
 *
 * @param {string} pageKey
 * @returns {object|null}
 */
export function compareSurfacePage(pageKey) {
  const target = normalizeSurfaceKey(pageKey);
  if (!target) return null;

  const menuEntry = Object.values(menuSurfaceRegistry).find(
    (e) => normalizeSurfaceKey(e.pageKey) === target,
  ) || null;
  const routeEntry = Object.values(routeSurfaceRegistry).find(
    (e) => normalizeSurfaceKey(e.pageKey) === target,
  ) || null;

  // Resolução do módulo/registry — também cobre páginas que existem APENAS no
  // accessRegistry (sem entrada em menu/route surface) para produzir registry_only.
  const registryLookup = !menuEntry && !routeEntry ? findRegistryRouteByPageKey(target) : null;

  if (!menuEntry && !routeEntry && !registryLookup) return null;

  const resolvedPageKey = menuEntry?.pageKey || routeEntry?.pageKey || registryLookup?.route?.pageKey || pageKey;
  const moduleKey = menuEntry?.moduleKey || routeEntry?.moduleKey || registryLookup?.module || null;

  const moduleDef = getSurfaceModuleDefinition(moduleKey);
  const registryRoute = (moduleDef ? findRegistryRouteRule(moduleDef, resolvedPageKey) : null) || registryLookup?.route || null;
  const registryKnown = moduleDef ? findRegistryKnownDivergences(moduleDef, resolvedPageKey) : [];

  const menu = {
    exists: Boolean(menuEntry),
    label: menuEntry?.label || null,
    appearsInMenu: menuEntry ? Boolean(menuEntry.appearsInMenu) : false,
    menuType: menuEntry?.menuType || null,
    viewPermission: menuEntry?.viewPermission || null,
    actionKey: menuEntry?.actionKey || null,
    adminOnly: menuEntry ? Boolean(menuEntry.adminOnly) : false,
  };

  const route = {
    exists: Boolean(routeEntry),
    path: routeEntry?.path || null,
    routeType: routeEntry?.routeType || null,
    moduleKey: routeEntry?.moduleKey || null,
    actionKey: routeEntry?.actionKey || null,
    adminOnly: routeEntry ? Boolean(routeEntry.adminOnly) : false,
  };

  // Payload mínimo de registry — apenas metadados, sem objetos completos.
  const registry = {
    exists: Boolean(registryRoute),
    canonicalModuleKey: moduleDef?.canonicalModuleKey || null,
    routeRuleExists: Boolean(registryRoute),
    routeRuleSummary: registryRoute
      ? {
          pageKey: registryRoute.pageKey || null,
          moduleKey: registryRoute.appGuard?.moduleKey || null,
          actionKey: registryRoute.appGuard?.actionKey || null,
          adminOnly: Boolean(registryRoute.adminOnly),
          type: registryRoute.type || null,
        }
      : null,
    knownDivergencesCount: registryKnown.length,
    knownDivergencesSummary: registryKnown.map((d) => ({
      affectedPageKeys: (d.affectedPageKeys || []).slice(),
      status: d.status || null,
    })),
  };

  const findings = buildFindings({ menu, route, registry, menuEntry, routeEntry, registryKnown });
  const status = resolveStatus(findings);
  const severity = resolveSeverity(findings);

  return {
    pageKey: resolvedPageKey,
    moduleKey,
    menu,
    route,
    registry,
    status,
    severity,
    findings,
  };
}

// ----------------------------------------------------------------------------
// Regras de comparação -> findings
// ----------------------------------------------------------------------------

// Tipos de rota considerados contextuais (esperado não aparecer no menu).
const CONTEXTUAL_ROUTE_TYPES = new Set(['detail', 'cadastro', 'cadastro_auxiliar', 'edicao']);

// Quais códigos de finding podem ser atenuados por uma divergência conhecida.
const ATTENUABLE_BY_KNOWN = new Set([
  SURFACE_STATUS.MODULE_DIVERGENCE,
  SURFACE_STATUS.ACTION_DIVERGENCE,
  SURFACE_STATUS.ADMIN_DIVERGENCE,
  SURFACE_STATUS.MENU_ONLY,
  SURFACE_STATUS.ROUTE_ONLY,
  SURFACE_STATUS.PENDING_MAPPING,
]);

function buildFindings({ menu, route, registry, menuEntry, routeEntry, registryKnown = [] }) {
  const findings = [];
  const isContextual = menuEntry?.menuType === 'contextual' || CONTEXTUAL_ROUTE_TYPES.has(routeEntry?.routeType);
  const hasKnownDivergence = (registryKnown || []).length > 0;

  // 1. Presença em menu x rota
  if (menu.exists && !route.exists) {
    findings.push({
      code: SURFACE_STATUS.MENU_ONLY,
      severity: SURFACE_SEVERITY.MEDIUM,
      message: 'Página aparece no menu mas não possui rota declarada na superfície.',
    });
  }
  if (route.exists && !menu.exists) {
    findings.push({
      code: SURFACE_STATUS.ROUTE_ONLY,
      severity: SURFACE_SEVERITY.LOW,
      message: 'Rota declarada na superfície sem entrada correspondente no menu.',
    });
  }

  // 2. Aparência no menu x tipo contextual (esperado não aparecer)
  if (route.exists && !menu.appearsInMenu && isContextual) {
    findings.push({
      code: SURFACE_STATUS.CONTEXTUAL_EXPECTED,
      severity: SURFACE_SEVERITY.INFO,
      message: 'Página contextual (detalhe/cadastro/edição) que não aparece no menu — comportamento esperado.',
    });
  }

  // 3. adminOnly inconsistente entre menu e rota.
  //    Alinhado: rota adminOnly e menu adminOnly.
  //    Divergência: rota adminOnly e menu sem adminOnly/viewPermission/actionKey;
  //    ou menu adminOnly e rota não adminOnly.
  if (menu.exists && route.exists) {
    const menuIndicatesRestriction = Boolean(menu.adminOnly || menu.viewPermission || menu.actionKey);
    if (route.adminOnly && menu.appearsInMenu && !menuIndicatesRestriction) {
      findings.push({
        code: SURFACE_STATUS.ADMIN_DIVERGENCE,
        severity: SURFACE_SEVERITY.HIGH,
        message: 'Rota marcada como adminOnly, mas a entrada de menu não indica restrição (sem adminOnly/viewPermission/actionKey).',
      });
    } else if (menu.adminOnly && !route.adminOnly) {
      findings.push({
        code: SURFACE_STATUS.ADMIN_DIVERGENCE,
        severity: SURFACE_SEVERITY.HIGH,
        message: 'Menu marcado como adminOnly, mas a rota não está marcada como adminOnly.',
      });
    }
  }

  // 4. Divergência de módulo entre menu e rota
  if (menu.exists && route.exists) {
    const menuModule = normalizeSurfaceKey(menuEntry?.moduleKey);
    const routeModule = normalizeSurfaceKey(route.moduleKey);
    if (menuModule && routeModule && menuModule !== routeModule) {
      findings.push({
        code: SURFACE_STATUS.MODULE_DIVERGENCE,
        severity: SURFACE_SEVERITY.HIGH,
        message: `Módulo do menu (${menuModule}) difere do módulo da rota (${routeModule}).`,
      });
    }
  }

  // 5. Divergência de action: menu exige viewPermission/actionKey e rota é module-only
  if (menu.exists && route.exists) {
    const menuRequiresAction = Boolean(menu.viewPermission || menu.actionKey);
    const routeIsModuleOnly = Boolean(route.moduleKey) && !route.actionKey;
    if (menuRequiresAction && routeIsModuleOnly) {
      findings.push({
        code: SURFACE_STATUS.ACTION_DIVERGENCE,
        severity: SURFACE_SEVERITY.MEDIUM,
        message: 'Menu exige viewPermission/actionKey, mas a rota é module-only (mais permissiva).',
      });
    }

    // 5b. Inverso: rota exige actionKey, mas o menu não declara restrição equivalente.
    const menuDeclaresRestriction = Boolean(menu.viewPermission || menu.actionKey);
    if (route.actionKey && !menuDeclaresRestriction) {
      findings.push({
        code: SURFACE_STATUS.ACTION_DIVERGENCE,
        severity: SURFACE_SEVERITY.MEDIUM,
        message: 'Rota exige actionKey, mas o menu não declara viewPermission/actionKey equivalente.',
      });
    }
  }

  // 6. Registry-only: existe no accessRegistry, mas não na superfície (menu/rota).
  if (!menu.exists && !route.exists && registry.exists) {
    findings.push({
      code: SURFACE_STATUS.REGISTRY_ONLY,
      severity: SURFACE_SEVERITY.MEDIUM,
      message: 'Página documentada no accessRegistry sem superfície de menu/rota correspondente.',
    });
  } else if (!registry.canonicalModuleKey) {
    findings.push({
      code: SURFACE_STATUS.MISSING_REGISTRY,
      severity: SURFACE_SEVERITY.MEDIUM,
      message: 'Módulo da página não consta no accessRegistry (mirror).',
    });
  } else if (!registry.exists) {
    findings.push({
      code: SURFACE_STATUS.PENDING_MAPPING,
      severity: SURFACE_SEVERITY.LOW,
      message: 'Página presente na superfície mas sem routeRule correspondente no accessRegistry.',
    });
  }

  // 7. Divergências conhecidas atenuam findings correspondentes (sem zerar o alerta).
  //    Se a página tem knownDivergence por affectedPageKeys e o finding detectado é
  //    de um tipo atenuável, reduzimos sua severity para low e o marcamos como
  //    conhecido — evitando que vire erro bruto na futura UI.
  if (hasKnownDivergence) {
    findings.forEach((f) => {
      if (ATTENUABLE_BY_KNOWN.has(f.code)) {
        f.severity = SURFACE_SEVERITY.LOW;
        f.knownDivergence = true;
        f.message = `${f.message} (divergência conhecida/documentada no accessRegistry).`;
      }
    });
    const hasConfirmed = (registryKnown || []).some((d) => d.status === 'confirmado');
    findings.push({
      code: SURFACE_STATUS.KNOWN_DIVERGENCE,
      severity: hasConfirmed ? SURFACE_SEVERITY.LOW : SURFACE_SEVERITY.INFO,
      message: 'Divergência já mapeada no accessRegistry (knownDivergences) — não é alerta bruto.',
    });
  }

  // 8. Alinhado quando nada relevante foi encontrado
  if (findings.length === 0) {
    findings.push({
      code: SURFACE_STATUS.ALIGNED,
      severity: SURFACE_SEVERITY.INFO,
      message: 'Menu, rota e registry consistentes para esta página.',
    });
  }

  return findings;
}

function resolveStatus(findings) {
  for (const candidate of STATUS_PRIORITY) {
    if (findings.some((f) => f.code === candidate)) return candidate;
  }
  return SURFACE_STATUS.ALIGNED;
}

function resolveSeverity(findings) {
  for (const candidate of SEVERITY_PRIORITY) {
    if (findings.some((f) => f.severity === candidate)) return candidate;
  }
  return SURFACE_SEVERITY.INFO;
}

// ----------------------------------------------------------------------------
// Comparação por módulo e geral
// ----------------------------------------------------------------------------

/** Coleta os pageKeys únicos (menu + rota + registry) de um moduleKey. Pura. */
function collectPageKeysByModule(moduleKey) {
  const normalized = normalizeSurfaceKey(moduleKey);
  const keys = new Set();
  Object.values(menuSurfaceRegistry).forEach((e) => {
    if (normalizeSurfaceKey(e.moduleKey) === normalized) keys.add(e.pageKey);
  });
  Object.values(routeSurfaceRegistry).forEach((e) => {
    if (normalizeSurfaceKey(e.moduleKey) === normalized) keys.add(e.pageKey);
  });
  // Inclui pageKeys do accessRegistry (routeRules) — habilita registry_only.
  const moduleDef = getSurfaceModuleDefinition(moduleKey);
  (moduleDef?.routeRules || []).forEach((r) => {
    if (r.pageKey) keys.add(r.pageKey);
  });
  return Array.from(keys);
}

/**
 * Compara todas as páginas de um módulo. Retorna lista de comparações.
 * Função pura (read-only).
 *
 * @param {string} moduleKey
 * @returns {Array<object>}
 */
export function compareAccessSurfaceByModule(moduleKey) {
  return collectPageKeysByModule(moduleKey)
    .map((pageKey) => compareSurfacePage(pageKey))
    .filter(Boolean);
}

/**
 * Compara todas as superfícies de todos os módulos presentes nos registries.
 * Retorna objeto agrupado por moduleKey + resumo. Função pura (read-only).
 *
 * @returns {{ modules: Record<string, object[]>, summary: object }}
 */
export function compareAllAccessSurfaces() {
  const moduleKeys = new Set();
  Object.values(menuSurfaceRegistry).forEach((e) => e.moduleKey && moduleKeys.add(normalizeSurfaceKey(e.moduleKey)));
  Object.values(routeSurfaceRegistry).forEach((e) => e.moduleKey && moduleKeys.add(normalizeSurfaceKey(e.moduleKey)));
  // Inclui módulos do accessRegistry — habilita registry_only em módulos sem superfície.
  Object.values(MODULES).forEach((m) => m.canonicalModuleKey && moduleKeys.add(normalizeSurfaceKey(m.canonicalModuleKey)));

  const modules = {};
  const summary = { totalPages: 0, byStatus: {}, bySeverity: {} };

  Array.from(moduleKeys).forEach((moduleKey) => {
    const comparisons = compareAccessSurfaceByModule(moduleKey);
    modules[moduleKey] = comparisons;
    comparisons.forEach((c) => {
      summary.totalPages += 1;
      summary.byStatus[c.status] = (summary.byStatus[c.status] || 0) + 1;
      summary.bySeverity[c.severity] = (summary.bySeverity[c.severity] || 0) + 1;
    });
  });

  return { modules, summary };
}

export default {
  SURFACE_STATUS,
  SURFACE_SEVERITY,
  normalizeSurfaceKey,
  getSurfaceModuleDefinition,
  compareSurfacePage,
  compareAccessSurfaceByModule,
  compareAllAccessSurfaces,
};