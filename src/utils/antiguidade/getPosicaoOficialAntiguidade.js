export const ANTIGUIDADE_OFICIAL_ITENS_QUERY_KEY = ['antiguidade-oficial-itens'];

export function getPosicaoOficialAntiguidade(itensAntiguidade = []) {
  const mapa = new Map();
  (Array.isArray(itensAntiguidade) ? itensAntiguidade : []).forEach((item, index) => {
    const militarId = String(item?.militar_id || item?.militarId || item?.id || '').trim();
    if (!militarId) return;
    const posicaoNumero = Number(item?.posicao);
    mapa.set(militarId, Number.isFinite(posicaoNumero) ? posicaoNumero : index + 1);
  });
  return mapa;
}

export function getPosicaoOficialAntiguidadeFromCache(queryClient) {
  const itens = queryClient?.getQueryData?.(ANTIGUIDADE_OFICIAL_ITENS_QUERY_KEY);
  const hasOrdemOficialAntiguidade = Array.isArray(itens) && itens.length > 0;
  return {
    hasOrdemOficialAntiguidade,
    posicaoOficialByMilitarId: getPosicaoOficialAntiguidade(hasOrdemOficialAntiguidade ? itens : []),
  };
}
