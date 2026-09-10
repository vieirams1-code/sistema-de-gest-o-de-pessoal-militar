import { permissionStructure } from '../config/permissionStructure.js';
import {
  PROFILE_MATRIX_START_MARKER,
  PROFILE_MATRIX_END_MARKER,
  extractProfileMatrixFromDescription,
  mergeProfileDescriptionWithMatrix,
} from './permissionMatrixService.js';

export const CURRENT_PROFILE_MATRIX_VERSION = '2026.09.08-v3';
export const PROFILE_VERSION_START_MARKER = '[SGP_PERMISSIONS_VERSION]';
export const PROFILE_VERSION_END_MARKER = '[/SGP_PERMISSIONS_VERSION]';

const canonicalModules = permissionStructure.flatMap((group) => group.modules.map((module) => ({
  key: module.key,
  actions: module.actions.map((action) => action.key),
})));

export const canonicalProfilePermissionKeys = canonicalModules.flatMap((module) => [module.key, ...module.actions]);
const canonicalKeySet = new Set(canonicalProfilePermissionKeys);
const parentModuleByAction = new Map(canonicalModules.flatMap((module) => module.actions.map((action) => [action, module.key])));

const LEGACY_EXPANSIONS = Object.freeze({
  acesso_campanhas: [
    'acesso_campanhas_ferias',
    'acesso_campanhas_gerais',
  ],
  perm_visualizar_campanhas: [
    'perm_visualizar_campanhas_ferias',
    'perm_visualizar_campanhas_gerais',
  ],
  perm_gerir_campanhas: [
    'perm_visualizar_campanhas_ferias',
    'perm_criar_campanhas_ferias',
    'perm_admin_campanhas_ferias',
    'perm_editar_campanhas_ferias',
    'perm_excluir_campanhas_ferias',
    'perm_visualizar_planos_ferias',
    'perm_criar_planos_ferias',
    'perm_editar_planos_ferias',
    'perm_excluir_planos_ferias',
    'perm_visualizar_campanhas_gerais',
    'perm_criar_campanhas',
    'perm_admin_campanhas',
    'perm_editar_campanhas',
    'perm_excluir_campanhas',
    'perm_enviar_lembretes_campanhas',
  ],
  perm_gerir_respostas: [
    'perm_visualizar_respostas_ferias',
    'perm_aprovar_ferias',
    'perm_gerar_ferias_campanhas',
    'perm_atribuir_permissoes_ferias',
    'perm_visualizar_respostas_campanhas',
    'perm_exportar_respostas_campanhas',
    'perm_baixar_anexos_respostas_campanhas',
    'perm_visualizar_solicitacoes_cadastrais',
    'perm_decidir_solicitacoes_cadastrais',
    'perm_aprovar_respostas_campanhas',
    'perm_atribuir_permissoes_campanhas',
  ],
  perm_excluir_atestados: ['perm_excluir_atestado'],
  perm_gerir_fluxo_dom_pedro_ii: ['perm_gerir_dom_pedro_ii'],
});

const DEPRECATED_WITHOUT_EQUIVALENT = new Set([
  'acesso_rotinas_administrativas',
  'perm_visualizar_rotinas_administrativas',
  'perm_gerir_rotinas_administrativas',
  'perm_executar_rotinas_administrativas',
  'perm_visualizar_rotinas_globais_administrativas',
  'perm_gerir_contratos_designacao',
]);

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const toBool = (value) => value === true || value === 1 || String(value || '').trim().toLowerCase() === 'true';

