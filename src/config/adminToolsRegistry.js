export const ADMIN_TOOL_CATEGORIES = Object.freeze({
  AUDITORIAS: 'auditorias',
  SANEAMENTOS: 'saneamentos',
  MIGRACOES: 'migracoes',
  DIAGNOSTICOS: 'diagnosticos',
  TEMPORARIAS: 'temporarias',
});

export const ADMIN_TOOL_TABS = Object.freeze([
  { key: ADMIN_TOOL_CATEGORIES.AUDITORIAS, label: 'Auditorias' },
  { key: ADMIN_TOOL_CATEGORIES.SANEAMENTOS, label: 'Saneamentos' },
  { key: ADMIN_TOOL_CATEGORIES.MIGRACOES, label: 'Migrações' },
  { key: ADMIN_TOOL_CATEGORIES.DIAGNOSTICOS, label: 'Diagnósticos' },
  { key: ADMIN_TOOL_CATEGORIES.TEMPORARIAS, label: 'Temporárias' },
]);

export const adminToolsRegistry = Object.freeze({
  [ADMIN_TOOL_CATEGORIES.AUDITORIAS]: Object.freeze([]),
  [ADMIN_TOOL_CATEGORIES.SANEAMENTOS]: Object.freeze([]),
  [ADMIN_TOOL_CATEGORIES.MIGRACOES]: Object.freeze([]),
  [ADMIN_TOOL_CATEGORIES.DIAGNOSTICOS]: Object.freeze([]),
  [ADMIN_TOOL_CATEGORIES.TEMPORARIAS]: Object.freeze([]),
});

export const getAdminToolsByCategory = (categoryKey) => adminToolsRegistry[categoryKey] || [];
