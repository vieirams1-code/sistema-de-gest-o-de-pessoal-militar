const STATUS_FINALIZADOS = new Set(['ENCERRADO', 'EXTINTO']);
const STATUS_ATIVOS_OPERACIONAIS = new Set(['VIGENTE', 'A_VENCER', 'EM_RENOVACAO', 'AGUARDANDO_PUBLICACAO']);

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

  if (STATUS_FINALIZADOS.has(statusAtual)) return statusAtual;
  if (statusAtual === 'AGUARDANDO_PUBLICACAO') return 'AGUARDANDO_PUBLICACAO';
  if (statusAtual === 'EM_RENOVACAO') return 'EM_RENOVACAO';

  const dataInicio = toDateOnly(contrato.data_inicio);
  const dataFim = toDateOnly(contrato.data_fim_efetiva || contrato.data_fim_prevista);

  if (!dataInicio) return 'RASCUNHO';
  if (today < dataInicio) return 'RASCUNHO';
  if (!dataFim) return 'VIGENTE';
  if (today > dataFim) return 'EXPIRADO';

  const diasRestantes = diffDays(dataFim, today);
  if (diasRestantes <= 30) return 'A_VENCER';

  return 'VIGENTE';
}

export function isContratoAtivoOperacional(contrato, todayInput = new Date()) {
  const status = calcularStatusContratoTemporario(contrato, todayInput);
  return STATUS_ATIVOS_OPERACIONAIS.has(status);
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
      message: 'Já existe contrato operacional ativo e sobreposto para este militar.',
      conflictingId: item.id,
    };
  }

  return { ok: true };
}

export function encerrarOuExtinguirContrato(contrato, { dataEfetiva, motivo, tipo = 'ENCERRADO' }) {
  const tipoFinal = tipo === 'EXTINTO' ? 'EXTINTO' : 'ENCERRADO';
  return {
    ...contrato,
    status: tipoFinal,
    data_fim_efetiva: toIsoDay(dataEfetiva),
    motivo_encerramento: motivo || contrato?.motivo_encerramento || '',
  };
}

export function prepararRenovacaoContrato(contratoAnterior, payloadNovoContrato) {
  const raizId = contratoAnterior?.contrato_raiz_id || contratoAnterior?.id || null;
  return {
    ...payloadNovoContrato,
    contrato_anterior_id: contratoAnterior?.id || null,
    contrato_raiz_id: raizId,
    origem_registro: 'RENOVACAO',
    status: payloadNovoContrato?.status || 'RASCUNHO',
  };
}

export function calcularSituacaoVinculoTemporario(contratoVigente) {
  if (!contratoVigente) return 'SEM_VIGENTE';
  const status = calcularStatusContratoTemporario(contratoVigente);
  if (status === 'A_VENCER') return 'A_VENCER';
  if (status === 'EXPIRADO') return 'EXPIRADO';
  return 'REGULAR';
}

export function resumirIndicadoresContratosTemporarios(contratos = [], todayInput = new Date()) {
  const today = toDateOnly(todayInput) || new Date();
  const total = { aVencer60: 0, aVencer30: 0, expirados: 0, aguardandoPublicacao: 0 };

  contratos.forEach((contrato) => {
    const status = calcularStatusContratoTemporario(contrato, today);
    if (status === 'EXPIRADO') total.expirados += 1;
    if (status === 'AGUARDANDO_PUBLICACAO') total.aguardandoPublicacao += 1;

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
