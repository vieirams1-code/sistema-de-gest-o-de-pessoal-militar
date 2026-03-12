import { base44 } from '@/api/base44Client';
import { DIAS_BASE_PADRAO } from './periodoSaldoUtils';
import { filtrarFeriasDoPeriodo, validarAjusteDiasPeriodo } from './periodoSaldoUtils';
import { calcularStatusPeriodoAquisitivo } from './recalcularPeriodoAquisitivo';

const TIPO_AJUSTE = {
  ADICAO: 'adicao',
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

async function carregarFeriasDoMilitar(militarId) {
  if (!militarId) return [];

  return base44.entities.Ferias.filter({ militar_id: militarId });
}

async function criarPublicacaoDispensaComDesconto({ periodo, quantidade, motivo, observacao, data }) {
  const dataPublicacao = data || new Date().toISOString().slice(0, 10);
  const referencia = periodo.ano_referencia || periodo.referencia || 'Sem referência';
  const nomeMilitar =
    periodo.militar_nome_guerra ||
    periodo.militar_nome ||
    periodo.nome_guerra ||
    periodo.militar_nome_completo ||
    'Militar não identificado';

  const texto_publicacao = [
    `Dispensa com Desconto em Férias do(a) ${nomeMilitar}.`,
    `Período aquisitivo de referência: ${referencia}.`,
    `Quantidade descontada: ${quantidade} dia(s).`,
    `Motivo: ${motivo}.`,
    observacao ? `Observação: ${observacao}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const publicacao = await base44.entities.PublicacaoExOfficio.create({
    militar_id: periodo.militar_id || '',
    militar_nome: periodo.militar_nome || periodo.militar_nome_completo || nomeMilitar,
    militar_posto: periodo.militar_posto || '',
    militar_matricula: periodo.militar_matricula || '',
    tipo: 'Dispensa com Desconto em Férias',
    data_publicacao: dataPublicacao,
    texto_publicacao,
    observacoes: observacao || '',
    status: 'Aguardando Nota',
  });

  return publicacao;
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

  const feriasMilitar = await carregarFeriasDoMilitar(periodo.militar_id);
  const feriasRelacionadas = filtrarFeriasDoPeriodo(periodo, feriasMilitar);
  const validacao = validarAjusteDiasPeriodo({
    periodo,
    ferias: feriasRelacionadas,
    tipo,
    quantidade: qtd,
  });

  if (!validacao.ok) {
    throw new Error(validacao.mensagem || 'Não foi possível aplicar o ajuste neste período.');
  }

  const payloadAtualizacao = {
    dias_base,
    dias_ajuste: novoAjuste,
    dias_total: validacao.dias_total_projetado,
    dias_gozados: validacao.dias_gozados,
    dias_previstos: validacao.dias_previstos,
    dias_saldo: validacao.dias_saldo_projetado,
  };

  payloadAtualizacao.status = calcularStatusPeriodoAquisitivo({
    periodo,
    dias_previstos: payloadAtualizacao.dias_previstos,
    dias_gozados: payloadAtualizacao.dias_gozados,
    dias_saldo: payloadAtualizacao.dias_saldo,
  });

  await base44.entities.PeriodoAquisitivo.update(periodoId, payloadAtualizacao);

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

  try {
    await base44.entities.AjustePeriodoAquisitivo.create(trilhaPayload);
    return { persistedIn: 'AjustePeriodoAquisitivo', trilhaPayload };
  } catch {
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

export async function prepararDispensaComDesconto(payload) {
  const periodo = await carregarPeriodo(payload?.periodoId);
  if (!periodo) throw new Error('Período aquisitivo não encontrado para dispensa com desconto.');

  const publicacao = await criarPublicacaoDispensaComDesconto({
    periodo,
    quantidade: payload.quantidade,
    motivo: payload.motivo,
    observacao: payload.observacao,
    data: payload.data,
  });

  return registrarAjustePeriodoAquisitivo({
    ...payload,
    tipo: TIPO_AJUSTE.DISPENSA_DESCONTO,
    publicacao_id: publicacao?.id || null,
  });
}
