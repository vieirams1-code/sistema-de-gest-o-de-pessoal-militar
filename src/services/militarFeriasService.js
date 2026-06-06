import { isFeriasVigente } from './statusOperacionalService.js';
import { recalcularSaldoPeriodo } from '../components/ferias/periodoSaldoUtils.js';
import { isPeriodoDisponivelOperacional } from './periodosAquisitivosOperacionais.js';

/**
 * Consolida a visão de férias do militar a partir de seus períodos aquisitivos e registros de férias.
 *
 * @param {Object} params
 * @param {Array} params.periodosAquisitivos - Lista de períodos aquisitivos do militar
 * @param {Array} params.ferias - Lista de registros de férias do militar
 * @param {Date|string} [params.hoje] - Data de referência para cálculos de vigência
 * @returns {Object} { saldoAtual, periodos, historico, situacaoAtual, proximoVencimento }
 */
export function consolidarFerias({ periodosAquisitivos = [], ferias = [], hoje = new Date() } = {}) {
  const hojeRef = hoje instanceof Date ? hoje : new Date(hoje);

  // 1. Períodos operacionais e seus saldos
  const periodosOperacionais = (periodosAquisitivos || [])
    .filter(isPeriodoDisponivelOperacional)
    .map((p) => {
      const saldo = recalcularSaldoPeriodo(p, ferias);
      return {
        ...p,
        ...saldo,
      };
    })
    .sort((a, b) => {
      const dataA = a.inicio_aquisitivo || '';
      const dataB = b.inicio_aquisitivo || '';
      return dataB.localeCompare(dataA); // Mais recentes primeiro
    });

  // 2. Saldo Total Atual (apenas períodos operacionais)
  const saldoAtual = periodosOperacionais.reduce((acc, p) => acc + (p.dias_saldo || 0), 0);

  // 3. Histórico de Férias
  const historico = [...(ferias || [])].sort((a, b) => {
    const dataA = a.data_inicio || '';
    const dataB = b.data_inicio || '';
    return dataB.localeCompare(dataA); // Mais recentes primeiro
  });

  // 4. Situação Atual
  const feriasAtiva = (ferias || []).find((f) => isFeriasVigente(f, hojeRef));
  const situacaoAtual = feriasAtiva
    ? { emGozo: true, registro: feriasAtiva }
    : { emGozo: false, registro: null };

  // 5. Próximo Vencimento
  // Menor data_limite_gozo entre períodos operacionais que ainda possuem saldo
  const periodosComSaldo = periodosOperacionais
    .filter((p) => p.dias_saldo > 0 && p.data_limite_gozo)
    .sort((a, b) => a.data_limite_gozo.localeCompare(b.data_limite_gozo));

  const proximoVencimento = periodosComSaldo.length > 0
    ? periodosComSaldo[0].data_limite_gozo
    : null;

  return {
    saldoAtual,
    periodos: periodosOperacionais,
    historico,
    situacaoAtual,
    proximoVencimento,
  };
}
