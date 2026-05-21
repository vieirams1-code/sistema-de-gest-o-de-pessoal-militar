function toTime(value) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
}

function toIdRank(value) {
  const num = Number(value);
  if (!Number.isNaN(num) && Number.isFinite(num)) return num;
  return String(value || '');
}

function compararHistoricosDesc(a = {}, b = {}) {
  const camposData = ['data_promocao', 'data_publicacao', 'created_at'];
  for (const campo of camposData) {
    const delta = toTime(b?.[campo]) - toTime(a?.[campo]);
    if (delta !== 0) return delta;
  }

  const idA = toIdRank(a?.id);
  const idB = toIdRank(b?.id);
  if (typeof idA === 'number' && typeof idB === 'number') return idB - idA;
  return String(idB).localeCompare(String(idA));
}

export function selecionarHistoricoAtivoMaisRecente(historicos = []) {
  const ativos = (historicos || []).filter((historico) => historico?.status_registro === 'ativo');
  if (ativos.length === 0) return null;
  return [...ativos].sort(compararHistoricosDesc)[0] || null;
}

export { compararHistoricosDesc };
