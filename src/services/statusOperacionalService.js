export const STATUS_OPERACIONAL = {
  JISO: 'JISO',
  AFASTADO: 'AFASTADO',
  FERIAS: 'FERIAS',
  LICENCA: 'LICENCA',
  DISPONIVEL: 'DISPONIVEL',
};

const CONFIG = {
  [STATUS_OPERACIONAL.JISO]: { prioridade: 5, cor: '#8b5cf6' },
  [STATUS_OPERACIONAL.AFASTADO]: { prioridade: 4, cor: '#ef4444' },
  [STATUS_OPERACIONAL.FERIAS]: { prioridade: 3, cor: '#10b981' },
  [STATUS_OPERACIONAL.LICENCA]: { prioridade: 2, cor: '#f97316' },
  [STATUS_OPERACIONAL.DISPONIVEL]: { prioridade: 1, cor: '#3b82f6' },
};

function parseDate(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) {
    const d = new Date(dateValue);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const str = String(dateValue).split('T')[0];
  const parsed = new Date(`${str}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

export function isJisoVigente(jiso, hoje) {
  if (!jiso || !hoje) return false;
  const status = normalizeStatus(jiso.status);
  if (status === 'realizada' || status === 'cancelada') return false;

  const dataJiso = parseDate(jiso.data_jiso);
  if (!dataJiso) return false;

  return dataJiso.getTime() === hoje.getTime();
}

export function isAtestadoVigente(atestado, hoje) {
  if (!atestado || !hoje) return false;
  const status = normalizeStatus(atestado.status);
  if (status === 'cancelado' || status === 'encerrado') return false;

  const dataInicio = parseDate(atestado.data_inicio || atestado.data_atestado);
  const dataFim = parseDate(atestado.data_retorno || atestado.data_termino);

  if (!dataInicio) return false;
  if (!dataFim) return status === 'ativo' || status === 'em curso';

  return hoje >= dataInicio && hoje <= dataFim;
}

export function isFeriasVigente(ferias, hoje) {
  if (!ferias || !hoje) return false;
  const status = normalizeStatus(ferias.status);
  if (status !== 'em curso') return false;

  const dataInicio = parseDate(ferias.data_inicio);
  const dataFim = parseDate(ferias.data_retorno || ferias.data_fim);

  if (!dataInicio || !dataFim) return false;

  return hoje >= dataInicio && hoje <= dataFim;
}

export function isLicencaVigente(licenca, hoje) {
  if (!licenca || !hoje) return false;
  const status = normalizeStatus(licenca.status);
  if (['cancelado', 'encerrado', 'finalizado'].includes(status)) return false;

  const dataInicio = parseDate(licenca.data_inicio || licenca.data_registro || licenca.ltip_data_inicio);
  const dataFim = parseDate(licenca.data_retorno || licenca.data_termino || licenca.ltip_data_fim);

  if (!dataInicio) return false;
  if (!dataFim) return true; // Se não tem fim mas está ativo/em curso

  return hoje >= dataInicio && hoje <= dataFim;
}

/**
 * Determina a situação operacional atual do militar.
 *
 * @param {Object} params
 * @param {Array} params.jisos - Lista de registros de JISO
 * @param {Array} params.atestados - Lista de atestados
 * @param {Array} params.ferias - Lista de férias
 * @param {Array} params.licencas - Lista de licenças (registros de livro ou LTIP)
 * @param {Date|string} [params.hoje] - Data de referência (default: hoje)
 * @returns {Object} { status, motivo, cor, prioridade }
 */
export function determinarStatusOperacional({ jisos = [], atestados = [], ferias = [], licencas = [], hoje = new Date() } = {}) {
  const hojeRef = parseDate(hoje);
  const resultados = [];

  // Verificar JISO
  const jisoAtiva = jisos.find(j => isJisoVigente(j, hojeRef));
  if (jisoAtiva) {
    resultados.push({
      status: STATUS_OPERACIONAL.JISO,
      motivo: 'JISO Agendada',
      ...CONFIG[STATUS_OPERACIONAL.JISO]
    });
  }

  // Verificar Atestados
  const atestadoAtivo = atestados.find(a => isAtestadoVigente(a, hojeRef));
  if (atestadoAtivo) {
    resultados.push({
      status: STATUS_OPERACIONAL.AFASTADO,
      motivo: atestadoAtivo.tipo_afastamento || 'Atestado Médico',
      ...CONFIG[STATUS_OPERACIONAL.AFASTADO]
    });
  }

  // Verificar Férias
  const feriasAtiva = ferias.find(f => isFeriasVigente(f, hojeRef));
  if (feriasAtiva) {
    resultados.push({
      status: STATUS_OPERACIONAL.FERIAS,
      motivo: 'Férias',
      ...CONFIG[STATUS_OPERACIONAL.FERIAS]
    });
  }

  // Verificar Licenças
  const licencaAtiva = licencas.find(l => isLicencaVigente(l, hojeRef));
  if (licencaAtiva) {
    resultados.push({
      status: STATUS_OPERACIONAL.LICENCA,
      motivo: licencaAtiva.tipo_registro || 'Licença',
      ...CONFIG[STATUS_OPERACIONAL.LICENCA]
    });
  }

  // Se nenhum encontrado, está DISPONIVEL
  if (resultados.length === 0) {
    return {
      status: STATUS_OPERACIONAL.DISPONIVEL,
      motivo: 'Disponível',
      ...CONFIG[STATUS_OPERACIONAL.DISPONIVEL]
    };
  }

  // Selecionar o de maior prioridade
  return resultados.reduce((prev, current) => (current.prioridade > prev.prioridade ? current : prev));
}
