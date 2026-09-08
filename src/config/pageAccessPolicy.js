// Política canônica de entrada das páginas tratadas no F8-L06.
// A mesma fonte é consumida pelo roteador e pelo menu para impedir divergência
// entre item visível e acesso por URL direta.
export const PAGE_ACCESS_POLICY = {
  AntiguidadePrevia: {
    moduleKey: 'antiguidade',
    actionKey: 'visualizar_rastreamento_promocoes',
    moduleName: 'Antiguidade',
  },
  EstruturaOrganizacional: {
    moduleKey: 'estrutura_organizacional',
    actionKey: 'visualizar_estrutura_organizacional',
    moduleName: 'Estrutura Organizacional',
  },
  MigracaoMilitares: {
    moduleKey: 'migracao_militares',
    actionKey: 'visualizar_importacao_militares',
    moduleName: 'Migração de Militares',
  },
  AvaliacaoComportamento: {
    moduleKey: 'controle_comportamento',
    actionKey: 'visualizar_controle_comportamento',
    moduleName: 'Controle de Comportamento',
  },
  Configuracoes: {
    moduleKey: 'configuracoes',
    actionKey: 'gerir_configuracoes',
    moduleName: 'Configurações',
  },
  Tags: {
    moduleKey: 'tags',
    actionKey: 'visualizar_tags',
    moduleName: 'Tags',
  },
  GruposEfetivo: {
    moduleKey: 'grupos_efetivo',
    actionKey: 'visualizar_grupos_efetivo',
    moduleName: 'Grupos do Efetivo',
  },
};

const NORMALIZED = Object.fromEntries(
  Object.entries(PAGE_ACCESS_POLICY).map(([page, policy]) => [page.toLowerCase(), policy]),
);

export function getPageAccessPolicy(page) {
  return NORMALIZED[String(page || '').toLowerCase()] || null;
}

export function canAccessPagePolicy(policy, { canAccessModule, canAccessAction, isAdmin = false, canAccessAll = false } = {}) {
  if (!policy) return true;
  if (isAdmin || canAccessAll) return true;
  const moduleOk = !policy.moduleKey || Boolean(canAccessModule?.(policy.moduleKey));
  const actionOk = !policy.actionKey || Boolean(canAccessAction?.(policy.actionKey));
  return moduleOk && actionOk;
}
