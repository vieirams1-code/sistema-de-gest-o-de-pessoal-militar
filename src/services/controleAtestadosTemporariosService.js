const MS_POR_DIA = 24 * 60 * 60 * 1000;

const CAMPOS_DIAS = ['dias', 'quantidade_dias', 'dias_afastamento', 'total_dias'];
const QUADROS_TEMPORARIOS_CONTROLE_ATESTADOS = new Set(['QOETBM', 'QOSTBM', 'QPTBM']);
const QUADROS_NAO_TEMPORARIOS_CONHECIDOS_CONTROLE_ATESTADOS = new Set(['QOBM', 'QAOBM', 'QOEBM', 'QOSAU', 'QBMP', 'QBMP1A', 'QBMP1B', 'QBMP2', 'QBMP2B', 'QPBM']);
const QUADROS_LEGADOS_CONTROLE_ATESTADOS = {
  QBMPT: 'QPTBM',
};

function criarDataUtc(ano, mes, dia) {
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCHours(0, 0, 0, 0);
  return data;
}

function adicionarDias(data, dias) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return null;
  return new Date(data.getTime() + dias * MS_POR_DIA);
}

function formatarDataIso(data) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return null;
  return data.toISOString().slice(0, 10);
}

function extrairNumeroDias(atestado) {
  for (const campo of CAMPOS_DIAS) {
    const valor = Number(atestado?.[campo]);
    if (Number.isFinite(valor) && valor > 0) return Math.floor(valor);
  }
  return null;
}

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function normalizarToken(valor) {
  return normalizarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function normalizarQuadroControleAtestados(quadro) {
  const normalizado = normalizarToken(quadro);
  return QUADROS_LEGADOS_CONTROLE_ATESTADOS[normalizado] || normalizado;
}

export function isQuadroTemporario(quadro) {
  return QUADROS_TEMPORARIOS_CONTROLE_ATESTADOS.has(normalizarQuadroControleAtestados(quadro));
}

export function isMilitarTemporarioParaControleAtestados(militar) {
  return isQuadroTemporario(militar?.quadro || militar?.militar_quadro || militar?.quadro_militar);
}

export function parseDateOnlySeguro(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return criarDataUtc(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, ano, mes, dia] = isoMatch;
    const data = criarDataUtc(Number(ano), Number(mes), Number(dia));
    return formatarDataIso(data) === `${ano}-${mes}-${dia}` ? data : null;
  }

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, dia, mes, ano] = brMatch;
    const data = criarDataUtc(Number(ano), Number(mes), Number(dia));
    return formatarDataIso(data) === `${ano}-${mes}-${dia}` ? data : null;
  }

  return null;
}

export function contarDiasInclusivos(inicio, fim) {
  const dataInicio = parseDateOnlySeguro(inicio) || inicio;
  const dataFim = parseDateOnlySeguro(fim) || fim;
  if (!(dataInicio instanceof Date) || !(dataFim instanceof Date)) return 0;
  if (Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime())) return 0;
  if (dataFim < dataInicio) return 0;
  return Math.floor((dataFim.getTime() - dataInicio.getTime()) / MS_POR_DIA) + 1;
}

export function normalizarPeriodoAtestado(atestado) {
  const lacunas = [];
  const inicio = parseDateOnlySeguro(atestado?.data_inicio);

  if (!inicio) {
    lacunas.push('Atestado ignorado por ausência de data inicial válida.');
    return { atestado, inicio: null, fim: null, dias: 0, valido: false, lacunas };
  }

  let fim = parseDateOnlySeguro(atestado?.data_termino);
  const diasInformados = extrairNumeroDias(atestado);

  if (!fim && diasInformados) {
    fim = adicionarDias(inicio, diasInformados - 1);
  }

  if (!fim) {
    lacunas.push('Atestado ignorado por ausência de data final válida ou quantidade de dias.');
    return { atestado, inicio, fim: null, dias: 0, valido: false, lacunas };
  }

  if (fim < inicio) {
    lacunas.push('Atestado ignorado porque a data final é anterior à data inicial.');
    return { atestado, inicio, fim, dias: 0, valido: false, lacunas };
  }

  return {
    atestado,
    inicio,
    fim,
    dias: contarDiasInclusivos(inicio, fim),
    valido: true,
    lacunas,
  };
}

