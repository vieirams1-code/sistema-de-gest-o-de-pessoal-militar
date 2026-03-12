import { base44 } from '@/api/base44Client';
import { DIAS_BASE_PADRAO } from './periodoSaldoUtils';
import { sincronizarPeriodoAquisitivoDaFerias } from './feriasService';
import { validarDispensaComDescontoFerias } from './feriasRules';

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

  await sincronizarPeriodoAquisitivoDaFerias({
    periodoAquisitivoId: periodoId,
    militarId: periodo.militar_id,
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

export async function aplicarAjusteNegativo(payload) {
  return registrarAjustePeriodoAquisitivo({ ...payload, tipo: TIPO_AJUSTE.DESCONTO });
}

function montarTextoPublicacaoDispensa({ militarLabel, periodoReferencia, quantidade, motivo, observacao, data }) {
  const partesMotivo = [];

  if (motivo) partesMotivo.push(`motivo: ${motivo}`);
  if (observacao) partesMotivo.push(`observação: ${observacao}`);

  const complemento = partesMotivo.length ? ` (${partesMotivo.join(' | ')})` : '';

  return `Dispensa com desconto em férias de ${militarLabel}, referente ao período aquisitivo ${periodoReferencia}. Fica formalizado o desconto de ${quantidade} dia(s), em ${data}.${complemento}`;
}

export async function registrarDispensaComDescontoFerias({
  periodoId,
  quantidade,
  motivo,
  observacao,
  usuario,
  data,
}) {
  const periodo = await carregarPeriodo(periodoId);
  if (!periodo) throw new Error('Período aquisitivo não encontrado.');

  await sincronizarPeriodoAquisitivoDaFerias({
    periodoAquisitivoId: periodoId,
    militarId: periodo.militar_id,
  });

  const periodoSincronizado = await carregarPeriodo(periodoId);
  if (!periodoSincronizado) throw new Error('Período aquisitivo não encontrado após sincronização.');

  const validacao = validarDispensaComDescontoFerias({ periodo: periodoSincronizado, quantidade });
  if (!validacao.ok) {
    throw new Error(validacao.mensagem || 'Dispensa com desconto inválida para o período selecionado.');
  }

  const dataEvento = data || new Date().toISOString().slice(0, 10);
  const militarLabel = `${periodoSincronizado.militar_posto || ''} ${periodoSincronizado.militar_nome_guerra || periodoSincronizado.militar_nome || ''}`.trim() || 'Militar';
  const periodoReferencia = periodoSincronizado.ano_referencia || periodoSincronizado.referencia || `${periodoSincronizado.inicio_aquisitivo || '-'} / ${periodoSincronizado.fim_aquisitivo || '-'}`;

  const textoPublicacao = montarTextoPublicacaoDispensa({
    militarLabel,
    periodoReferencia,
    quantidade: Number(quantidade),
    motivo,
    observacao,
    data: dataEvento,
  });

  const observacoesRegistro = [
    motivo ? `Motivo: ${motivo}` : null,
    observacao || null,
  ].filter(Boolean).join(' | ');

  const registroAto = await base44.entities.RegistroLivro.create({
    militar_id: periodoSincronizado.militar_id,
    militar_nome: periodoSincronizado.militar_nome || periodoSincronizado.militar_nome_guerra || null,
    militar_posto: periodoSincronizado.militar_posto || null,
    militar_matricula: periodoSincronizado.militar_matricula || null,
    periodo_aquisitivo: periodoReferencia,
    tipo_registro: 'Dispensa com Desconto em Férias',
    data_registro: dataEvento,
    dias: Number(quantidade),
    status: 'Aguardando Nota',
    observacoes: observacoesRegistro || '',
    texto_publicacao: textoPublicacao,
    nota_para_bg: '',
    numero_bg: '',
    data_bg: '',
  });

  let ajuste;
  try {
    ajuste = await registrarAjustePeriodoAquisitivo({
      periodoId,
      tipo: TIPO_AJUSTE.DISPENSA_DESCONTO,
      quantidade,
      motivo,
      observacao,
      data: dataEvento,
      usuario,
      publicacao_id: registroAto?.id || null,
    });
  } catch (error) {
    try {
      if (registroAto?.id) {
        await base44.entities.RegistroLivro.delete(registroAto.id);
      }
    } catch {
      // noop
    }
    throw error;
  }

  return {
    periodo: periodoSincronizado,
    registroAto,
    ajuste,
    textoPublicacao,
    validacao,
  };
}

export async function prepararDispensaComDesconto(payload) {
  return registrarAjustePeriodoAquisitivo({ ...payload, tipo: TIPO_AJUSTE.DISPENSA_DESCONTO });
}
