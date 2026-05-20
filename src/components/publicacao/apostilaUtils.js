export function normalizarTexto(v = '') {
  return String(v || '').trim().toLowerCase();
}

export function resolverReferenciaApostila(formData = {}, criado = {}) {
  const origemTipoRaw =
      formData.publicacao_referencia_origem_tipo
      || criado.publicacao_referencia_origem_tipo
      || '';
  const origemTipoNormalizada = normalizarTexto(origemTipoRaw).replace(/_/g, '-');
  const mapaOrigem = {
    livro: 'livro',
    'ex-officio': 'ex-officio',
    exofficio: 'ex-officio',
    atestado: 'atestado',
  };

  return {
    refId: formData.publicacao_referencia_id || criado.publicacao_referencia_id || '',
    origemTipo: mapaOrigem[origemTipoNormalizada] || origemTipoNormalizada,
  };
}

export function montarPayloadOriginalApostilada(apostilaId) {
  return {
    apostilada_por_id: apostilaId,
    foi_apostilada: true,
  };
}

export function calcularFoiApostilada({ raiz = {}, apostilas = [], tsesPorApostila = [] } = {}) {
  const apostilaAtiva = apostilas.find((ap) => !ap?.tornada_sem_efeito_por_id);
  if (apostilaAtiva) return true;
  if (!raiz?.foi_apostilada && !raiz?.apostilada_por_id) return false;
  if (!raiz?.apostilada_por_id) return Boolean(raiz?.foi_apostilada);

  const apostilaFoiInvalidada = tsesPorApostila.some(
    (x) => x?.apostila?.id === raiz.apostilada_por_id && x?.tse,
  );
  return !apostilaFoiInvalidada;
}