export function mesclarIntervalosContiguosOuSobrepostos(intervalos) {
  const validos = (intervalos || [])
    .map((intervalo) => ({
      ...intervalo,
      inicio: parseDateOnlySeguro(intervalo?.inicio) || intervalo?.inicio,
      fim: parseDateOnlySeguro(intervalo?.fim) || intervalo?.fim,
    }))
    .filter((intervalo) => intervalo.inicio instanceof Date && intervalo.fim instanceof Date && intervalo.fim >= intervalo.inicio)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  return validos.reduce((mesclados, intervalo) => {
    const ultimo = mesclados[mesclados.length - 1];
    if (!ultimo) return [{ ...intervalo }];

    const diaSeguinteAoUltimoFim = adicionarDias(ultimo.fim, 1);
    if (intervalo.inicio <= diaSeguinteAoUltimoFim) {
      if (intervalo.fim > ultimo.fim) ultimo.fim = intervalo.fim;
      ultimo.atestados = [...(ultimo.atestados || []), ...(intervalo.atestados || [intervalo.atestado].filter(Boolean))];
      return mesclados;
    }

    return [...mesclados, { ...intervalo }];
  }, []);
}

export function calcularMaiorSequenciaContinua(intervalos) {
  const mesclados = mesclarIntervalosContiguosOuSobrepostos(intervalos);
  return mesclados.reduce((maior, intervalo) => Math.max(maior, contarDiasInclusivos(intervalo.inicio, intervalo.fim)), 0);
}

export function calcularDiasUnicosNaJanela(intervalos, dataReferencia, diasJanela = 365) {
  const referencia = parseDateOnlySeguro(dataReferencia) || dataReferencia || new Date();
  if (!(referencia instanceof Date) || Number.isNaN(referencia.getTime())) return 0;

  const fimJanela = criarDataUtc(referencia.getUTCFullYear(), referencia.getUTCMonth() + 1, referencia.getUTCDate());
  const inicioJanela = adicionarDias(fimJanela, -(diasJanela - 1));
  const mesclados = mesclarIntervalosContiguosOuSobrepostos(intervalos);

  return mesclados.reduce((total, intervalo) => {
    const inicio = intervalo.inicio > inicioJanela ? intervalo.inicio : inicioJanela;
    const fim = intervalo.fim < fimJanela ? intervalo.fim : fimJanela;
    return total + contarDiasInclusivos(inicio, fim);
  }, 0);
}

function obterIdentificadorMilitar(atestado) {
  return atestado?.militar_id
    || atestado?.militar?.id
    || atestado?.militar_matricula_atual
    || atestado?.militar_matricula_label
    || atestado?.militar_matricula
    || atestado?.matricula
    || atestado?.militar_nome
    || 'militar_sem_identificador';
}

export function agruparAtestadosPorMilitar(atestados) {
  return (atestados || []).reduce((grupos, atestado) => {
    const chave = obterIdentificadorMilitar(atestado);
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(atestado);
    return grupos;
  }, {});
}

function obterValorNormalizado(...valores) {
  for (const valor of valores) {
    const normalizado = normalizarTexto(valor);
    if (normalizado) return normalizado;
  }
  return '';
}

function obterMilitarEscopadoPorId(militarId, militaresPorId) {
  if (!militarId || !militaresPorId) return null;

  if (militaresPorId instanceof Map) {
    return militaresPorId.get(militarId) || militaresPorId.get(String(militarId)) || null;
  }

  if (Array.isArray(militaresPorId)) {
    return militaresPorId.find((militar) => String(militar?.id || '') === String(militarId)) || null;
  }

  return militaresPorId[militarId] || militaresPorId[String(militarId)] || null;
}

