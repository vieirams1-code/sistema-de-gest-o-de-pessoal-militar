const MOTIVOS = {
  SEM_POSTO: 'PENDENTE_SEM_POSTO',
  SEM_QUADRO: 'PENDENTE_SEM_QUADRO',
  SEM_DATA: 'PENDENTE_SEM_DATA_PROMOCAO',
  SEM_ANTERIOR: 'PENDENTE_SEM_ANTIGUIDADE_ANTERIOR',
  EMPATE: 'EMPATE_NAO_RESOLVIDO',
};

const valorTexto = (v) => String(v || '').trim();
const toNumeroValido = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

export function obterHistoricoAtivoMaisRecenteCompativel(militar = {}, historicos = []) {
  const postoAtual = valorTexto(militar?.posto_graduacao);
  const quadroAtual = valorTexto(militar?.quadro);
  const elegiveis = (historicos || []).filter((h) => {
    if (!h) return false;
    const status = valorTexto(h.status_registro || 'ativo').toLowerCase();
    if (status && status !== 'ativo') return false;
    if (valorTexto(h.militar_id) !== valorTexto(militar?.id)) return false;
    if (!valorTexto(h.data_promocao)) return false;
    if (postoAtual && valorTexto(h.posto_graduacao_novo) !== postoAtual) return false;
    if (quadroAtual && valorTexto(h.quadro_novo) !== quadroAtual) return false;
    return true;
  });

  return elegiveis.sort((a, b) => {
    const da = Date.parse(a?.data_promocao || '') || 0;
    const db = Date.parse(b?.data_promocao || '') || 0;
    return db - da;
  })[0] || null;
}

export default function validarDadosAntiguidade(militar = {}, historicos = [], contexto = {}) {
  const motivos = [];
  const postoGraduacao = valorTexto(militar?.posto_graduacao);
  const quadro = valorTexto(militar?.quadro);

  if (!postoGraduacao) motivos.push(MOTIVOS.SEM_POSTO);
  if (!quadro) motivos.push(MOTIVOS.SEM_QUADRO);

  const historicoAtivo = obterHistoricoAtivoMaisRecenteCompativel(militar, historicos);
  const dataPromocaoAtual = valorTexto(militar?.data_promocao_atual) || valorTexto(historicoAtivo?.data_promocao);
  const antiguidadeReferenciaOrdem = toNumeroValido(militar?.antiguidade_referencia_ordem ?? historicoAtivo?.antiguidade_referencia_ordem);
  const antiguidadeReferenciaId = valorTexto(militar?.antiguidade_referencia_id || historicoAtivo?.antiguidade_referencia_id);

  if (!dataPromocaoAtual) motivos.push(MOTIVOS.SEM_DATA);

  const exigeAntiguidadeAnterior = Boolean(contexto?.exigeAntiguidadeAnterior);
  if (exigeAntiguidadeAnterior && antiguidadeReferenciaOrdem == null) motivos.push(MOTIVOS.SEM_ANTERIOR);

  if (contexto?.empateNaoResolvido) motivos.push(MOTIVOS.EMPATE);

  return {
    status: motivos.length ? 'pendente' : 'ok',
    motivos,
    dataPromocaoAtual: dataPromocaoAtual || null,
    antiguidadeReferenciaOrdem,
    antiguidadeReferenciaId: antiguidadeReferenciaId || null,
  };
}

export { MOTIVOS };
