const TEXTO_VAZIO = '—';

export const POSTOS_GRADUACOES_PROMOCAO = [
  'Coronel',
  'Tenente Coronel',
  'Tenente-Coronel',
  'Major',
  'Capitão',
  '1º Tenente',
  '2º Tenente',
  'Aspirante',
  'Aspirante a Oficial',
  'Subtenente',
  '1º Sargento',
  '2º Sargento',
  '3º Sargento',
  'Cabo',
  'Soldado',
];

const STATUS_OPERACIONAIS = new Set(['ativo', 'previsto']);
const STATUS_CANCELADOS_RETIFICADOS = new Set(['cancelado', 'cancelada', 'retificado', 'retificada']);

export function texto(valor) {
  return String(valor ?? '').trim();
}

export function normalizar(valor) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function valorOuTraco(valor) {
  return texto(valor) || TEXTO_VAZIO;
}

export function dataFormatada(data) {
  if (!data) return TEXTO_VAZIO;
  const [ano, mes, dia] = String(data).split('T')[0].split('-');
  if (!ano || !mes || !dia) return texto(data) || TEXTO_VAZIO;
  return `${dia}/${mes}/${ano}`;
}

export function nomeMilitar(militar) {
  return texto(militar?.nome_guerra) || texto(militar?.nome_completo) || 'Militar sem nome';
}

export function tituloPromocao(promocao) {
  const partes = [
    promocao?.posto_graduacao,
    promocao?.quadro,
    dataFormatada(promocao?.data_promocao),
  ].filter((parte) => texto(parte) && parte !== TEXTO_VAZIO);
  return partes.length ? partes.join(' • ') : `Promoção ${promocao?.id || ''}`.trim();
}

export function statusNormalizado(valor) {
  return normalizar(valor) || 'ativo';
}

export function isStatusOperacional(registro) {
  return STATUS_OPERACIONAIS.has(statusNormalizado(registro?.status_registro));
}

export function isStatusCanceladoRetificado(registro) {
  return STATUS_CANCELADOS_RETIFICADOS.has(statusNormalizado(registro?.status_registro));
}

export function isOrdemPreenchida(valor) {
  if (valor === null || valor === undefined || valor === '') return false;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0;
}

export function indicePostoGraduacao(postoGraduacao) {
  const alvo = normalizar(postoGraduacao);
  const indice = POSTOS_GRADUACOES_PROMOCAO.findIndex((posto) => normalizar(posto) === alvo);
  return indice >= 0 ? indice : POSTOS_GRADUACOES_PROMOCAO.length;
}

export function compararTexto(a, b) {
  return texto(a).localeCompare(texto(b), 'pt-BR', { sensitivity: 'base', numeric: true });
}

export function ordenarPromocoes(promocoes = []) {
  return [...promocoes].sort((a, b) => {
    const data = texto(b?.data_promocao).localeCompare(texto(a?.data_promocao));
    if (data) return data;

    const posto = indicePostoGraduacao(a?.posto_graduacao) - indicePostoGraduacao(b?.posto_graduacao);
    if (posto) return posto;

    const quadro = compararTexto(a?.quadro, b?.quadro);
    if (quadro) return quadro;

    const status = compararTexto(a?.status, b?.status);
    if (status) return status;

    return compararTexto(a?.id, b?.id);
  });
}

export function chaveAgrupamentoPromocaoLike(item) {
  return [
    item?.posto_graduacao ?? item?.posto_graduacao_novo,
    item?.quadro ?? item?.quadro_novo,
    item?.data_promocao,
    item?.data_publicacao,
    item?.boletim_referencia,
    item?.ato_referencia,
  ].map((valor) => normalizar(valor) || '∅').join('|');
}


function mesmoValorNormalizado(a, b) {
  return normalizar(a) === normalizar(b);
}

function rotuloCampoAusenteOuDivergente(valorHistorico, valorPromocao, rotuloAusente, rotuloDivergente = rotuloAusente) {
  if (!texto(valorHistorico) || !texto(valorPromocao)) return rotuloAusente;
  return mesmoValorNormalizado(valorHistorico, valorPromocao) ? '' : rotuloDivergente;
}

