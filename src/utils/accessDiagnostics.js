/**
 * accessDiagnostics.js — P1.1 (MIRROR / READ-ONLY)
 * ============================================================================
 * Utilitários PUROS, SEM side effects, para diagnóstico e comparação.
 *
 *  - Trabalham APENAS sobre accessRegistry.js.
 *  - NÃO importam Layout.jsx nem App.jsx.
 *  - NÃO aplicam enforcement, NÃO bloqueiam nada, NÃO alteram comportamento.
 *
 * Servem para auditoria técnica, exploração do mapeamento e preparação da P1.2.
 * ============================================================================
 */

import { accessRegistry } from '@/config/accessRegistry';

const MODULES = accessRegistry?.modules || {};

// ----------------------------------------------------------------------------
// Normalização de chaves
// ----------------------------------------------------------------------------

/**
 * Remove prefixos legados ('perm_' / 'acesso_') e normaliza a chave.
 * Não muda comportamento — apenas devolve a forma canônica textual.
 */
export function normalizePermissionKey(permissionKey) {
  const raw = String(permissionKey || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('perm_')) return raw.slice('perm_'.length);
  if (raw.startsWith('acesso_')) return raw.slice('acesso_'.length);
  return raw;
}

/**
 * Resolve a chave de AÇÃO canônica a partir de qualquer forma conhecida
 * (canonical, perm_, plural legacy). Read-only.
 */
export function resolveCanonicalActionKey(actionKey) {
  const normalized = normalizePermissionKey(actionKey);
  if (!normalized) return '';

  for (const moduleDef of Object.values(MODULES)) {
    const canonical = moduleDef?.permissions?.canonical || {};
    const legacyPerm = moduleDef?.permissions?.legacyPerm || {};

    // Match direto contra canonical
    for (const value of Object.values(canonical)) {
      if (normalizePermissionKey(value) === normalized) return value;
    }
    // Match via legacyPerm -> devolve o canonical equivalente (mesma role key)
    for (const [roleKey, value] of Object.entries(legacyPerm)) {
      if (normalizePermissionKey(value) === normalized && canonical[roleKey]) {
        return canonical[roleKey];
      }
    }
  }
  return normalized;
}

/**
 * Resolve a chave de MÓDULO canônica a partir de canonical / legacy / alias.
 * Read-only.
 */
export function resolveCanonicalModuleKey(moduleKey) {
  const normalized = normalizePermissionKey(moduleKey);
  if (!normalized) return '';

  for (const [key, moduleDef] of Object.entries(MODULES)) {
    if (moduleDef.canonicalModuleKey === normalized) return moduleDef.canonicalModuleKey;
    if (key === normalized) return moduleDef.canonicalModuleKey;

    const legacy = (moduleDef.legacyModuleKeys || []).map(normalizePermissionKey);
    if (legacy.includes(normalized)) return moduleDef.canonicalModuleKey;

    const aliases = (moduleDef.aliases || []).map((a) => normalizePermissionKey(a?.key));
    if (aliases.includes(normalized)) return moduleDef.canonicalModuleKey;
  }
  return normalized;
}

// ----------------------------------------------------------------------------
// Leitura de definições
// ----------------------------------------------------------------------------

/**
 * Retorna a definição de módulo a partir de chave canônica, legacy ou alias.
 */
export function getAccessDefinition(moduleKeyOrAlias) {
  const canonical = resolveCanonicalModuleKey(moduleKeyOrAlias);
  for (const moduleDef of Object.values(MODULES)) {
    if (moduleDef.canonicalModuleKey === canonical) return moduleDef;
  }
  return null;
}

/**
 * Retorna a regra de ROTA (App.jsx mirror) para um pageKey.
 */
export function getRouteAccessDefinition(pageKey) {
  const target = String(pageKey || '').trim().toLowerCase();
  if (!target) return null;

  for (const moduleDef of Object.values(MODULES)) {
    const route = (moduleDef.routeRules || []).find(
      (r) => String(r.pageKey || '').toLowerCase() === target,
    );
    if (route) {
      return { module: moduleDef.canonicalModuleKey, route };
    }
  }
  return null;
}

/**
 * Retorna a regra de MENU (layout mirror) para um pageKey ou label.
 */
export function getMenuAccessDefinition(pageKeyOrLabel) {
  const target = String(pageKeyOrLabel || '').trim().toLowerCase();
  if (!target) return null;

  for (const moduleDef of Object.values(MODULES)) {
    const entry = (moduleDef.menuRules || []).find(
      (m) =>
        String(m.pageKey || '').toLowerCase() === target ||
        String(m.label || '').toLowerCase() === target,
    );
    if (entry) {
      return { module: moduleDef.canonicalModuleKey, menu: entry };
    }
  }
  return null;
}

// ----------------------------------------------------------------------------
// Divergências
// ----------------------------------------------------------------------------

/**
 * Lista todas as divergências registradas (campo knownDivergences) de todos
 * os módulos. Read-only.
 */
