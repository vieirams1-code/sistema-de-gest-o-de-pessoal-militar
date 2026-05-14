import { base44 } from '@/api/base44Client';
import { recalcularSaldoPeriodo } from './periodoSaldoUtils';
import { atualizarEscopado } from '@/services/cudEscopadoClient';

// Executa uma chamada SDK com retry exponencial em caso de rate limit (429).
// Evita falha de UX quando o submit de férias gera várias chamadas concorrentes.
async function withRateLimitRetry(fn, { maxAttempts = 5, baseDelayMs = 600 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      const msg = String(err?.message || '');
      const isRateLimit = msg.includes('Rate limit') || err?.status === 429 || err?.response?.status === 429;
      if (!isRateLimit) throw err;
      lastError = err;
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

function parseDateOnly(date) {
  if (!date) return null;
  return new Date(`${date}T00:00:00`);
}

function isPeriodoVencido(periodo) {
  if (!periodo?.data_limite_gozo) return false;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const limite = parseDateOnly(periodo.data_limite_gozo);
  if (!limite) return false;

  return limite < hoje;
}

export function calcularStatusPeriodoAquisitivo({ periodo = {}, dias_previstos = 0, dias_gozados = 0, dias_saldo = 0 }) {
  if (periodo?.inativo || periodo?.status === 'Inativo') return 'Inativo';

  if (dias_previstos > 0 && dias_gozados <= 0) return 'Previsto';

  if (dias_saldo <= 0) return 'Gozado';

  if (dias_gozados > 0 && dias_saldo > 0) return 'Parcialmente Gozado';

  if (dias_gozados <= 0 && dias_previstos <= 0) {
    if (periodo?.status === 'Vencido' || isPeriodoVencido(periodo)) {
      return 'Vencido';
    }
    return 'Disponível';
  }

  return periodo?.status || 'Disponível';
}

export function montarPayloadRecalculoPeriodo(periodo = {}, ferias = []) {
  const saldo = recalcularSaldoPeriodo(periodo, ferias);
  const status = calcularStatusPeriodoAquisitivo({
    periodo,
    dias_previstos: saldo.dias_previstos,
    dias_gozados: saldo.dias_gozados,
    dias_saldo: saldo.dias_saldo,
  });

  return {
    ...saldo,
    status,
  };
}

async function carregarPeriodosRelacionados({ periodoId, periodoRef, militarId }) {
  if (periodoId) {
    const periodos = await withRateLimitRetry(() => base44.entities.PeriodoAquisitivo.filter({ id: periodoId }));
    return periodos.filter(Boolean);
  }

  if (periodoRef && militarId) {
    const periodos = await withRateLimitRetry(() => base44.entities.PeriodoAquisitivo.filter({
      militar_id: militarId,
      ano_referencia: periodoRef,
    }));
    return periodos.filter(Boolean);
  }

  return [];
}

export async function recalcularPeriodoAquisitivoVinculado({ periodoId = null, periodoRef = null, militarId = null }) {
  const periodos = await carregarPeriodosRelacionados({ periodoId, periodoRef, militarId });

  if (!periodos.length) return [];

  const militarAlvo = militarId || periodos[0]?.militar_id;
  const todasFerias = militarAlvo
    ? await withRateLimitRetry(() => base44.entities.Ferias.filter({ militar_id: militarAlvo }))
    : await withRateLimitRetry(() => base44.entities.Ferias.list());

  const atualizacoes = [];

  for (const periodo of periodos) {
    const payload = montarPayloadRecalculoPeriodo(periodo, todasFerias);
    await atualizarEscopado('PeriodoAquisitivo', periodo.id, payload);
    atualizacoes.push({ periodoId: periodo.id, payload });
  }

  return atualizacoes;
}