export function extractProfileMatrixRaw(rawDescricao = '') {
  const descricao = typeof rawDescricao === 'string' ? rawDescricao : '';
  const start = descricao.indexOf(PROFILE_MATRIX_START_MARKER);
  const end = descricao.indexOf(PROFILE_MATRIX_END_MARKER);
  if (start < 0 || end <= start) return {};
  const raw = descricao.slice(start + PROFILE_MATRIX_START_MARKER.length, end).trim();
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function extractProfileMatrixVersion(rawDescricao = '') {
  const descricao = typeof rawDescricao === 'string' ? rawDescricao : '';
  const start = descricao.indexOf(PROFILE_VERSION_START_MARKER);
  const end = descricao.indexOf(PROFILE_VERSION_END_MARKER);
  if (start < 0 || end <= start) return '';
  return descricao.slice(start + PROFILE_VERSION_START_MARKER.length, end).trim();
}

export function mergeProfileMatrixVersion(rawDescricao = '', version = CURRENT_PROFILE_MATRIX_VERSION) {
  const descricao = String(rawDescricao || '').replace(/\[SGP_PERMISSIONS_VERSION\][\s\S]*?\[\/SGP_PERMISSIONS_VERSION\]/g, '').trim();
  const marker = `${PROFILE_VERSION_START_MARKER}${version}${PROFILE_VERSION_END_MARKER}`;
  return descricao ? `${descricao}\n\n${marker}` : marker;
}

function collectRawPermissionSource(profile = {}) {
  const structured = profile?.matriz_permissoes && typeof profile.matriz_permissoes === 'object' && !Array.isArray(profile.matriz_permissoes)
    ? profile.matriz_permissoes
    : null;
  const embedded = extractProfileMatrixRaw(profile.descricao);
  return { ...profile, ...(structured || embedded) };
}

export function previewProfilePermissionMigration(profile = {}) {
  const source = collectRawPermissionSource(profile);
  const beforeVersion = String(profile?.versao_matriz_permissoes || '').trim()
    || extractProfileMatrixVersion(profile.descricao)
    || 'LEGADO_SEM_VERSAO';
  const aliasesApplied = [];
  const deprecatedKeys = [];
  const unknownKeys = [];
  const moduleRepairs = [];

  const finalMatrix = Object.fromEntries(canonicalProfilePermissionKeys.map((key) => [key, toBool(source[key])]));

  for (const [legacyKey, targets] of Object.entries(LEGACY_EXPANSIONS)) {
    if (!hasOwn(source, legacyKey) || !toBool(source[legacyKey])) continue;
    const enabledTargets = [];
    for (const target of targets) {
      if (!canonicalKeySet.has(target)) continue;
      if (finalMatrix[target] !== true) {
        finalMatrix[target] = true;
        enabledTargets.push(target);
      }
    }
    aliasesApplied.push({ legacyKey, targets: enabledTargets });
  }

  for (const key of Object.keys(extractProfileMatrixRaw(profile.descricao))) {
    if (canonicalKeySet.has(key) || Object.prototype.hasOwnProperty.call(LEGACY_EXPANSIONS, key)) continue;
    if (DEPRECATED_WITHOUT_EQUIVALENT.has(key)) deprecatedKeys.push(key);
    else if (key.startsWith('acesso_') || key.startsWith('perm_')) unknownKeys.push(key);
  }

  for (const module of canonicalModules) {
    const enabledChildActions = module.actions.filter((action) => finalMatrix[action] === true);
    if (enabledChildActions.length > 0 && finalMatrix[module.key] !== true) {
      finalMatrix[module.key] = true;
      moduleRepairs.push({ moduleKey: module.key, causedBy: enabledChildActions });
    }
  }

  const parsed = extractProfileMatrixFromDescription(profile.descricao);
  const cleanDescricao = parsed.cleanDescricao
    .replace(/\[SGP_PERMISSIONS_VERSION\][\s\S]*?\[\/SGP_PERMISSIONS_VERSION\]/g, '')
    .trim();
  const withMatrix = mergeProfileDescriptionWithMatrix(cleanDescricao, finalMatrix);
  const finalDescricao = mergeProfileMatrixVersion(withMatrix, CURRENT_PROFILE_MATRIX_VERSION);

  const beforeCanonical = profile?.matriz_permissoes && typeof profile.matriz_permissoes === 'object' && !Array.isArray(profile.matriz_permissoes)
    ? profile.matriz_permissoes
    : (parsed.matrix || {});
  const changedKeys = canonicalProfilePermissionKeys.filter((key) => Boolean(beforeCanonical[key]) !== finalMatrix[key]);

  return {
    profileId: profile.id || '',
    profileName: profile.nome_perfil || '',
    beforeVersion,
    afterVersion: CURRENT_PROFILE_MATRIX_VERSION,
    aliasesApplied,
    deprecatedKeys: [...new Set(deprecatedKeys)].sort(),
    unknownKeys: [...new Set(unknownKeys)].sort(),
    moduleRepairs,
    changedKeys,
    finalMatrix,
    finalDescricao,
    changed: finalDescricao !== String(profile.descricao || ''),
  };
}

export function previewProfilesPermissionMigration(profiles = []) {
  return (profiles || []).map(previewProfilePermissionMigration);
}
