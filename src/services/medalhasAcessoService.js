export const ACOES_MEDALHAS = {
  INDICAR: 'indicar_medalhas',
  CONCEDER: 'conceder_medalhas',
  RESETAR: 'resetar_indicacoes_medalhas',
  IMPEDIMENTOS: 'gerir_impedimentos_medalha',
  DOM_PEDRO: 'gerir_dom_pedro_ii',
  EXPORTAR: 'exportar_medalhas',
};

export const ACOES_APURACAO = [
  ACOES_MEDALHAS.INDICAR,
  ACOES_MEDALHAS.CONCEDER,
  ACOES_MEDALHAS.RESETAR,
  ACOES_MEDALHAS.IMPEDIMENTOS,
  ACOES_MEDALHAS.EXPORTAR,
];

export function temAlgumaPermissaoMedalhas(canAccessAction, acoes = []) {
  return acoes.some((acao) => canAccessAction(acao));
}

export function validarPermissaoAcaoMedalhas({ canAccessAction, acao, mensagem }) {
  if (!canAccessAction(acao)) {
    throw new Error(mensagem || 'Você não possui permissão para executar esta ação.');
  }
}

export function validarMilitarDentroEscopo({ isAdmin, militarId, militarIdsEscopo, mensagem }) {
  if (isAdmin) return;
  if (!militarId || !militarIdsEscopo?.has(militarId)) {
    throw new Error(mensagem || 'Ação negada: militar fora do escopo organizacional do usuário.');
  }
}

export function adicionarAuditoriaMedalha(payload = {}, { userEmail, acao } = {}) {
  const auditoria = {
    ...payload,
    updated_by: userEmail || payload.updated_by || '',
    updated_at: new Date().toISOString(),
  };

  if (!userEmail) return auditoria;

  if (acao === 'indicacao') auditoria.indicado_por = userEmail;
  if (acao === 'concessao') auditoria.concedido_por = userEmail;
  if (acao === 'reset') auditoria.resetado_por = userEmail;

  return auditoria;
}

export async function listarMilitaresEscopo({ base44Client, isAdmin, getMilitarScopeFilters }) {
  if (isAdmin) return base44Client.entities.Militar.list('nome_completo');

  const scopeFilters = getMilitarScopeFilters();
  if (!scopeFilters.length) return [];

  const militarQueries = await Promise.all(scopeFilters.map((f) => base44Client.entities.Militar.filter(f, 'nome_completo')));
  const mapa = new Map();
  militarQueries.flat().forEach((militar) => mapa.set(militar.id, militar));
  return Array.from(mapa.values()).sort((a, b) => String(a.nome_completo || '').localeCompare(String(b.nome_completo || '')));
}

export async function listarMedalhasEscopo({ base44Client, isAdmin, militarIds = [] }) {
  if (isAdmin) return base44Client.entities.Medalha.list('-created_date');
  if (!militarIds.length) return [];

  const listas = await Promise.all(militarIds.map((id) => base44Client.entities.Medalha.filter({ militar_id: id }, '-created_date')));
  const mapa = new Map();
  listas.flat().forEach((registro) => mapa.set(registro.id, registro));
  return Array.from(mapa.values()).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
}

export async function listarImpedimentosEscopo({ base44Client, isAdmin, militarIds = [] }) {
  if (isAdmin) return base44Client.entities.ImpedimentoMedalha.list('-created_date');
  if (!militarIds.length) return [];

  const listas = await Promise.all(militarIds.map((id) => base44Client.entities.ImpedimentoMedalha.filter({ militar_id: id }, '-created_date')));
  const mapa = new Map();
  listas.flat().forEach((registro) => mapa.set(registro.id, registro));
  return Array.from(mapa.values()).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
}
