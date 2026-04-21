const STATUS_ENCERRADO = 'ENCERRADO';

const toDateOnly = (value) => {
  if (!value) return null;
  const iso = String(value).slice(0, 10);
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toIsoDay = (value) => {
  const date = toDateOnly(value);
  return date ? date.toISOString().slice(0, 10) : '';
};

const diffDays = (end, start) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay);
};

export function calcularStatusContratoTemporario(contrato, todayInput = new Date()) {
  if (!contrato) return 'EXPIRADO';

  const statusAtual = String(contrato.status || '').toUpperCase();
  if (statusAtual === STATUS_ENCERRADO) return STATUS_ENCERRADO;

  const today = toDateOnly(todayInput) || new Date();
  const dataFim = toDateOnly(contrato.data_fim_atual || contrato.data_fim_prevista || contrato.data_fim_efetiva);

  if (!dataFim) return 'VIGENTE';

  const diasRestantes = diffDays(dataFim, today);
  if (diasRestantes < 0) return 'EXPIRADO';
  if (diasRestantes <= 30) return 'A_VENCER';
  return 'VIGENTE';
}

export function validarContratoAtivoUnico({ contrato, contratosExistentes = [], today = new Date() }) {
  if (!contrato?.militar_id) return { ok: true };

  const conflito = contratosExistentes.find((item) => {
    if (!item || item.id === contrato.id || item.militar_id !== contrato.militar_id) return false;
    const status = calcularStatusContratoTemporario(item, today);
    return status === 'VIGENTE' || status === 'A_VENCER';
  });

  if (!conflito) return { ok: true };

  return {
    ok: false,
    code: 'CONTRATO_ATIVO_EXISTENTE',
    message: 'Já existe contrato ativo para este militar.',
    conflictingId: conflito.id,
  };
}

export function aplicarRenovacaoContrato(contrato, { dataRegistro, boletim, detalhes, novaDataFim }) {
  const dataFimAnterior = toIsoDay(contrato?.data_fim_atual || contrato?.data_fim_prevista);
  const dataFimNova = toIsoDay(novaDataFim);

  return {
    contratoAtualizado: {
      ...contrato,
      data_fim_atual: dataFimNova,
      status: calcularStatusContratoTemporario({ ...contrato, data_fim_atual: dataFimNova }),
    },
    historico: {
      tipo_registro: 'RENOVACAO',
      data_registro: toIsoDay(dataRegistro) || toIsoDay(new Date()),
      boletim: boletim || '',
      detalhes: detalhes || '',
      data_fim_anterior: dataFimAnterior,
      data_fim_nova: dataFimNova,
    },
  };
}

export function criarHistoricoContrato({ tipoRegistro, dataRegistro, boletim, detalhes, dataFimAnterior, dataFimNova }) {
  return {
    tipo_registro: tipoRegistro,
    data_registro: toIsoDay(dataRegistro) || toIsoDay(new Date()),
    boletim: boletim || '',
    detalhes: detalhes || '',
    data_fim_anterior: toIsoDay(dataFimAnterior),
    data_fim_nova: toIsoDay(dataFimNova),
  };
}

export function encerrarContratoTemporario(contrato, { dataRegistro, boletim, detalhes }) {
  const dataFimAtual = toIsoDay(contrato?.data_fim_atual || contrato?.data_fim_prevista);
  return {
    contratoAtualizado: {
      ...contrato,
      status: STATUS_ENCERRADO,
    },
    historico: {
      tipo_registro: 'ENCERRAMENTO',
      data_registro: toIsoDay(dataRegistro) || toIsoDay(new Date()),
      boletim: boletim || '',
      detalhes: detalhes || '',
      data_fim_anterior: dataFimAtual,
      data_fim_nova: dataFimAtual,
    },
  };
}

export function obterUltimoBoletim(historicos = []) {
  const registro = [...historicos]
    .filter((item) => item?.boletim)
    .sort((a, b) => String(b.data_registro || '').localeCompare(String(a.data_registro || '')))[0];
  return registro?.boletim || '';
}

export function montarCardsContratosTemporarios({ contratos = [], militares = [], historicos = [], today = new Date() }) {
  const militarLookup = new Map(militares.map((m) => [m.id, m]));
  const historicosPorContrato = historicos.reduce((acc, item) => {
    const key = item.contrato_temporario_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return contratos.map((contrato) => {
    const militar = militarLookup.get(contrato.militar_id);
    const historicoContrato = historicosPorContrato[contrato.id] || [];
    return {
      ...contrato,
      militar_nome: militar?.nome_completo || 'Militar não encontrado',
      militar_matricula: militar?.matricula_atual || militar?.matricula || '-',
      status_calculado: calcularStatusContratoTemporario(contrato, today),
      ultimo_boletim: obterUltimoBoletim(historicoContrato),
      historico: historicoContrato.sort((a, b) => String(b.data_registro || '').localeCompare(String(a.data_registro || ''))),
    };
  });
}
