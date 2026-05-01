const normalizar = (v) => String(v || '').trim();
const parseDate = (v) => {
  const t = Date.parse(v || '');
  return Number.isFinite(t) ? t : null;
};

const indiceOrdem = (lista = [], valor) => {
  const alvo = normalizar(valor).toUpperCase();
  const idx = (lista || []).findIndex((item) => normalizar(item).toUpperCase() === alvo);
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
};

export default function calcularAntiguidadeMilitar(a = {}, b = {}, config = {}) {
  const ordemPostos = config?.ordem_postos || [];
  const ordemQuadros = config?.ordem_quadros || [];

  const postoDiff = indiceOrdem(ordemPostos, a?.posto_graduacao) - indiceOrdem(ordemPostos, b?.posto_graduacao);
  if (postoDiff !== 0) return postoDiff;

  const quadroDiff = indiceOrdem(ordemQuadros, a?.quadro) - indiceOrdem(ordemQuadros, b?.quadro);
  if (quadroDiff !== 0) return quadroDiff;

  const dataA = parseDate(a?.dataPromocaoAtual || a?.data_promocao_atual);
  const dataB = parseDate(b?.dataPromocaoAtual || b?.data_promocao_atual);
  if (dataA != null && dataB != null && dataA !== dataB) return dataA - dataB;
  if (dataA == null && dataB != null) return 1;
  if (dataA != null && dataB == null) return -1;

  const antA = Number.isFinite(Number(a?.antiguidadeReferenciaOrdem ?? a?.antiguidade_referencia_ordem)) ? Number(a?.antiguidadeReferenciaOrdem ?? a?.antiguidade_referencia_ordem) : null;
  const antB = Number.isFinite(Number(b?.antiguidadeReferenciaOrdem ?? b?.antiguidade_referencia_ordem)) ? Number(b?.antiguidadeReferenciaOrdem ?? b?.antiguidade_referencia_ordem) : null;
  if (antA != null && antB != null && antA !== antB) return antA - antB;
  if (antA == null && antB != null) return 1;
  if (antA != null && antB == null) return -1;

  return 0;
}
