const STATUS_FINALIZADOS = new Set(['ENCERRADO', 'EXTINTO', 'RENOVADO']);
const STATUS_ATIVOS_OPERACIONAIS = new Set(['RASCUNHO', 'VIGENTE']);

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
  if (!contrato) return 'RASCUNHO';

  const today = toDateOnly(todayInput) || new Date();
  const statusAtual = String(contrato.status || '').toUpperCase();

  if (statusAtual === 'RENOVADO') return 'RENOVADO';
  if (statusAtual === 'ENCERRADO' || statusAtual === 'EXTINTO') return 'ENCERRADO';

  const dataInicio = toDateOnly(contrato.data_inicio);
  if (!dataInicio || today < dataInicio) return 'RASCUNHO';

  const dataFim = toDateOnly(contrato.data_fim_efetiva || contrato.data_fim_prevista);
  if (!dataFim) return 'VIGENTE';

  if (today > dataFim) {
    return statusAtual === 'RENOVADO' ? 'RENOVADO' : 'VIGENTE';
  }

  return 'VIGENTE';
}

export function calcularBadgeVigenciaContrato(contrato, todayInput = new Date(), janelaDias = 30) {
  if (!contrato) return null;
  const statusBase = calcularStatusContratoTemporario(contrato, todayInput);
  if (statusBase !== 'VIGENTE') return null;

  const today = toDateOnly(todayInput) || new Date();
  const dataFim = toDateOnly(contrato.data_fim_efetiva || contrato.data_fim_prevista);
  if (!dataFim) return null;

  const diasRestantes = diffDays(dataFim, today);
  if (diasRestantes < 0) return 'EXPIRADO';
  if (diasRestantes <= janelaDias) return 'A_VENCER';
  return null;
}

export function isContratoAtivoOperacional(contrato, todayInput = new Date()) {
  const status = calcularStatusContratoTemporario(contrato, todayInput);
  if (!STATUS_ATIVOS_OPERACIONAIS.has(status)) return false;
  return calcularBadgeVigenciaContrato(contrato, todayInput) !== 'EXPIRADO';
}

function faixaContrato(contrato) {
  const inicio = toDateOnly(contrato?.data_inicio);
  const fim = toDateOnly(contrato?.data_fim_efetiva || contrato?.data_fim_prevista);
  return { inicio, fim };
}

function existeSobreposicaoFaixas(atual, outro) {
  if (!atual.inicio || !outro.inicio) return false;

  const fimAtual = atual.fim || new Date('2999-12-31T00:00:00Z');
  const fimOutro = outro.fim || new Date('2999-12-31T00:00:00Z');

  return atual.inicio <= fimOutro && outro.inicio <= fimAtual;
}

export function validarSobreposicaoContrato({ contrato, contratosExistentes = [], today = new Date() }) {
  if (!contrato?.militar_id) return { ok: true };

  const candidatos = contratosExistentes.filter((item) => item?.militar_id === contrato.militar_id && item.id !== contrato.id);
  const faixaNovo = faixaContrato(contrato);

  for (const item of candidatos) {
    if (!isContratoAtivoOperacional(item, today)) continue;
    const faixaExistente = faixaContrato(item);
    if (!existeSobreposicaoFaixas(faixaNovo, faixaExistente)) continue;
    return {
      ok: false,
      code: 'CONTRATO_SOBREPOSTO',
      message: 'Já existe contrato ativo e sobreposto para este militar.',
      conflictingId: item.id,
    };
  }

  return { ok: true };
}

export function encerrarOuExtinguirContrato(contrato, { dataEfetiva, motivo }) {
  return {
    ...contrato,
    status: 'ENCERRADO',
    data_fim_efetiva: toIsoDay(dataEfetiva),
    motivo_encerramento: motivo || contrato?.motivo_encerramento || '',
  };
}

export function prepararRenovacaoContrato(contratoAnterior, payloadNovoContrato, contratosExistentes = []) {
  const possuiFilho = contratosExistentes.some((item) => item?.contrato_anterior_id === contratoAnterior?.id);
  if (possuiFilho) {
    return {
      ok: false,
      code: 'RENOVACAO_DUPLICADA',
      message: 'Este contrato já possui uma renovação vinculada.',
    };
  }

  const raizId = contratoAnterior?.contrato_raiz_id || contratoAnterior?.id || null;

  return {
    ok: true,
    novoContrato: {
      ...payloadNovoContrato,
      contrato_anterior_id: contratoAnterior?.id || null,
      contrato_raiz_id: raizId,
      status: 'RASCUNHO',
      origem_registro: payloadNovoContrato?.origem_registro || 'RENOVACAO_INTERNA',
    },
    contratoAnteriorAtualizado: {
      ...contratoAnterior,
      status: 'RENOVADO',
      contrato_raiz_id: raizId,
    },
  };
}

const contratoSortTs = (contrato) => toDateOnly(contrato?.data_inicio)?.getTime() || 0;

export function obterIdCadeiaContrato(contrato) {
  return contrato?.contrato_raiz_id || contrato?.id || null;
}

export function listarContratosAtuais(contratos = []) {
  const mapa = new Map();
  contratos.forEach((contrato) => {
    const chainId = obterIdCadeiaContrato(contrato);
    const atual = mapa.get(chainId);
    if (!atual || contratoSortTs(contrato) > contratoSortTs(atual)) {
      mapa.set(chainId, contrato);
    }
  });
  return Array.from(mapa.values()).sort((a, b) => contratoSortTs(b) - contratoSortTs(a));
}

export function listarHistoricoCadeia(contratos = [], contratoAtual = null) {
  if (!contratoAtual) return [];
  const chainId = obterIdCadeiaContrato(contratoAtual);
  return contratos
    .filter((item) => obterIdCadeiaContrato(item) === chainId && item.id !== contratoAtual.id)
    .sort((a, b) => contratoSortTs(b) - contratoSortTs(a));
}

export function calcularSituacaoVinculoTemporario(contratoVigente) {
  if (!contratoVigente) return 'SEM_VIGENTE';
  const badge = calcularBadgeVigenciaContrato(contratoVigente);
  if (badge === 'A_VENCER') return 'A_VENCER';
  if (badge === 'EXPIRADO') return 'EXPIRADO';
  return 'REGULAR';
}

export function resumirIndicadoresContratosTemporarios(contratos = [], todayInput = new Date()) {
  const today = toDateOnly(todayInput) || new Date();
  const total = { aVencer60: 0, aVencer30: 0, expirados: 0, aguardandoPublicacao: 0 };

  contratos.forEach((contrato) => {
    const badge = calcularBadgeVigenciaContrato(contrato, today, 60);
    if (badge === 'EXPIRADO') total.expirados += 1;

    const fim = toDateOnly(contrato?.data_fim_efetiva || contrato?.data_fim_prevista);
    if (!fim) return;
    const dias = diffDays(fim, today);
    if (dias >= 0 && dias <= 60) total.aVencer60 += 1;
    if (dias >= 0 && dias <= 30) total.aVencer30 += 1;
  });

  return total;
}

export const VinculoTemporarioConstants = {
  STATUS_ATIVOS_OPERACIONAIS,
  STATUS_FINALIZADOS,
};
