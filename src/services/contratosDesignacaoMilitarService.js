export const STATUS_CONTRATO_DESIGNACAO = {
  ATIVO: 'ativo',
  ENCERRADO: 'encerrado',
  CANCELADO: 'cancelado',
};


export const TIPO_PRAZO_CONTRATO_DESIGNACAO = {
  INDETERMINADO: 'indeterminado',
  DETERMINADO: 'determinado',
};

export const REGRA_GERACAO_PERIODOS_DESIGNACAO = {
  NORMAL: 'normal',
  BLOQUEADA: 'bloqueada',
  MANUAL: 'manual',
};

const STATUS_ALIASES = new Map([
  ['ativo', STATUS_CONTRATO_DESIGNACAO.ATIVO],
  ['ativa', STATUS_CONTRATO_DESIGNACAO.ATIVO],
  ['active', STATUS_CONTRATO_DESIGNACAO.ATIVO],
  ['encerrado', STATUS_CONTRATO_DESIGNACAO.ENCERRADO],
  ['encerrada', STATUS_CONTRATO_DESIGNACAO.ENCERRADO],
  ['finalizado', STATUS_CONTRATO_DESIGNACAO.ENCERRADO],
  ['finalizada', STATUS_CONTRATO_DESIGNACAO.ENCERRADO],
  ['cancelado', STATUS_CONTRATO_DESIGNACAO.CANCELADO],
  ['cancelada', STATUS_CONTRATO_DESIGNACAO.CANCELADO],
  ['canceled', STATUS_CONTRATO_DESIGNACAO.CANCELADO],
  ['cancelled', STATUS_CONTRATO_DESIGNACAO.CANCELADO],
]);

