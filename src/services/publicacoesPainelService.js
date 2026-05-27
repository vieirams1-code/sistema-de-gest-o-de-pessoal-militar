import { base44 } from '@/api/base44Client';


const TAMANHO_LOTE_PADRAO = 20;

function deduplicarOrdenarPorCreatedDate(registros = []) {
  const map = new Map();
  (registros || []).forEach((item) => map.set(item.id, item));
  return Array.from(map.values()).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
}

async function listarPorMilitarIdsComFallbackInOperator({ entidade, militarIds = [], ordem = '-created_date', tamanhoLote = TAMANHO_LOTE_PADRAO }) {
  if (!militarIds?.length) return [];

  try {
    return await entidade.filter({ militar_id: { in: militarIds } }, ordem);
  } catch (erroInOperator) {
    const resultados = [];

    for (let inicio = 0; inicio < militarIds.length; inicio += tamanhoLote) {
      const loteIds = militarIds.slice(inicio, inicio + tamanhoLote);
      const consultas = loteIds.map((id) => entidade.filter({ militar_id: id }, ordem));
      const lote = await Promise.allSettled(consultas);

      lote.forEach((resultado) => {
        if (resultado.status === 'fulfilled') resultados.push(...(resultado.value || []));
      });
    }

    return resultados;
  }
}

async function expandirMilitarIdsComMesclados(militarIds = []) {
  const idsBase = [...new Set((militarIds || []).filter(Boolean))];
  if (!idsBase.length) return [];

  const relacionados = await Promise.all(
    idsBase.map((id) => base44.entities.Militar.filter({ merged_into_id: id }))
  );

  const idsMesclados = relacionados
    .flat()
    .map((militar) => militar?.id)
    .filter(Boolean);

  return [...new Set([...idsBase, ...idsMesclados])];
}

export async function listarMilitarIdsEscopo({ isAdmin, getMilitarScopeFilters }) {
  if (isAdmin) return null;

  const scopeFilters = getMilitarScopeFilters();
  if (!scopeFilters.length) return [];

  const militarQueries = await Promise.all(scopeFilters.map((f) => base44.entities.Militar.filter(f)));
  const militarIdsEscopo = [...new Set(militarQueries.flat().map((m) => m.id).filter(Boolean))];
  return expandirMilitarIdsComMesclados(militarIdsEscopo);
}

export async function listarPublicacoesExOfficioEscopo({ isAdmin, getMilitarScopeFilters }) {
  if (isAdmin) return base44.entities.PublicacaoExOfficio.list('-created_date');

  const militarIds = await listarMilitarIdsEscopo({ isAdmin, getMilitarScopeFilters });
  if (!militarIds?.length) return [];

  const registros = await listarPorMilitarIdsComFallbackInOperator({
    entidade: base44.entities.PublicacaoExOfficio,
    militarIds,
    ordem: '-created_date',
  });

  return deduplicarOrdenarPorCreatedDate(registros);
}

export async function listarAtestadosPublicacaoEscopo({ isAdmin, getMilitarScopeFilters }) {
  if (isAdmin) return (await base44.entities.Atestado.list('-created_date')).filter((a) => a.nota_para_bg || a.numero_bg);

  const militarIds = await listarMilitarIdsEscopo({ isAdmin, getMilitarScopeFilters });
  if (!militarIds?.length) return [];

  const registros = await listarPorMilitarIdsComFallbackInOperator({
    entidade: base44.entities.Atestado,
    militarIds,
    ordem: '-created_date',
  });

  return deduplicarOrdenarPorCreatedDate(
    registros.filter((item) => item.nota_para_bg || item.numero_bg)
  );
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