export function listKnownDivergences() {
  const out = [];
  for (const moduleDef of Object.values(MODULES)) {
    (moduleDef.knownDivergences || []).forEach((d) => {
      out.push({ module: moduleDef.canonicalModuleKey, ...d });
    });
  }
  return out;
}

/**
 * Compara, por módulo, a regra do MENU com a regra da ROTA correspondente e
 * sinaliza quando o menu exige uma permissão de ação que a rota não exige
 * (rota module-only). Read-only — não decide acesso.
 */
export function detectMenuRouteDivergence() {
  const findings = [];

  for (const moduleDef of Object.values(MODULES)) {
    const menuByPage = new Map(
      (moduleDef.menuRules || []).map((m) => [String(m.pageKey || '').toLowerCase(), m]),
    );

    (moduleDef.routeRules || []).forEach((route) => {
      const menu = menuByPage.get(String(route.pageKey || '').toLowerCase());
      if (!menu) return;

      const menuAction = menu.rule?.actionKey || menu.rule?.viewPermission || null;
      const routeAction = route.appGuard?.actionKey || null;
      const routeHasModuleOnly = Boolean(route.appGuard?.moduleKey) && !routeAction;

      if (menuAction && routeHasModuleOnly) {
        findings.push({
          module: moduleDef.canonicalModuleKey,
          pageKey: route.pageKey,
          menuRequires: menuAction,
          routeRequires: route.appGuard?.moduleKey || null,
          note: 'Menu exige action/viewPermission, mas a rota é module-only.',
          status: 'derivado-mirror',
        });
      }
    });
  }

  return findings;
}

// ----------------------------------------------------------------------------
// Explicação read-only
// ----------------------------------------------------------------------------

/**
 * Explica, em modo mirror, o que o usuário PODERIA acessar segundo o registry,
 * dada uma estrutura de permissões (modules/actions ou objeto plano).
 *
 * NÃO bloqueia, NÃO aplica enforcement. Apenas DESCREVE o que o registry diz.
 *
 * @param {string} moduleKey
 * @param {Object} userPermissions  Pode ser { modules, actions } ou objeto plano,
 *                                  ou a sentinela 'ALL' (admin).
 */
export function explainMirrorAccess(moduleKey, userPermissions = {}) {
  const def = getAccessDefinition(moduleKey);
  if (!def) {
    return { module: moduleKey, found: false, reason: 'Módulo não consta no accessRegistry (mirror).' };
  }

  const isAll = userPermissions === 'ALL';
  const flat = isAll ? {} : flattenPermissions(userPermissions);

  const hasKey = (key) => {
    if (isAll) return true;
    if (!key) return false;
    const norm = normalizePermissionKey(key);
    return Boolean(
      flat[key] === true ||
        flat[norm] === true ||
        flat[`perm_${norm}`] === true ||
        flat[`acesso_${norm}`] === true,
    );
  };

  const viewCanonical = def.permissions?.canonical?.view;
  const moduleCanonical = def.canonicalModuleKey;

  return {
    module: moduleCanonical,
    found: true,
    mirrorStatus: def.mirrorStatus,
    wouldSeeModule: isAll || hasKey(moduleCanonical) || hasKey(viewCanonical),
    canonicalView: viewCanonical || null,
    actionsEvaluated: Object.entries(def.permissions?.canonical || {}).reduce((acc, [role, key]) => {
      acc[role] = { permission: key, granted: hasKey(key) };
      return acc;
    }, {}),
    crossModuleActions: (def.crossModuleActions || []).map((c) => ({
      action: c.action,
      externalActionSource: c.externalActionSource,
      granted: hasKey(c.action),
    })),
    note: 'Resultado puramente descritivo (mirror). Não representa o enforcement real do sistema.',
  };
}

// ----------------------------------------------------------------------------
// Helpers internos
// ----------------------------------------------------------------------------

function flattenPermissions(userPermissions) {
  if (!userPermissions || typeof userPermissions !== 'object') return {};

  // Formato { modules, actions } do getUserPermissions/useCurrentUser
  if (userPermissions.modules || userPermissions.actions) {
    const flat = {};
    Object.entries(userPermissions.modules || {}).forEach(([k, v]) => {
      if (v === true) {
        flat[k] = true;
        flat[`acesso_${k}`] = true;
      }
    });
    Object.entries(userPermissions.actions || {}).forEach(([k, v]) => {
      if (v === true) {
        flat[k] = true;
        flat[`perm_${k}`] = true;
      }
    });
    return flat;
  }

  // Objeto plano (ex: permissionsObject do useCurrentUser)
  return { ...userPermissions };
}

export default {
  getAccessDefinition,
  getRouteAccessDefinition,
  getMenuAccessDefinition,
  listKnownDivergences,
  detectMenuRouteDivergence,
  explainMirrorAccess,
  normalizePermissionKey,
  resolveCanonicalActionKey,
  resolveCanonicalModuleKey,
};