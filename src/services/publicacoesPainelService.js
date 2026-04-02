import { base44 } from '@/api/base44Client';

export async function listarMilitarIdsEscopo({ isAdmin, getMilitarScopeFilters }) {
  if (isAdmin) return null;

  const scopeFilters = getMilitarScopeFilters();
  if (!scopeFilters.length) return [];

  const militarQueries = await Promise.all(scopeFilters.map((f) => base44.entities.Militar.filter(f)));
  return [...new Set(militarQueries.flat().map((m) => m.id).filter(Boolean))];
}

export async function listarPublicacoesExOfficioEscopo({ isAdmin, getMilitarScopeFilters }) {
  if (isAdmin) return base44.entities.PublicacaoExOfficio.list('-created_date');

  const militarIds = await listarMilitarIdsEscopo({ isAdmin, getMilitarScopeFilters });
  if (!militarIds?.length) return [];

  const arrays = await Promise.all(militarIds.map((id) => base44.entities.PublicacaoExOfficio.filter({ militar_id: id }, '-created_date')));
  const map = new Map();
  arrays.flat().forEach((item) => map.set(item.id, item));
  return Array.from(map.values()).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
}

export async function listarAtestadosPublicacaoEscopo({ isAdmin, getMilitarScopeFilters }) {
  if (isAdmin) return (await base44.entities.Atestado.list('-created_date')).filter((a) => a.nota_para_bg || a.numero_bg);

  const militarIds = await listarMilitarIdsEscopo({ isAdmin, getMilitarScopeFilters });
  if (!militarIds?.length) return [];

  const arrays = await Promise.all(militarIds.map((id) => base44.entities.Atestado.filter({ militar_id: id }, '-created_date')));
  const map = new Map();
  arrays.flat().forEach((item) => {
    if (item.nota_para_bg || item.numero_bg) map.set(item.id, item);
  });

  return Array.from(map.values()).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
}

export function calcularMetricasPublicacao(registros = [], { getStatusCanonico, isInconsistente }) {
  return registros.reduce((acc, registro) => {
    acc.total += 1;

    const statusCanonico = getStatusCanonico(registro);
    if (statusCanonico === 'Aguardando Nota') acc.aguardandoNota += 1;
    if (statusCanonico === 'Aguardando Publicação') acc.aguardandoPublicacao += 1;
    if (statusCanonico === 'Publicado') acc.publicados += 1;
    if (isInconsistente(registro)) acc.inconsistentes += 1;

    return acc;
  }, {
    total: 0,
    aguardandoNota: 0,
    aguardandoPublicacao: 0,
    publicados: 0,
    inconsistentes: 0,
  });
}