const STATUS_BADGES = {
  [STATUS_CONTRATO_DESIGNACAO.ATIVO]: {
    label: 'Ativo',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  [STATUS_CONTRATO_DESIGNACAO.ENCERRADO]: {
    label: 'Encerrado',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  [STATUS_CONTRATO_DESIGNACAO.CANCELADO]: {
    label: 'Cancelado',
    className: 'bg-rose-100 text-rose-700 border-rose-200',
  },
};

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function dataTime(valor) {
  if (!valor) return 0;
  const time = new Date(`${String(valor).slice(0, 10)}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : 0;
}

function hasValor(valor) {
  return String(valor ?? '').trim().length > 0;
}

export function aplicarRegraFeriasPorTipoPrazo(payload = {}) {
  const tipoPrazoContrato = normalizarTipoPrazoContrato(payload.tipo_prazo_contrato);

  if (tipoPrazoContrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO) {
    return {
      ...payload,
      tipo_prazo_contrato: TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO,
      gera_direito_ferias: true,
      regra_geracao_periodos: REGRA_GERACAO_PERIODOS_DESIGNACAO.NORMAL,
      motivo_nao_gera_ferias: '',
    };
  }

  const geraDireitoFerias = normalizarGeraDireitoFerias(payload.gera_direito_ferias);
  const regraGeracaoPeriodos = normalizarRegraGeracaoPeriodos(payload.regra_geracao_periodos);

  return {
    ...payload,
    tipo_prazo_contrato: TIPO_PRAZO_CONTRATO_DESIGNACAO.DETERMINADO,
    gera_direito_ferias: geraDireitoFerias,
    regra_geracao_periodos: regraGeracaoPeriodos === REGRA_GERACAO_PERIODOS_DESIGNACAO.NORMAL
      ? REGRA_GERACAO_PERIODOS_DESIGNACAO.BLOQUEADA
      : regraGeracaoPeriodos,
    motivo_nao_gera_ferias: geraDireitoFerias ? '' : String(payload.motivo_nao_gera_ferias || '').trim(),
  };
}

export function normalizarTipoPrazoContrato(valor) {
  const normalizado = normalizarTexto(valor);
  if (normalizado === TIPO_PRAZO_CONTRATO_DESIGNACAO.DETERMINADO) {
    return TIPO_PRAZO_CONTRATO_DESIGNACAO.DETERMINADO;
  }
  return TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO;
}

export function normalizarGeraDireitoFerias(valor) {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === 'boolean') return valor;

  const normalizado = normalizarTexto(valor);
  if (normalizado === 'false' || normalizado === 'nao' || normalizado === 'no' || normalizado === '0') return false;
  if (normalizado === 'true' || normalizado === 'sim' || normalizado === 'yes' || normalizado === '1') return true;

  return true;
}

export function normalizarRegraGeracaoPeriodos(valor) {
  const normalizado = normalizarTexto(valor);
  if (normalizado === REGRA_GERACAO_PERIODOS_DESIGNACAO.BLOQUEADA) {
    return REGRA_GERACAO_PERIODOS_DESIGNACAO.BLOQUEADA;
  }
  if (normalizado === REGRA_GERACAO_PERIODOS_DESIGNACAO.MANUAL) {
    return REGRA_GERACAO_PERIODOS_DESIGNACAO.MANUAL;
  }
  return REGRA_GERACAO_PERIODOS_DESIGNACAO.NORMAL;
}

export function resolverConfiguracaoFeriasContrato(contrato = {}) {
  const contratoSeguro = contrato || {};
  const hasTipoPrazoContrato = Object.prototype.hasOwnProperty.call(contratoSeguro, 'tipo_prazo_contrato');
  const hasGeraDireitoFerias = Object.prototype.hasOwnProperty.call(contratoSeguro, 'gera_direito_ferias');
  const hasRegraGeracaoPeriodos = Object.prototype.hasOwnProperty.call(contratoSeguro, 'regra_geracao_periodos');

  return {
    tipoPrazoContrato: normalizarTipoPrazoContrato(contratoSeguro.tipo_prazo_contrato),
    geraDireitoFerias: normalizarGeraDireitoFerias(contratoSeguro.gera_direito_ferias),
    regraGeracaoPeriodos: normalizarRegraGeracaoPeriodos(contratoSeguro.regra_geracao_periodos),
    motivoNaoGeraFerias: String(contratoSeguro.motivo_nao_gera_ferias || ''),
    isContratoLegadoSemCamposNovos: !hasTipoPrazoContrato && !hasGeraDireitoFerias && !hasRegraGeracaoPeriodos,
  };
}

export function normalizarStatusContratoDesignacao(status) {
  const normalizado = normalizarTexto(status);
  return STATUS_ALIASES.get(normalizado) || normalizado || STATUS_CONTRATO_DESIGNACAO.ATIVO;
}

export function getContratoDesignacaoStatusBadge(status) {
  const normalizado = normalizarStatusContratoDesignacao(status);
  return STATUS_BADGES[normalizado] || {
    label: status || 'Sem status',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  };
}

export function ordenarContratosDesignacao(contratos = []) {
  return [...(Array.isArray(contratos) ? contratos : [])].sort((a, b) => {
    const diff = dataTime(b?.data_inicio_contrato) - dataTime(a?.data_inicio_contrato);
    if (diff !== 0) return diff;
    return String(b?.created_date || b?.id || '').localeCompare(String(a?.created_date || a?.id || ''));
  });
}

export function getContratoAtivoDesignacao(contratos = []) {
  return ordenarContratosDesignacao(contratos).find(
    (contrato) => normalizarStatusContratoDesignacao(contrato?.status_contrato) === STATUS_CONTRATO_DESIGNACAO.ATIVO,
  ) || null;
}

export function contarContratosAtivosDesignacao(contratos = []) {
  return (Array.isArray(contratos) ? contratos : []).filter(
    (contrato) => normalizarStatusContratoDesignacao(contrato?.status_contrato) === STATUS_CONTRATO_DESIGNACAO.ATIVO,
  ).length;
}

export function validarContratoDesignacaoPayload(payload = {}) {
  const erros = [];
  const status = normalizarStatusContratoDesignacao(payload.status_contrato);
  const tipoPrazoContrato = normalizarTipoPrazoContrato(payload.tipo_prazo_contrato);
  const geraDireitoFerias = tipoPrazoContrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO
    ? true
    : normalizarGeraDireitoFerias(payload.gera_direito_ferias);
  const regraGeracaoPeriodos = normalizarRegraGeracaoPeriodos(payload.regra_geracao_periodos);

  if (!payload.militar_id) erros.push('militar_id é obrigatório.');
  if (!String(payload.matricula_militar_id || '').trim()) erros.push('matricula_militar_id da matrícula atual é obrigatório. Cadastre a matrícula atual na ficha do militar antes de registrar o contrato.');
  if (!String(payload.matricula_designacao || '').trim()) erros.push('matricula_designacao é obrigatória.');
  if (!payload.data_inicio_contrato) erros.push('data_inicio_contrato é obrigatória.');
  if (!payload.status_contrato) erros.push('status_contrato é obrigatório.');
  if (status === STATUS_CONTRATO_DESIGNACAO.ATIVO && !payload.data_inclusao_para_ferias) {
    erros.push('data_inclusao_para_ferias é obrigatória para contrato ativo.');
  }
  if (!String(payload.numero_contrato || '').trim() && !String(payload.boletim_publicacao || '').trim()) {
    erros.push('numero_contrato ou boletim_publicacao é obrigatório.');
  }

  if (tipoPrazoContrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO) {
    if (payload.gera_direito_ferias !== undefined && normalizarGeraDireitoFerias(payload.gera_direito_ferias) !== true) {
      erros.push('Contrato indeterminado deve gerar direito a férias.');
    }
    if (payload.regra_geracao_periodos !== undefined && regraGeracaoPeriodos !== REGRA_GERACAO_PERIODOS_DESIGNACAO.NORMAL) {
      erros.push('Contrato indeterminado deve usar regra_geracao_periodos normal.');
    }
  }

  if (tipoPrazoContrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.DETERMINADO) {
    if (!payload.data_fim_contrato) {
      erros.push('data_fim_contrato é obrigatória para contrato determinado de 12 meses.');
    }
    if (regraGeracaoPeriodos === REGRA_GERACAO_PERIODOS_DESIGNACAO.NORMAL) {
      erros.push('Contrato determinado deve usar regra_geracao_periodos bloqueada ou manual.');
    }
    if (!geraDireitoFerias && !hasValor(payload.motivo_nao_gera_ferias)) {
      erros.push('motivo_nao_gera_ferias é obrigatório quando contrato determinado não gera direito a férias.');
    }
  }
  if (payload.data_inicio_contrato && payload.data_fim_contrato) {
    const inicio = dataTime(payload.data_inicio_contrato);
    const fim = dataTime(payload.data_fim_contrato);
    if (inicio && fim && fim < inicio) {
      erros.push('data_fim_contrato não pode ser anterior à data_inicio_contrato.');
    }
  }

  return { valido: erros.length === 0, erros };
}

export function formatarContratoDesignacaoResumo(contrato = {}) {
  const partes = [
    contrato.matricula_designacao ? `Matrícula ${contrato.matricula_designacao}` : null,
    contrato.data_inicio_contrato ? `início ${contrato.data_inicio_contrato}` : null,
    contrato.numero_contrato ? `contrato ${contrato.numero_contrato}` : null,
    contrato.boletim_publicacao ? `boletim ${contrato.boletim_publicacao}` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(' • ') : 'Contrato de designação sem resumo disponível';
}