function criarMapaMilitaresPorId(militaresEscopados) {
  if (militaresEscopados instanceof Map) return militaresEscopados;
  if (!Array.isArray(militaresEscopados)) return null;

  return new Map(
    militaresEscopados
      .filter((militar) => militar?.id)
      .map((militar) => [militar.id, militar]),
  );
}

function obterLotacaoMilitar(militar, atestado) {
  const lotacaoObjeto = militar?.lotacao_atual || militar?.lotacaoAtual || atestado?.militar?.lotacao_atual || atestado?.militar?.lotacaoAtual;
  return obterValorNormalizado(
    militar?.lotacao,
    militar?.unidade,
    militar?.unidade_atual,
    militar?.unidadeAtual,
    lotacaoObjeto?.nome,
    lotacaoObjeto?.sigla,
    atestado?.militar_lotacao,
    atestado?.militar_unidade,
    atestado?.lotacao,
    atestado?.unidade,
    atestado?.militar?.lotacao,
    atestado?.militar?.unidade,
  );
}

function obterEstruturaMilitar(militar, atestado) {
  return obterValorNormalizado(
    militar?.estrutura,
    militar?.estrutura_nome,
    militar?.estruturaNome,
    militar?.lotacao_atual?.estrutura,
    militar?.lotacaoAtual?.estrutura,
    atestado?.militar_estrutura,
    atestado?.estrutura,
    atestado?.militar?.estrutura,
  );
}

function montarMilitarBase(militar, atestados, { militaresPorId = null } = {}) {
  const primeiro = atestados?.[0] || {};
  const militarId = militar?.id || primeiro.militar_id || primeiro.militar?.id || null;
  const militarEscopado = obterMilitarEscopadoPorId(militarId, militaresPorId);
  const fonteMilitar = militarEscopado || militar;
  const quadroOriginal = obterValorNormalizado(fonteMilitar?.quadro, primeiro.militar_quadro, primeiro.quadro, primeiro.militar?.quadro);
  const quadroNormalizado = normalizarQuadroControleAtestados(quadroOriginal);

  return {
    id: fonteMilitar?.id || militarId,
    nome: obterValorNormalizado(fonteMilitar?.nome, primeiro.militar_nome, primeiro.militar?.nome) || 'Militar não identificado',
    postoGraduacao: obterValorNormalizado(fonteMilitar?.posto_graduacao, fonteMilitar?.postoGraduacao, fonteMilitar?.posto, primeiro.militar_posto_graduacao, primeiro.militar_posto, primeiro.posto_graduacao, primeiro.posto, primeiro.militar?.posto_graduacao, primeiro.militar?.posto) || '-',
    quadro: quadroNormalizado || '-',
    quadroOriginal: quadroOriginal || '-',
    matricula: obterValorNormalizado(fonteMilitar?.matricula, fonteMilitar?.matricula_atual, fonteMilitar?.matriculaAtual, primeiro.militar_matricula_label, primeiro.militar_matricula_atual, primeiro.militar_matricula, primeiro.matricula, primeiro.militar?.matricula) || '-',
    lotacao: obterLotacaoMilitar(fonteMilitar, primeiro) || '-',
    estrutura: obterEstruturaMilitar(fonteMilitar, primeiro) || '-',
    dadosEscopadosEncontrados: Boolean(militarEscopado),
  };
}

function classificarTemporario(quadro) {
  const quadroNormalizado = normalizarQuadroControleAtestados(quadro);
  if (!quadroNormalizado) return 'nao_classificado';
  if (isQuadroTemporario(quadroNormalizado)) return 'sim';
  if (QUADROS_NAO_TEMPORARIOS_CONHECIDOS_CONTROLE_ATESTADOS.has(quadroNormalizado)) return 'nao';
  return 'nao_classificado';
}

