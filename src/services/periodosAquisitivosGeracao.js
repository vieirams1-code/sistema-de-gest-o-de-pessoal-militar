import { addMonths, addYears, format } from 'date-fns';
import { parseDateOnlyStrict } from './dateOnlyService.js';

const MAX_ANOS_GERACAO = 120;

function normalizarData(data) {
  const normalizada = data instanceof Date ? new Date(data) : parseDateOnlyStrict(data);
  if (!normalizada) return null;
  normalizada.setHours(0, 0, 0, 0);
  return normalizada;
}

function montarPeriodo(dataInicio) {
  const inicio = new Date(dataInicio);
  const fim = addYears(inicio, 1);
  fim.setDate(fim.getDate() - 1);
  const limiteGozo = addMonths(fim, 24);

  return {
    inicio,
    fim,
    limiteGozo,
    inicio_aquisitivo: format(inicio, 'yyyy-MM-dd'),
    fim_aquisitivo: format(fim, 'yyyy-MM-dd'),
    data_limite_gozo: format(limiteGozo, 'yyyy-MM-dd'),
    ano_referencia: `${format(inicio, 'yyyy')}/${format(fim, 'yyyy')}`,
  };
}

export function montarChavePeriodoAquisitivo({ militarId, inicioAquisitivo, anoReferencia }) {
  return [
    String(militarId || '').trim(),
    String(inicioAquisitivo || '').trim(),
    String(anoReferencia || '').trim(),
  ].join('|');
}

export function periodoAquisitivoJaExiste({ periodosExistentes = [], militarId, inicioAquisitivo, anoReferencia }) {
  return (Array.isArray(periodosExistentes) ? periodosExistentes : []).some((periodo) => {
    if (String(periodo?.militar_id || '') !== String(militarId || '')) return false;

    const inicioNormalizado = normalizarData(periodo?.inicio_aquisitivo);
    const inicioExistente = inicioNormalizado ? format(inicioNormalizado, 'yyyy-MM-dd') : '';
    const referenciaExistente = String(periodo?.ano_referencia || periodo?.periodo_aquisitivo_ref || '').trim();

    return (inicioExistente && inicioExistente === inicioAquisitivo)
      || (referenciaExistente && referenciaExistente === anoReferencia);
  });
}

export function calcularPeriodosAquisitivosParaGeracao({ dataBase, hoje = new Date() } = {}) {
  const dataBaseNormalizada = normalizarData(dataBase);
  const hojeNormalizado = normalizarData(hoje);

  if (!dataBaseNormalizada || !hojeNormalizado) return [];

  const periodos = [];
  let inicioPeriodo = new Date(dataBaseNormalizada);
  let anosProcessados = 0;

  while (inicioPeriodo <= hojeNormalizado && anosProcessados < MAX_ANOS_GERACAO) {
    const periodo = montarPeriodo(inicioPeriodo);

    if (periodo.limiteGozo >= hojeNormalizado) {
      periodos.push(periodo);
    }

    inicioPeriodo = addYears(inicioPeriodo, 1);
    anosProcessados += 1;
  }

  const inicioFuturo = periodos.length > 0
    ? addYears(periodos[periodos.length - 1].inicio, 1)
    : new Date(inicioPeriodo);

  if (anosProcessados < MAX_ANOS_GERACAO) {
    periodos.push(montarPeriodo(inicioFuturo));
  }

  return periodos;
}