export function avaliarCompatibilidadePromocao(historico, promocao) {
  const motivos = [];
  const mesmoPosto = mesmoValorNormalizado(historico?.posto_graduacao_novo, promocao?.posto_graduacao);
  const mesmoQuadro = mesmoValorNormalizado(historico?.quadro_novo, promocao?.quadro);
  const mesmaDataPromocao = mesmoValorNormalizado(historico?.data_promocao, promocao?.data_promocao);

  if (!mesmoPosto || !mesmoQuadro || !mesmaDataPromocao) {
    return {
      compatibilidade: 'fraca',
      motivos: [
        !mesmoPosto ? 'posto divergente' : '',
        !mesmoQuadro ? 'quadro divergente' : '',
        !mesmaDataPromocao ? 'datas divergentes' : '',
      ].filter(Boolean),
    };
  }

  const dataPublicacao = rotuloCampoAusenteOuDivergente(
    historico?.data_publicacao,
    promocao?.data_publicacao,
    'datas divergentes',
    'datas divergentes',
  );
  const boletim = rotuloCampoAusenteOuDivergente(
    historico?.boletim_referencia,
    promocao?.boletim_referencia,
    'faltando boletim',
    'boletim divergente',
  );
  const ato = rotuloCampoAusenteOuDivergente(
    historico?.ato_referencia,
    promocao?.ato_referencia,
    'faltando ato',
    'ato divergente',
  );

  [dataPublicacao, boletim, ato].filter(Boolean).forEach((motivo) => motivos.push(motivo));

  if (texto(historico?.promocao_id) && texto(historico?.promocao_id) !== texto(promocao?.id)) motivos.push('já vinculado');
  if (!isOrdemPreenchida(historico?.antiguidade_referencia_ordem)) motivos.push('sem ordem');
  if (isStatusCanceladoRetificado(historico)) motivos.push(statusNormalizado(historico?.status_registro).startsWith('retific') ? 'retificado' : 'cancelado');
  if (!statusCompativelComPromocao(historico, promocao)) motivos.push('status incompatível');

  return {
    compatibilidade: motivos.length === 0 ? 'forte' : 'provável',
    motivos: [...new Set(motivos)],
  };
}

export function historicoCombinaComPromocao(historico, promocao) {
  return avaliarCompatibilidadePromocao(historico, promocao).compatibilidade === 'forte';
}

export function statusCompativelComPromocao(historico, promocao) {
  const statusHistorico = statusNormalizado(historico?.status_registro);
  const statusPromocao = statusNormalizado(promocao?.status);
  const tipoPromocao = statusNormalizado(promocao?.tipo);

  if (statusPromocao === 'prevista' || tipoPromocao === 'prevista') return statusHistorico === 'previsto';
  if (['ativa', 'ativo', 'concluida', 'concluido', 'homologada', 'historica'].includes(statusPromocao) || tipoPromocao === 'historica') {
    return statusHistorico === 'ativo';
  }

  return STATUS_OPERACIONAIS.has(statusHistorico);
}

export function ordenarHistoricosVinculados(itens = []) {
  return [...itens].sort((a, b) => {
    const ordemA = Number(a?.antiguidade_referencia_ordem || 0) || Number.POSITIVE_INFINITY;
    const ordemB = Number(b?.antiguidade_referencia_ordem || 0) || Number.POSITIVE_INFINITY;
    if (ordemA !== ordemB) return ordemA - ordemB;

    const nome = compararTexto(nomeMilitar(a?.militar), nomeMilitar(b?.militar));
    if (nome) return nome;

    return compararTexto(a?.militar?.matricula, b?.militar?.matricula);
  });
}

export function montarMilitarPorId(militares = []) {
  return new Map((militares || []).map((militar) => [String(militar?.id || ''), militar]));
}

export function enriquecerHistoricos(historicos = [], militarPorId = new Map()) {
  return (historicos || []).map((historico) => ({
    ...historico,
    militar: militarPorId.get(String(historico?.militar_id || '')) || null,
  }));
}

export function alertasCandidato(historico, promocao) {
  const alertas = [];
  if (!isOrdemPreenchida(historico?.antiguidade_referencia_ordem)) alertas.push('Sem ordem de antiguidade');

  const chavePromocao = chaveAgrupamentoPromocaoLike(promocao);
  const chaveHistorico = chaveAgrupamentoPromocaoLike(historico);
  if (chavePromocao !== chaveHistorico) alertas.push('Chave divergente');

  return alertas;
}