function classificarRiscoTemporario(maiorSequenciaContinua, diasJanela365, possuiPeriodoValido, ehTemporario) {
  if (!possuiPeriodoValido) return 'nao_classificado';
  if (!ehTemporario) return 'normal';
  if (maiorSequenciaContinua >= 30) return 'critico_continuo';
  if (diasJanela365 >= 60) return 'critico_intercalado';
  if (maiorSequenciaContinua >= 25) return 'alerta_continuo';
  if (diasJanela365 >= 50) return 'alerta_intercalado';
  if (maiorSequenciaContinua >= 20) return 'atencao_continuo';
  if (diasJanela365 >= 40) return 'atencao_intercalado';
  return 'normal';
}

function contarAtestadosVigentes(intervalos, dataReferencia) {
  const referencia = parseDateOnlySeguro(dataReferencia) || dataReferencia || new Date();
  if (!(referencia instanceof Date) || Number.isNaN(referencia.getTime())) return 0;
  return (intervalos || []).filter((intervalo) => intervalo.inicio <= referencia && intervalo.fim >= referencia).length;
}

export function avaliarRiscoAtestadosMilitar({ militar = null, atestados = [], dataReferencia = new Date(), militaresPorId = null, militaresEscopados = null } = {}) {
  const periodos = atestados.map(normalizarPeriodoAtestado);
  const mapaMilitaresPorId = militaresPorId || criarMapaMilitaresPorId(militaresEscopados);
  const primeiroAtestado = atestados?.[0] || {};
  const militarIdAtestado = primeiroAtestado.militar_id || primeiroAtestado.militar?.id || militar?.id || null;
  const lacunas = periodos.flatMap((periodo) => periodo.lacunas);
  if (militarIdAtestado && mapaMilitaresPorId && !obterMilitarEscopadoPorId(militarIdAtestado, mapaMilitaresPorId)) {
    lacunas.push('Dados completos do militar não encontrados no escopo carregado.');
  }
  const intervalosValidos = periodos
    .filter((periodo) => periodo.valido)
    .map((periodo) => ({ inicio: periodo.inicio, fim: periodo.fim, atestado: periodo.atestado, atestados: [periodo.atestado] }));
  const intervalosMesclados = mesclarIntervalosContiguosOuSobrepostos(intervalosValidos);
  const maiorSequenciaContinua = calcularMaiorSequenciaContinua(intervalosMesclados);
  const diasJanela365 = calcularDiasUnicosNaJanela(intervalosMesclados, dataReferencia, 365);
  const possuiPeriodoValido = intervalosValidos.length > 0;
  const militarBase = montarMilitarBase(militar, atestados, { militaresPorId: mapaMilitaresPorId });
  const temporarioClassificacao = classificarTemporario(militarBase.quadro === '-' ? '' : militarBase.quadro);
  const ehTemporario = temporarioClassificacao === 'sim' && isMilitarTemporarioParaControleAtestados(militarBase);
  const statusRisco = temporarioClassificacao === 'nao_classificado'
    ? 'nao_classificado'
    : classificarRiscoTemporario(maiorSequenciaContinua, diasJanela365, possuiPeriodoValido, ehTemporario);

  return {
    militar: militarBase,
    maiorSequenciaContinua,
    diasJanela365,
    quantidadeAtestadosConsiderados: intervalosValidos.length,
    quantidadeAtestadosRecebidos: atestados.length,
    quantidadeAtestadosVigentes: contarAtestadosVigentes(intervalosValidos, dataReferencia),
    temporarioClassificacao,
    ehTemporario,
    alertaLegalTemporario: ehTemporario && statusRisco !== 'normal' && statusRisco !== 'nao_classificado',
    statusRisco,
    lacunas,
    intervalos: intervalosMesclados,
  };
}
