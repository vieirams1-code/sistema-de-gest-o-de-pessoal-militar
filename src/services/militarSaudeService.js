import { isAtestadoVigente, isJisoVigente } from './statusOperacionalService.js';
import {
  calcularDiasUnicosNaJanela,
  normalizarPeriodoAtestado,
} from './controleAtestadosTemporariosService.js';

/**
 * Consolida as informações de saúde do militar.
 *
 * @param {Array} atestados - Lista de atestados do militar.
 * @param {Array} jisos - Lista de registros de JISO do militar.
 * @param {Date|string} [hoje] - Data de referência (default: hoje).
 * @returns {Object} Consolidação de saúde.
 */
export function consolidarSaudeMilitar(atestados = [], jisos = [], hoje = new Date()) {
  const atestadosValidos = (atestados || []).filter((a) => {
    if (!a) return false;
    const status = String(a.status || '').toLowerCase();
    return status !== 'cancelado';
  });

  // Ordenar para encontrar o último (data de início mais recente)
  const atestadosOrdenados = [...atestadosValidos].sort((a, b) => {
    const dataA = new Date(a.data_inicio || a.data_atestado || 0);
    const dataB = new Date(b.data_inicio || b.data_atestado || 0);
    return dataB - dataA;
  });

  const ultimoAtestado = atestadosOrdenados[0] || null;
  const quantidadeAtestados = atestadosValidos.length;

  const afastamentoAtivo = atestadosValidos.some((a) => isAtestadoVigente(a, hoje));
  const possuiJiso = (jisos || []).some((j) => isJisoVigente(j, hoje));

  // Cálculo de dias afastados nos últimos 12 meses (365 dias)
  const periodos = atestadosValidos.map(normalizarPeriodoAtestado);
  const intervalosValidos = periodos
    .filter((p) => p.valido)
    .map((p) => ({
      inicio: p.inicio,
      fim: p.fim,
      atestado: p.atestado,
      atestados: [p.atestado],
    }));

  const diasAfastados12Meses = calcularDiasUnicosNaJanela(intervalosValidos, hoje, 365);

  let statusSaude = 'Sem restrições';
  if (afastamentoAtivo) {
    statusSaude = 'Com afastamento';
  } else if (possuiJiso) {
    statusSaude = 'JISO agendada';
  }

  return {
    quantidadeAtestados,
    ultimoAtestado,
    afastamentoAtivo,
    diasAfastados12Meses,
    possuiJiso,
    statusSaude,
  };
}
