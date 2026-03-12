import { differenceInCalendarDays } from 'date-fns';
import {
  obterDiasBase,
  obterDiasAjuste,
  calcularDiasTotal,
  calcularDiasGozados,
  calcularDiasPrevistos,
  calcularDiasSaldo,
} from './periodoSaldoService';

const STARTED_STATUSES = new Set(['Em Curso', 'Gozada', 'Interrompida']);

function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00`);
}

export function getFracaoNumero(fracionamento) {
  if (!fracionamento) return 1;
  if (String(fracionamento).includes('2ª')) return 2;
  if (String(fracionamento).includes('3ª')) return 3;
  return 1;
}

function sortByFracao(a, b) {
  return getFracaoNumero(a?.fracionamento) - getFracaoNumero(b?.fracionamento);
}

export function isFeriasIniciada(ferias) {
  if (!ferias) return false;
  return STARTED_STATUSES.has(ferias.status);
}

export function validarOrdemFracoesCadastro({
  militarId,
  periodoRef,
  fracoes = [],
  feriasExistentes = [],
  editFerias = null,
  editId = null,
}) {
  if (!militarId || !periodoRef) return null;

  const doMesmoPeriodo = (feriasExistentes || [])
    .filter(
      (item) =>
        item &&
        item.id !== editId &&
        item.militar_id === militarId &&
        item.periodo_aquisitivo_ref === periodoRef
    )
    .sort(sortByFracao);

  const currentFracao = getFracaoNumero(editFerias?.fracionamento);

  if (editFerias?.id && fracoes.length === 1) {
    const dataAtual = fracoes[0]?.data_inicio;
    if (!dataAtual) return null;

    const anterior = doMesmoPeriodo.find((item) => getFracaoNumero(item.fracionamento) === currentFracao - 1);
    const proxima = doMesmoPeriodo.find((item) => getFracaoNumero(item.fracionamento) === currentFracao + 1);

    if (currentFracao > 1 && !anterior) {
      return `A ${currentFracao}ª fração só pode ser cadastrada após a ${currentFracao - 1}ª fração.`;
    }

    if (anterior?.data_inicio && dataAtual < anterior.data_inicio) {
      return `A ${currentFracao}ª fração não pode iniciar antes da ${currentFracao - 1}ª (${anterior.data_inicio}).`;
    }

    if (proxima?.data_inicio && dataAtual > proxima.data_inicio) {
      return `A ${currentFracao}ª fração não pode iniciar após a ${currentFracao + 1}ª (${proxima.data_inicio}).`;
    }

    return null;
  }

  for (let i = 1; i < fracoes.length; i += 1) {
    const anterior = fracoes[i - 1]?.data_inicio;
    const atual = fracoes[i]?.data_inicio;

    if (anterior && atual && atual < anterior) {
      return `A ${i + 1}ª fração não pode iniciar antes da ${i}ª fração.`;
    }
  }

  return null;
}

export function validarInicioFracaoNoLivro({
  feriasAtual,
  todasFeriasDoMilitar = [],
  dataRegistro,
}) {
  if (!feriasAtual || !dataRegistro) return null;

  const numeroFracao = getFracaoNumero(feriasAtual.fracionamento);
  if (numeroFracao <= 1) return null;

  const todasFerias = todasFeriasDoMilitar || [];

  const anterior = todasFerias
    .find(
      (item) =>
        item &&
        item.id !== feriasAtual.id &&
        item.militar_id === feriasAtual.militar_id &&
        item.periodo_aquisitivo_ref === feriasAtual.periodo_aquisitivo_ref &&
        getFracaoNumero(item.fracionamento) === numeroFracao - 1
    );

  if (!anterior) {
    return `Não foi localizada a ${numeroFracao - 1}ª fração deste período aquisitivo.`;
  }

  if (!isFeriasIniciada(anterior)) {
    return `A ${numeroFracao}ª fração só pode iniciar após o início da ${numeroFracao - 1}ª fração.`;
  }

  if (anterior.data_inicio && dataRegistro < anterior.data_inicio) {
    return `A ${numeroFracao}ª fração não pode iniciar antes da ${numeroFracao - 1}ª (${anterior.data_inicio}).`;
  }

  return null;
}

export function validarInicioNoPeriodoConcessivo(dataInicio, dataLimiteGozo) {
  if (!dataInicio || !dataLimiteGozo) return null;
  if (dataInicio > dataLimiteGozo) {
    return `A data de início ${dataInicio} está após o limite de gozo (${dataLimiteGozo}).`;
  }
  return null;
}

export function getAlertaPeriodoConcessivo({ dataLimiteGozo, hasPrevisaoValida }) {
  if (!dataLimiteGozo || hasPrevisaoValida) return null;

  const diasRestantes = differenceInCalendarDays(parseDateOnly(dataLimiteGozo), new Date());

  if (diasRestantes <= 90) {
    return { nivel: 'critico', diasRestantes };
  }

  if (diasRestantes <= 150) {
    return { nivel: 'atencao', diasRestantes };
  }

  return null;
}

export function hasPrevisaoValidaPeriodo(periodo) {
  if (!periodo) return false;

  const diasPrevistos = Number(periodo.dias_previstos || 0);
  const diasGozados = Number(periodo.dias_gozados || 0);

  if (diasPrevistos > 0 || diasGozados > 0) return true;

  return ['Previsto', 'Parcialmente Gozado', 'Gozado'].includes(periodo.status);
}

export {
  obterDiasBase,
  obterDiasAjuste,
  calcularDiasTotal,
  calcularDiasGozados,
  calcularDiasPrevistos,
  calcularDiasSaldo,
};
