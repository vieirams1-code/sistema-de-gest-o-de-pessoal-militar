import { base44 } from '@/api/base44Client';
import {
  DIAS_BASE_PADRAO,
  filtrarFeriasDoPeriodo,
  obterDiasBase,
  calcularDiasGozados,
  calcularDiasPrevistos,
} from './periodoSaldoUtils';
import { calcularStatusPeriodoAquisitivo } from './recalcularPeriodoAquisitivo';

const TIPO_AJUSTE = {
  ADICAO: 'adicao',
  DISPENSA_DESCONTO: 'dispensa_desconto',
};

const STATUS_AJUSTE = {
  ATIVO: 'ativo',
  INVALIDADO: 'invalidado',
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizarQuantidade(quantidade) {
  return Math.max(0, toNumber(quantidade, 0));
}

function getDateOnly(value) {
  if (typeof value === 'string' && value) return value.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function getAdjustmentSignal(tipo) {
  return tipo === TIPO_AJUSTE.ADICAO ? 1 : -1;
}

function isAdjustmentActive(ajuste = {}) {
  if (!ajuste) return false;
  if (ajuste.status === STATUS_AJUSTE.INVALIDADO) return false;
  if (ajuste.ativo === false) return false;
  return true;
}

function appendObservacao(baseText, extraText) {
  const base = String(baseText || '').trim();
  const extra = String(extraText || '').trim();
  if (!extra) return base;
  if (!base) return extra;
  if (base.includes(extra)) return base;
  return `${base}
${extra}`.trim();
}

function buildPeriodoReferencia(periodo = {}) {
  return (
    periodo?.ano_referencia ||
    periodo?.referencia ||
    periodo?.periodo_aquisitivo_ref ||
    'Sem referência'
  );
}

function buildNomeMilitar(periodo = {}) {
  return (
    periodo?.militar_nome_guerra ||
    periodo?.militar_nome ||
    periodo?.nome_guerra ||
    periodo?.militar_nome_completo ||
    'Militar não identificado'
  );
}

function normalizeAjuste(ajuste = {}, periodo = {}) {
  return {
    id: ajuste.id || ajuste._id || globalThis.crypto?.randomUUID?.() || `aj-${Date.now()}`,
    periodo_aquisitivo_id: ajuste.periodo_aquisitivo_id || periodo.id || null,
    periodo_aquisitivo_ref: ajuste.periodo_aquisitivo_ref || buildPeriodoReferencia(periodo),
    militar_id: ajuste.militar_id || periodo.militar_id || null,
    militar_nome: ajuste.militar_nome || periodo.militar_nome || periodo.militar_nome_completo || buildNomeMilitar(periodo),
    militar_matricula: ajuste.militar_matricula || periodo.militar_matricula || null,
    militar_posto: ajuste.militar_posto || periodo.militar_posto || null,
    tipo: ajuste.tipo,
    quantidade: normalizarQuantidade(ajuste.quantidade),
    motivo: ajuste.motivo || '',
    observacao: ajuste.observacao || '',
    data: getDateOnly(ajuste.data || ajuste.created_date),
    usuario: ajuste.usuario || null,
    publicacao_id: ajuste.publicacao_id || null,
    origem: ajuste.origem || 'manual',
    origem_registro_livro_id: ajuste.origem_registro_livro_id || null,
    status: ajuste.status || STATUS_AJUSTE.ATIVO,
    invalidado_em: ajuste.invalidado_em || null,
    invalidado_por: ajuste.invalidado_por || null,
    invalidado_motivo: ajuste.invalidado_motivo || null,
    created_date: ajuste.created_date || null,
  };
}

async function listEntitySafe(entityName, order = null) {
  const entity = base44.entities?.[entityName];
  if (!entity || typeof entity.list !== 'function') return [];
  try {
    return await entity.list(order || undefined);
  } catch {
    return [];
  }
}

async function filterEntitySafe(entityName, filter = {}, order = null) {
  const entity = base44.entities?.[entityName];
  if (!entity || typeof entity.filter !== 'function') return [];
  try {
    return await entity.filter(filter, order || undefined);
  } catch {
    return [];
  }
}

async function updateEntitySafe(entityName, id, payload) {
  const entity = base44.entities?.[entityName];
  if (!entity || typeof entity.update !== 'function') return null;
  try {
    return await entity.update(id, payload);
  } catch {
    return null;
  }
}

async function createEntitySafe(entityName, payload) {
  const entity = base44.entities?.[entityName];
  if (!entity || typeof entity.create !== 'function') return null;
  try {
    return await entity.create(payload);
  } catch {
    return null;
  }
}

async function carregarPeriodo(periodoId) {
  const list = await filterEntitySafe('PeriodoAquisitivo', { id: periodoId });
  return list[0] || null;
}

async function carregarFeriasDoMilitar(militarId) {
  if (!militarId) return [];
  return filterEntitySafe('Ferias', { militar_id: militarId });
}

function calcularDiasAjusteFromHistory(ajustes = []) {
  return (ajustes || []).filter(isAdjustmentActive).reduce((acc, ajuste) => {
    return acc + getAdjustmentSignal(ajuste.tipo) * normalizarQuantidade(ajuste.quantidade);
  }, 0);
}

function montarPayloadPeriodo({ periodo, ferias = [], ajustes = [] }) {
  const dias_base = obterDiasBase(periodo) || DIAS_BASE_PADRAO;
  const dias_gozados = calcularDiasGozados(periodo, ferias);
  const dias_previstos = calcularDiasPrevistos(periodo, ferias);
  const dias_ajuste = calcularDiasAjusteFromHistory(ajustes);
  const dias_total = dias_base + dias_ajuste;
  const dias_saldo = dias_total - dias_gozados - dias_previstos;

  if (dias_total < 0) {
    throw new Error('O total de dias do período não pode ficar negativo.');
  }

  if (dias_saldo < 0) {
    throw new Error('A operação deixa o período com saldo negativo frente aos dias já gozados ou previstos.');
  }

  const payload = {
    dias_base,
    dias_ajuste,
    dias_total,
    dias_direito: dias_total,
    dias_gozados,
    dias_previstos,
    dias_saldo,
  };

  payload.status = calcularStatusPeriodoAquisitivo({
    periodo,
    dias_previstos,
    dias_gozados,
    dias_saldo,
  });

  return payload;
}

async function listarAjustesDoBancoPorPeriodo(periodoId) {
  if (!periodoId) return [];
  const items = await filterEntitySafe('AjustePeriodoAquisitivo', { periodo_aquisitivo_id: periodoId }, '-data');
  return items;
}

function listarAjustesDoFallback(periodo = {}) {
  if (!Array.isArray(periodo?.ajustes_admin)) return [];
  return periodo.ajustes_admin;
}

function mergeAjustes(periodo = {}, ajustesBanco = []) {
  const merged = new Map();

  [...listarAjustesDoFallback(periodo), ...ajustesBanco].forEach((item) => {
    const normalizado = normalizeAjuste(item, periodo);
    merged.set(normalizado.id, normalizado);
  });

  return [...merged.values()].sort((a, b) => {
    const db = `${b.data || ''} ${b.created_date || ''}`;
    const da = `${a.data || ''} ${a.created_date || ''}`;
    return db.localeCompare(da);
  });
}

export async function listarAjustesPeriodoAquisitivo({ periodoId = null, periodo = null } = {}) {
  const periodoObj = periodo || (periodoId ? await carregarPeriodo(periodoId) : null);
  if (!periodoObj?.id) return [];
  const ajustesBanco = await listarAjustesDoBancoPorPeriodo(periodoObj.id);
  return mergeAjustes(periodoObj, ajustesBanco);
}

export async function listarTodosAjustesPeriodoAquisitivo(periodos = []) {
  const banco = await listEntitySafe('AjustePeriodoAquisitivo', '-data');
  const agrupados = new Map();

  (periodos || []).forEach((periodo) => {
    agrupados.set(periodo.id, mergeAjustes(periodo, banco.filter((item) => item?.periodo_aquisitivo_id === periodo.id)));
  });

  banco.forEach((item) => {
    if (!item?.periodo_aquisitivo_id || agrupados.has(item.periodo_aquisitivo_id)) return;
    agrupados.set(item.periodo_aquisitivo_id, [normalizeAjuste(item)]);
  });

  return agrupados;
}

function montarTextoPublicacaoDispensa({ periodo, quantidade, motivo, observacao, estadoAntes, estadoDepois, data }) {
  const referencia = buildPeriodoReferencia(periodo);
  const nomeMilitar = buildNomeMilitar(periodo);
  const posto = periodo?.militar_posto ? `${periodo.militar_posto} ` : '';
  const matricula = periodo?.militar_matricula ? `, matrícula ${periodo.militar_matricula}` : '';
  const dataAto = getDateOnly(data);
  const linhas = [
    `Fica registrada a concessão de dispensa com desconto em férias ao(à) ${posto}${nomeMilitar}${matricula}.`,
    `Período aquisitivo: ${referencia}.`,
    `Data do ato: ${dataAto}.`,
    `Quantidade descontada: ${quantidade} dia(s).`,
    `Saldo anterior: ${estadoAntes.dias_saldo} dia(s).`,
    `Saldo remanescente após o desconto: ${estadoDepois.dias_saldo} dia(s).`,
    `Motivo: ${motivo}.`,
  ];

  if (observacao) linhas.push(`Observações complementares: ${observacao}.`);
  return linhas.join(' ');
}

async function criarPublicacaoDispensaComDesconto({ periodo, quantidade, motivo, observacao, data, estadoAntes, estadoDepois, origem_registro_livro_id = null }) {
  const dataPublicacao = getDateOnly(data);
  const referencia = buildPeriodoReferencia(periodo);
  const nomeMilitar = buildNomeMilitar(periodo);
  const texto_publicacao = montarTextoPublicacaoDispensa({
    periodo,
    quantidade,
    motivo,
    observacao,
    estadoAntes,
    estadoDepois,
    data,
  });

  return createEntitySafe('PublicacaoExOfficio', {
    militar_id: periodo.militar_id || '',
    militar_nome: periodo.militar_nome || periodo.militar_nome_completo || nomeMilitar,
    militar_posto: periodo.militar_posto || '',
    militar_matricula: periodo.militar_matricula || '',
    tipo: 'Dispensa com Desconto em Férias',
    tipo_origem: 'ferias_desconto',
    data_publicacao: dataPublicacao,
    texto_publicacao,
    observacoes: observacao || '',
    status: 'Aguardando Nota',
    periodo_aquisitivo_id: periodo.id,
    periodo_aquisitivo_ref: referencia,
    quantidade_desconto: quantidade,
    saldo_antes_desconto: estadoAntes.dias_saldo,
    saldo_apos_desconto: estadoDepois.dias_saldo,
    motivo_desconto: motivo,
    origem_registro_livro_id,
  });
}

async function persistirAjuste({ periodo, ajuste }) {
  const payload = normalizeAjuste(ajuste, periodo);
  const created = await createEntitySafe('AjustePeriodoAquisitivo', payload);

  if (created?.id) {
    return {
      persistedIn: 'AjustePeriodoAquisitivo',
      ajuste: normalizeAjuste(created, periodo),
    };
  }

  const historicoExistente = listarAjustesDoFallback(periodo)
    .filter((item) => item?.id !== payload.id)
    .concat(payload);

  await base44.entities.PeriodoAquisitivo.update(periodo.id, {
    ajustes_admin: historicoExistente,
  });

  return {
    persistedIn: 'PeriodoAquisitivo.ajustes_admin',
    ajuste: payload,
  };
}

async function salvarEstadoPeriodo({ periodo, ajustes, ferias }) {
  const payloadPeriodo = montarPayloadPeriodo({ periodo, ajustes, ferias });
  await base44.entities.PeriodoAquisitivo.update(periodo.id, payloadPeriodo);
  return payloadPeriodo;
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
  origem = 'manual',
  origem_registro_livro_id = null,
}) {
  const periodo = await carregarPeriodo(periodoId);
  if (!periodo) throw new Error('Período aquisitivo não encontrado para ajuste.');

  const qtd = normalizarQuantidade(quantidade);
  if (!Object.values(TIPO_AJUSTE).includes(tipo)) {
    throw new Error('Tipo de ajuste inválido.');
  }
  if (qtd <= 0) {
    throw new Error('Informe uma quantidade de dias maior que zero.');
  }
  if (!String(motivo || '').trim()) {
    throw new Error('Informe o motivo do ajuste.');
  }

  const feriasMilitar = await carregarFeriasDoMilitar(periodo.militar_id);
  const feriasRelacionadas = filtrarFeriasDoPeriodo(periodo, feriasMilitar);
  const ajustesAtuais = await listarAjustesPeriodoAquisitivo({ periodo });
  const estadoAntes = montarPayloadPeriodo({ periodo, ferias: feriasRelacionadas, ajustes: ajustesAtuais });

  const ajusteNovo = normalizeAjuste({
    id: globalThis.crypto?.randomUUID?.() || `aj-${Date.now()}`,
    periodo_aquisitivo_id: periodo.id,
    periodo_aquisitivo_ref: buildPeriodoReferencia(periodo),
    militar_id: periodo.militar_id,
    militar_nome: periodo.militar_nome || periodo.militar_nome_completo || buildNomeMilitar(periodo),
    militar_matricula: periodo.militar_matricula,
    militar_posto: periodo.militar_posto,
    tipo,
    quantidade: qtd,
    motivo: String(motivo || '').trim(),
    observacao: String(observacao || '').trim(),
    data: getDateOnly(data),
    usuario: usuario || null,
    publicacao_id: publicacao_id || null,
    origem,
    origem_registro_livro_id,
    status: STATUS_AJUSTE.ATIVO,
  }, periodo);

  const ajustesProjetados = [...ajustesAtuais, ajusteNovo];
  const estadoDepois = montarPayloadPeriodo({ periodo, ferias: feriasRelacionadas, ajustes: ajustesProjetados });

  let publicacao = null;
  if (tipo === TIPO_AJUSTE.DISPENSA_DESCONTO && !publicacao_id) {
    publicacao = await criarPublicacaoDispensaComDesconto({
      periodo,
      quantidade: qtd,
      motivo: ajusteNovo.motivo,
      observacao: ajusteNovo.observacao,
      data: ajusteNovo.data,
      estadoAntes,
      estadoDepois,
      origem_registro_livro_id,
    });
    if (publicacao?.id) ajusteNovo.publicacao_id = publicacao.id;
  }

  const persistencia = await persistirAjuste({ periodo, ajuste: ajusteNovo });
  const ajustesFinais = [...ajustesAtuais, persistencia.ajuste];
  const payloadPeriodo = await salvarEstadoPeriodo({ periodo, ajustes: ajustesFinais, ferias: feriasRelacionadas });

  if (publicacao?.id) {
    await updateEntitySafe('PublicacaoExOfficio', publicacao.id, {
      ajuste_periodo_id: persistencia.ajuste.id,
      observacoes: appendObservacao(publicacao.observacoes, `Ajuste administrativo vinculado: ${persistencia.ajuste.id}.`),
    });
  }

  return {
    persistedIn: persistencia.persistedIn,
    ajuste: persistencia.ajuste,
    periodoPayload: payloadPeriodo,
    publicacao,
  };
}

export async function aplicarAjustePositivo(payload) {
  return registrarAjustePeriodoAquisitivo({ ...payload, tipo: TIPO_AJUSTE.ADICAO });
}

export async function prepararDispensaComDesconto(payload) {
  return registrarAjustePeriodoAquisitivo({
    ...payload,
    tipo: TIPO_AJUSTE.DISPENSA_DESCONTO,
    origem: payload?.origem || 'manual',
  });
}

async function atualizarFallbackPeriodo(periodo, ajusteAtualizado) {
  const historico = listarAjustesDoFallback(periodo).map((item) => {
    if ((item?.id || null) !== ajusteAtualizado.id) return item;
    return { ...item, ...ajusteAtualizado };
  });
  await base44.entities.PeriodoAquisitivo.update(periodo.id, { ajustes_admin: historico });
}

export async function invalidarAjustePeriodoAquisitivo({
  ajusteId,
  periodoId = null,
  motivo = 'Registro administrativo original excluído/inativado. Verificar a validade desta nota.',
  usuario = null,
  invalidarPublicacao = true,
}) {
  if (!ajusteId) throw new Error('Ajuste não informado para invalidação.');

  let periodo = periodoId ? await carregarPeriodo(periodoId) : null;
  let ajustes = [];

  if (periodo) {
    ajustes = await listarAjustesPeriodoAquisitivo({ periodo });
  } else {
    const periodos = await listEntitySafe('PeriodoAquisitivo');
    for (const candidato of periodos) {
      const lista = await listarAjustesPeriodoAquisitivo({ periodo: candidato });
      const match = lista.find((item) => item.id === ajusteId);
      if (match) {
        periodo = candidato;
        ajustes = lista;
        break;
      }
    }
  }

  if (!periodo) throw new Error('Período aquisitivo do ajuste não foi localizado.');

  const ajusteAtual = ajustes.find((item) => item.id === ajusteId);
  if (!ajusteAtual) throw new Error('Ajuste não encontrado.');
  if (!isAdjustmentActive(ajusteAtual)) {
    return { ajuste: ajusteAtual, periodoPayload: montarPayloadPeriodo({ periodo, ajustes, ferias: filtrarFeriasDoPeriodo(periodo, await carregarFeriasDoMilitar(periodo.militar_id)) }) };
  }

  const ajusteInvalidado = {
    ...ajusteAtual,
    status: STATUS_AJUSTE.INVALIDADO,
    invalidado_em: new Date().toISOString(),
    invalidado_por: usuario || null,
    invalidado_motivo: motivo,
  };

  const atualizadoBanco = await updateEntitySafe('AjustePeriodoAquisitivo', ajusteId, {
    status: STATUS_AJUSTE.INVALIDADO,
    invalidado_em: ajusteInvalidado.invalidado_em,
    invalidado_por: ajusteInvalidado.invalidado_por,
    invalidado_motivo: ajusteInvalidado.invalidado_motivo,
  });

  if (!atualizadoBanco) {
    await atualizarFallbackPeriodo(periodo, ajusteInvalidado);
  }

  const ajustesReprocessados = ajustes.map((item) => (item.id === ajusteId ? ajusteInvalidado : item));
  const feriasMilitar = await carregarFeriasDoMilitar(periodo.militar_id);
  const feriasRelacionadas = filtrarFeriasDoPeriodo(periodo, feriasMilitar);
  const payloadPeriodo = await salvarEstadoPeriodo({
    periodo,
    ajustes: ajustesReprocessados,
    ferias: feriasRelacionadas,
  });

  if (invalidarPublicacao && ajusteAtual.publicacao_id) {
    const observacaoInvalidacao = 'Registro administrativo original excluído/inativado. Esta nota deve ser revisada quanto à sua validade.';
    const pubs = await filterEntitySafe('PublicacaoExOfficio', { id: ajusteAtual.publicacao_id });
    const pub = pubs[0];
    if (pub) {
      await updateEntitySafe('PublicacaoExOfficio', pub.id, {
        status: 'Inválida',
        observacoes: appendObservacao(pub.observacoes, observacaoInvalidacao),
      });
    }
  }

  return {
    ajuste: ajusteInvalidado,
    periodoPayload: payloadPeriodo,
  };
}

export async function reverterAjustesPorPublicacao(publicacao) {
  const publicacaoId = publicacao?.id;
  if (!publicacaoId) return [];

  const ajustesBanco = await filterEntitySafe('AjustePeriodoAquisitivo', { publicacao_id: publicacaoId });
  const resultados = [];

  for (const ajuste of ajustesBanco) {
    resultados.push(await invalidarAjustePeriodoAquisitivo({
      ajusteId: ajuste.id,
      periodoId: ajuste.periodo_aquisitivo_id || null,
      motivo: 'Publicação excluída. Desconto revertido automaticamente.',
      invalidarPublicacao: false,
    }));
  }

  if (resultados.length > 0) return resultados;

  const periodos = await listEntitySafe('PeriodoAquisitivo');
  for (const periodo of periodos) {
    const fallback = listarAjustesDoFallback(periodo).find((item) => item?.publicacao_id === publicacaoId && isAdjustmentActive(item));
    if (fallback?.id) {
      resultados.push(await invalidarAjustePeriodoAquisitivo({
        ajusteId: fallback.id,
        periodoId: periodo.id,
        motivo: 'Publicação excluída. Desconto revertido automaticamente.',
        invalidarPublicacao: false,
      }));
    }
  }

  return resultados;
}
