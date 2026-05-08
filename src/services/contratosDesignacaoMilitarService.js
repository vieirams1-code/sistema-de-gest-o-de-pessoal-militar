export const STATUS_CONTRATO_DESIGNACAO = {
  ATIVO: 'ativo',
  ENCERRADO: 'encerrado',
  CANCELADO: 'cancelado',
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

  if (!payload.militar_id) erros.push('militar_id é obrigatório.');
  if (!String(payload.matricula_designacao || '').trim()) erros.push('matricula_designacao é obrigatória.');
  if (!payload.data_inicio_contrato) erros.push('data_inicio_contrato é obrigatória.');
  if (!payload.status_contrato) erros.push('status_contrato é obrigatório.');
  if (status === STATUS_CONTRATO_DESIGNACAO.ATIVO && !payload.data_inclusao_para_ferias) {
    erros.push('data_inclusao_para_ferias é obrigatória para contrato ativo.');
  }
  if (!String(payload.numero_contrato || '').trim() && !String(payload.boletim_publicacao || '').trim()) {
    erros.push('numero_contrato ou boletim_publicacao é obrigatório.');
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
