import { base44 } from '@/api/base44Client';
import { DIAS_BASE_PADRAO } from './periodoSaldoUtils';

const TIPO_AJUSTE = {
  ADICAO: 'adicao',
  DESCONTO: 'desconto',
  DISPENSA_DESCONTO: 'dispensa_desconto',
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizarQuantidade(quantidade) {
  return Math.max(0, toNumber(quantidade, 0));
}

async function carregarPeriodo(periodoId) {
  const list = await base44.entities.PeriodoAquisitivo.filter({ id: periodoId });
  return list[0] || null;
}

export async function registrarAjustePeriodoAquisitivo({
  periodoId,
  tipo,
  quantidade,
  motivo,
  observacao,
  data,
  usuario,
  publicacao_id,
}) {
  const periodo = await carregarPeriodo(periodoId);
  if (!periodo) throw new Error('Período aquisitivo não encontrado para ajuste.');

  const dias_base = toNumber(periodo.dias_base, DIAS_BASE_PADRAO);
  const ajusteAtual = toNumber(periodo.dias_ajuste, 0);
  const qtd = normalizarQuantidade(quantidade);

  if (!Object.values(TIPO_AJUSTE).includes(tipo)) {
    throw new Error('Tipo de ajuste inválido.');
  }

  const sinal = tipo === TIPO_AJUSTE.ADICAO ? 1 : -1;
  const novoAjuste = ajusteAtual + (sinal * qtd);

  await base44.entities.PeriodoAquisitivo.update(periodoId, {
    dias_base,
    dias_ajuste: novoAjuste,
  });

  const trilhaPayload = {
    periodo_aquisitivo_id: periodoId,
    tipo,
    quantidade: qtd,
    motivo: motivo || null,
    observacao: observacao || null,
    data: data || new Date().toISOString().slice(0, 10),
    usuario: usuario || null,
    publicacao_id: publicacao_id || null,
  };

  // Tenta criar entidade dedicada. Se não existir no backend atual,
  // grava em fallback de observação administrativa no próprio período.
  try {
    await base44.entities.AjustePeriodoAquisitivo.create(trilhaPayload);
    return { persistedIn: 'AjustePeriodoAquisitivo', trilhaPayload };
  } catch (_) {
    const historicoExistente = Array.isArray(periodo.ajustes_admin) ? periodo.ajustes_admin : [];
    await base44.entities.PeriodoAquisitivo.update(periodoId, {
      ajustes_admin: [...historicoExistente, { id: crypto.randomUUID(), ...trilhaPayload }],
    });
    return { persistedIn: 'PeriodoAquisitivo.ajustes_admin', trilhaPayload };
  }
}

export async function aplicarAjustePositivo(payload) {
  return registrarAjustePeriodoAquisitivo({ ...payload, tipo: TIPO_AJUSTE.ADICAO });
}

export async function aplicarAjusteNegativo(payload) {
  return registrarAjustePeriodoAquisitivo({ ...payload, tipo: TIPO_AJUSTE.DESCONTO });
}

export async function prepararDispensaComDesconto(payload) {
  return registrarAjustePeriodoAquisitivo({ ...payload, tipo: TIPO_AJUSTE.DISPENSA_DESCONTO });
}