export function diagnosticarPromocao({ promocao, historicosCompativeis = [] }) {
  const compativeisOutraPromocao = historicosCompativeis.filter((historico) => texto(historico?.promocao_id) && texto(historico?.promocao_id) !== texto(promocao?.id));
  const canceladosRetificados = historicosCompativeis.filter(isStatusCanceladoRetificado);
  const semOrdem = historicosCompativeis.filter((historico) => isStatusOperacional(historico) && !isOrdemPreenchida(historico?.antiguidade_referencia_ordem));

  const porMilitar = new Map();
  historicosCompativeis
    .filter((historico) => !isStatusCanceladoRetificado(historico))
    .forEach((historico) => {
      const militarId = texto(historico?.militar_id) || `sem-militar:${historico?.id}`;
      porMilitar.set(militarId, (porMilitar.get(militarId) || 0) + 1);
    });
  const duplicidadesMilitar = [...porMilitar.entries()].filter(([, total]) => total > 1);

  const chavePromocao = chaveAgrupamentoPromocaoLike(promocao);
  const chaveDivergente = texto(promocao?.chave_agrupamento) && texto(promocao?.chave_agrupamento) !== chavePromocao;

  return {
    compativeisOutraPromocao,
    duplicidadesMilitar,
    semOrdem,
    canceladosRetificados,
    chaveDivergente,
    chaveCalculada: chavePromocao,
  };
}

export function filtrarCandidatosCompativeis({ promocao, historicos = [] }) {
  return historicos.filter((historico) => (
    avaliarCompatibilidadePromocao(historico, promocao).compatibilidade === 'forte'
    && !texto(historico?.promocao_id)
    && statusCompativelComPromocao(historico, promocao)
  ));
}

export function buscarCandidatosProvaveis({ promocao, historicos = [] }) {
  return historicos
    .map((historico) => ({
      ...historico,
      diagnosticoCompatibilidade: avaliarCompatibilidadePromocao(historico, promocao),
    }))
    .filter((historico) => historico.diagnosticoCompatibilidade.compatibilidade === 'provável');
}

export function montarDiagnosticoMilitaresPromocao({ promocao, historicos = [], militares = [] }) {
  const historicosPorMilitar = new Map();
  historicos.forEach((historico) => {
    const militarId = texto(historico?.militar_id);
    if (!militarId) return;
    if (!historicosPorMilitar.has(militarId)) historicosPorMilitar.set(militarId, []);
    historicosPorMilitar.get(militarId).push(historico);
  });

  const linhasHistoricos = historicos
    .map((historico) => ({ historico, avaliacao: avaliarCompatibilidadePromocao(historico, promocao) }))
    .filter(({ avaliacao }) => avaliacao.compatibilidade !== 'fraca')
    .map(({ historico, avaliacao }) => {
      const motivos = avaliacao.motivos.length ? avaliacao.motivos : ['histórico compatível'];
      const vinculadoNesta = texto(historico?.promocao_id) === texto(promocao?.id);
      const vinculadoOutra = texto(historico?.promocao_id) && !vinculadoNesta;
      const situacao = vinculadoNesta ? 'Vinculado' : vinculadoOutra ? 'Já vinculado em outra promoção' : avaliacao.compatibilidade === 'forte' ? 'Compatível' : 'Sem vínculo';
      const acaoSugerida = vinculadoNesta ? 'Acompanhar' : vinculadoOutra ? 'Conflito' : avaliacao.compatibilidade === 'forte' ? 'Pode vincular' : 'Revisar';

      return {
        chave: `historico:${historico?.id}`,
        militar_id: historico?.militar_id,
        historico_id: historico?.id,
        situacao,
        motivo: motivos.join(', '),
        acaoSugerida,
        compatibilidade: avaliacao.compatibilidade,
      };
    });

  const militaresSemHistorico = militares
    .filter((militar) => mesmoValorNormalizado(militar?.posto_graduacao, promocao?.posto_graduacao)
      && mesmoValorNormalizado(militar?.quadro, promocao?.quadro)
      && !historicosPorMilitar.has(texto(militar?.id)))
    .map((militar) => ({
      chave: `militar-sem-historico:${militar?.id}`,
      militar_id: militar?.id,
      historico_id: '',
      situacao: 'Sem histórico',
      motivo: 'Sem histórico V2',
      acaoSugerida: 'Criar histórico futuramente',
      compatibilidade: 'diagnóstico',
    }));

  return [...linhasHistoricos, ...militaresSemHistorico];
}
