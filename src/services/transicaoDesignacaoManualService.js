import { compareDateOnly, normalizeDateOnly } from './dateOnlyService.js';

export const ACOES_TRANSICAO_DESIGNACAO = Object.freeze({
  MANTER: 'manter',
  MARCAR_LEGADO_ATIVA: 'marcar_legado_ativa',
  MARCAR_INDENIZADO: 'marcar_indenizado',
  EXCLUIR_CADEIA_OPERACIONAL: 'excluir_cadeia_operacional',
  CANCELAR_PERIODO_FUTURO_INDEVIDO: 'cancelar_periodo_futuro_indevido',
});

export const SITUACOES_TRANSICAO_DESIGNACAO = Object.freeze({
  OPERACIONAL: 'operacional',
  ANTERIOR_DATA_BASE: 'anterior_data_base',
  FUTURO_POS_DATA_BASE: 'futuro_pos_data_base',
  JA_LEGADO: 'ja_legado',
  INATIVO: 'inativo',
  SEM_FIM_AQUISITIVO: 'sem_fim_aquisitivo',
  COM_FERIAS_EM_CURSO: 'com_ferias_em_curso',
  COM_FERIAS_PREVISTA_OU_AUTORIZADA: 'com_ferias_prevista_ou_autorizada',
  CONFLITO: 'conflito',
});

export const RISCOS_TRANSICAO_DESIGNACAO = Object.freeze({
  SALDO_ABERTO: 'saldo_aberto',
  FERIAS_VINCULADAS: 'ferias_vinculadas',
  FERIAS_EM_CURSO: 'ferias_em_curso',
  FERIAS_PREVISTA_OU_AUTORIZADA: 'ferias_prevista_ou_autorizada',
  STATUS_NAO_FINALIZADO: 'status_nao_finalizado',
  STATUS_PAGO_NAO_PREVISTO: 'status_pago_nao_previsto',
  PERIODO_SEM_FIM_AQUISITIVO: 'periodo_sem_fim_aquisitivo',
  JA_LEGADO_OUTRO_CONTRATO: 'ja_legado_outro_contrato',
  FUTURO_INDEVIDO: 'futuro_indevido',
  OVERRIDE_SUGESTAO: 'override_sugestao',
});

const STATUS_FINALIZADOS_LEGADO_ATIVA = Object.freeze(['Gozado', 'Inativo']);
const STATUS_FERIAS_EM_CURSO = 'Em Curso';
const STATUS_FERIAS_PREVISTA_AUTORIZADA = Object.freeze(['Prevista', 'Autorizada']);
const RISCOS_BLOQUEANTES = Object.freeze([
  RISCOS_TRANSICAO_DESIGNACAO.FERIAS_EM_CURSO,
  RISCOS_TRANSICAO_DESIGNACAO.FERIAS_PREVISTA_OU_AUTORIZADA,
  RISCOS_TRANSICAO_DESIGNACAO.STATUS_PAGO_NAO_PREVISTO,
  RISCOS_TRANSICAO_DESIGNACAO.PERIODO_SEM_FIM_AQUISITIVO,
  RISCOS_TRANSICAO_DESIGNACAO.JA_LEGADO_OUTRO_CONTRATO,
]);

function getRegistroId(registro) {
  return registro?.id ?? registro?._id ?? null;
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPeriodoRef(periodo) {
  return periodo?.periodo_aquisitivo_ref || periodo?.ano_referencia || '';
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function sortPrimitiveArray(values) {
  return unique(values).sort((a, b) => String(a).localeCompare(String(b)));
}

function feriasVinculadaAoPeriodo(ferias, periodo) {
  const periodoId = getRegistroId(periodo);
  const periodoRef = getPeriodoRef(periodo);
  if (periodoId && ferias?.periodo_aquisitivo_id && String(ferias.periodo_aquisitivo_id) === String(periodoId)) return true;
  if (periodoRef && ferias?.periodo_aquisitivo_ref && String(ferias.periodo_aquisitivo_ref) === String(periodoRef)) return true;
  return false;
}

function resumirPeriodo(periodo) {
  return {
    id: getRegistroId(periodo),
    militar_id: periodo?.militar_id ?? null,
    contrato_designacao_id: periodo?.contrato_designacao_id ?? periodo?.contrato_id ?? null,
    ano_referencia: periodo?.ano_referencia || periodo?.periodo_aquisitivo_ref || null,
    periodo_aquisitivo_ref: periodo?.periodo_aquisitivo_ref || periodo?.ano_referencia || null,
    inicio_aquisitivo: normalizeDateOnly(periodo?.inicio_aquisitivo) || periodo?.inicio_aquisitivo || null,
    fim_aquisitivo: normalizeDateOnly(periodo?.fim_aquisitivo) || periodo?.fim_aquisitivo || null,
    status: periodo?.status || null,
    inativo: periodo?.inativo === true,
    dias_saldo: toNumber(periodo?.dias_saldo),
    origem_periodo: periodo?.origem_periodo || null,
    legado_ativa: periodo?.legado_ativa === true,
    excluido_da_cadeia_designacao: periodo?.excluido_da_cadeia_designacao === true,
    updated_date: periodo?.updated_date || periodo?.updated_at || null,
  };
}

function resumirFerias(ferias) {
  return {
    id: getRegistroId(ferias),
    status: ferias?.status || null,
    periodo_aquisitivo_id: ferias?.periodo_aquisitivo_id || null,
    periodo_aquisitivo_ref: ferias?.periodo_aquisitivo_ref || null,
    updated_date: ferias?.updated_date || ferias?.updated_at || null,
  };
}

function criarMensagem(codigo, detalhe = null) {
  return detalhe ? { codigo, detalhe } : { codigo };
}

function resolverAcoesPermitidas({ situacaoAtual, bloqueantes }) {
  if (bloqueantes.length > 0) return [ACOES_TRANSICAO_DESIGNACAO.MANTER];
  if (situacaoAtual === SITUACOES_TRANSICAO_DESIGNACAO.JA_LEGADO || situacaoAtual === SITUACOES_TRANSICAO_DESIGNACAO.INATIVO) {
    return [ACOES_TRANSICAO_DESIGNACAO.MANTER];
  }
  if (situacaoAtual === SITUACOES_TRANSICAO_DESIGNACAO.FUTURO_POS_DATA_BASE) {
    return [ACOES_TRANSICAO_DESIGNACAO.MANTER, ACOES_TRANSICAO_DESIGNACAO.CANCELAR_PERIODO_FUTURO_INDEVIDO, ACOES_TRANSICAO_DESIGNACAO.EXCLUIR_CADEIA_OPERACIONAL];
  }
  if (situacaoAtual === SITUACOES_TRANSICAO_DESIGNACAO.ANTERIOR_DATA_BASE) {
    return [ACOES_TRANSICAO_DESIGNACAO.MANTER, ACOES_TRANSICAO_DESIGNACAO.MARCAR_LEGADO_ATIVA, ACOES_TRANSICAO_DESIGNACAO.MARCAR_INDENIZADO, ACOES_TRANSICAO_DESIGNACAO.EXCLUIR_CADEIA_OPERACIONAL];
  }
  return [ACOES_TRANSICAO_DESIGNACAO.MANTER, ACOES_TRANSICAO_DESIGNACAO.EXCLUIR_CADEIA_OPERACIONAL];
}

export function analisarPeriodoTransicaoDesignacao({ periodo, feriasVinculadas = [], contrato = null, dataBase } = {}) {
  const periodoId = getRegistroId(periodo);
  const dataBaseNormalizada = normalizeDateOnly(dataBase);
  const fimAquisitivo = normalizeDateOnly(periodo?.fim_aquisitivo);
  const feriasRelacionadas = (Array.isArray(feriasVinculadas) ? feriasVinculadas : []).filter((item) => feriasVinculadaAoPeriodo(item, periodo));
  const riscos = [];
  const alertas = [];
  const conflitos = [];
  const motivosSugestao = [];

  if (toNumber(periodo?.dias_saldo) > 0) riscos.push(RISCOS_TRANSICAO_DESIGNACAO.SALDO_ABERTO);
  if (feriasRelacionadas.length > 0) riscos.push(RISCOS_TRANSICAO_DESIGNACAO.FERIAS_VINCULADAS);
  if (feriasRelacionadas.some((item) => item?.status === STATUS_FERIAS_EM_CURSO)) riscos.push(RISCOS_TRANSICAO_DESIGNACAO.FERIAS_EM_CURSO);
  if (feriasRelacionadas.some((item) => STATUS_FERIAS_PREVISTA_AUTORIZADA.includes(item?.status))) riscos.push(RISCOS_TRANSICAO_DESIGNACAO.FERIAS_PREVISTA_OU_AUTORIZADA);
  if (periodo?.status && !STATUS_FINALIZADOS_LEGADO_ATIVA.includes(periodo.status)) riscos.push(RISCOS_TRANSICAO_DESIGNACAO.STATUS_NAO_FINALIZADO);
  if (periodo?.status === 'Pago') riscos.push(RISCOS_TRANSICAO_DESIGNACAO.STATUS_PAGO_NAO_PREVISTO);

  let situacaoAtual = SITUACOES_TRANSICAO_DESIGNACAO.OPERACIONAL;
  let acaoSugerida = ACOES_TRANSICAO_DESIGNACAO.MANTER;

  if (periodo?.legado_ativa === true) {
    situacaoAtual = SITUACOES_TRANSICAO_DESIGNACAO.JA_LEGADO;
    motivosSugestao.push('periodo_ja_marcado_como_legado_ativa');
  } else if (!fimAquisitivo) {
    situacaoAtual = SITUACOES_TRANSICAO_DESIGNACAO.SEM_FIM_AQUISITIVO;
    riscos.push(RISCOS_TRANSICAO_DESIGNACAO.PERIODO_SEM_FIM_AQUISITIVO);
    motivosSugestao.push('fim_aquisitivo_invalido_ou_ausente');
  } else if (periodo?.inativo === true) {
    situacaoAtual = SITUACOES_TRANSICAO_DESIGNACAO.INATIVO;
    motivosSugestao.push('periodo_inativo_nao_deve_ser_alterado');
  } else if (riscos.includes(RISCOS_TRANSICAO_DESIGNACAO.FERIAS_EM_CURSO)) {
    situacaoAtual = SITUACOES_TRANSICAO_DESIGNACAO.COM_FERIAS_EM_CURSO;
    motivosSugestao.push('ferias_em_curso_impede_sugestao_operacional');
  } else if (riscos.includes(RISCOS_TRANSICAO_DESIGNACAO.FERIAS_PREVISTA_OU_AUTORIZADA)) {
    situacaoAtual = SITUACOES_TRANSICAO_DESIGNACAO.COM_FERIAS_PREVISTA_OU_AUTORIZADA;
    motivosSugestao.push('ferias_prevista_ou_autorizada_impede_sugestao_operacional');
  } else if (dataBaseNormalizada && compareDateOnly(fimAquisitivo, dataBaseNormalizada) === -1) {
    situacaoAtual = SITUACOES_TRANSICAO_DESIGNACAO.ANTERIOR_DATA_BASE;
    acaoSugerida = ACOES_TRANSICAO_DESIGNACAO.MARCAR_LEGADO_ATIVA;
    motivosSugestao.push('fim_aquisitivo_anterior_a_data_base');
  } else if (dataBaseNormalizada && compareDateOnly(fimAquisitivo, dataBaseNormalizada) >= 0) {
    situacaoAtual = SITUACOES_TRANSICAO_DESIGNACAO.FUTURO_POS_DATA_BASE;
    acaoSugerida = ACOES_TRANSICAO_DESIGNACAO.CANCELAR_PERIODO_FUTURO_INDEVIDO;
    riscos.push(RISCOS_TRANSICAO_DESIGNACAO.FUTURO_INDEVIDO);
    motivosSugestao.push('fim_aquisitivo_maior_ou_igual_a_data_base');
  }

  const contratoIdPeriodo = periodo?.contrato_designacao_id || periodo?.contrato_id || null;
  const contratoIdAtual = getRegistroId(contrato);
  if (periodo?.legado_ativa === true && contratoIdPeriodo && contratoIdAtual && String(contratoIdPeriodo) !== String(contratoIdAtual)) {
    riscos.push(RISCOS_TRANSICAO_DESIGNACAO.JA_LEGADO_OUTRO_CONTRATO);
    conflitos.push(criarMensagem(RISCOS_TRANSICAO_DESIGNACAO.JA_LEGADO_OUTRO_CONTRATO));
    situacaoAtual = SITUACOES_TRANSICAO_DESIGNACAO.CONFLITO;
  }

  const riscosUnicos = sortPrimitiveArray(riscos);
  const bloqueantes = riscosUnicos.filter((codigo) => RISCOS_BLOQUEANTES.includes(codigo));
  bloqueantes.forEach((codigo) => alertas.push(criarMensagem(codigo)));
  if (riscosUnicos.includes(RISCOS_TRANSICAO_DESIGNACAO.SALDO_ABERTO)) alertas.push(criarMensagem(RISCOS_TRANSICAO_DESIGNACAO.SALDO_ABERTO));

  const acoesPermitidas = resolverAcoesPermitidas({ situacaoAtual, bloqueantes });
  if (!acoesPermitidas.includes(acaoSugerida)) acaoSugerida = ACOES_TRANSICAO_DESIGNACAO.MANTER;

  return {
    periodoId,
    periodo: resumirPeriodo(periodo),
    feriasVinculadas: feriasRelacionadas.map(resumirFerias),
    situacaoAtual,
    acaoSugerida,
    acoesPermitidas,
    riscos: riscosUnicos,
    alertas,
    conflitos,
    bloqueantes,
    motivosSugestao,
    exigeMotivo: acaoSugerida !== ACOES_TRANSICAO_DESIGNACAO.MANTER && riscosUnicos.length > 0,
    exigeDocumento: bloqueantes.length > 0,
    overridePermitido: bloqueantes.length === 0,
  };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = stableValue(value[key]);
    return acc;
  }, {});
}

function fnv1aHash(input) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function normalizarEntradaHash(payload = {}) {
  const militar = payload.militar || {};
  const contrato = payload.contrato || {};
  const periodosAnalisados = Array.isArray(payload.periodos) && payload.periodos.some((item) => item?.periodo)
    ? payload.periodos
    : analisarTransicaoDesignacaoManual({
      militar,
      contrato,
      periodos: payload.periodos || [],
      ferias: payload.ferias || [],
      dataBase: payload.dataBase || payload.data_base,
      calcularHash: false,
    }).periodos;

  return {
    militar_id: payload.militar_id || getRegistroId(militar) || militar?.militar_id || null,
    contrato_designacao_id: payload.contrato_designacao_id || getRegistroId(contrato) || contrato?.contrato_designacao_id || null,
    data_base: normalizeDateOnly(payload.dataBase || payload.data_base) || payload.dataBase || payload.data_base || null,
    periodos: [...periodosAnalisados].map((item) => ({
      periodo_id: item.periodoId || item?.periodo?.id || null,
      inicio_aquisitivo: item?.periodo?.inicio_aquisitivo || null,
      fim_aquisitivo: item?.periodo?.fim_aquisitivo || null,
      status: item?.periodo?.status || null,
      inativo: item?.periodo?.inativo === true,
      dias_saldo: toNumber(item?.periodo?.dias_saldo),
      origem_periodo: item?.periodo?.origem_periodo || null,
      legado_ativa: item?.periodo?.legado_ativa === true,
      excluido_da_cadeia_designacao: item?.periodo?.excluido_da_cadeia_designacao === true,
      updated_date: item?.periodo?.updated_date || null,
      ferias_vinculadas: [...(item.feriasVinculadas || [])].map((ferias) => ({
        id: getRegistroId(ferias),
        status: ferias?.status || null,
        periodo_aquisitivo_id: ferias?.periodo_aquisitivo_id || null,
        periodo_aquisitivo_ref: ferias?.periodo_aquisitivo_ref || null,
        updated_date: ferias?.updated_date || null,
      })).sort((a, b) => String(a.id || a.periodo_aquisitivo_ref || '').localeCompare(String(b.id || b.periodo_aquisitivo_ref || ''))),
      acao_sugerida: item.acaoSugerida || null,
      riscos: sortPrimitiveArray(item.riscos),
      bloqueantes: sortPrimitiveArray(item.bloqueantes),
    })).sort((a, b) => String(a.periodo_id || a.fim_aquisitivo || '').localeCompare(String(b.periodo_id || b.fim_aquisitivo || ''))),
    totais: stableValue(payload.totais || {}),
  };
}

export function calcularPreviewHashTransicaoDesignacao(payload = {}) {
  const canonical = stableValue(normalizarEntradaHash(payload));
  return `fnv1a:${fnv1aHash(JSON.stringify(canonical))}`;
}

export function analisarTransicaoDesignacaoManual({ militar = null, contrato = null, periodos = [], ferias = [], dataBase, calcularHash = true } = {}) {
  const militarId = getRegistroId(militar) || militar?.militar_id || contrato?.militar_id || null;
  const periodosDoMilitar = (Array.isArray(periodos) ? periodos : []).filter((periodo) => !militarId || String(periodo?.militar_id || militarId) === String(militarId));
  const feriasDoMilitar = (Array.isArray(ferias) ? ferias : []).filter((item) => !militarId || String(item?.militar_id || militarId) === String(militarId));
  const periodosAnalise = periodosDoMilitar
    .map((periodo) => analisarPeriodoTransicaoDesignacao({ periodo, feriasVinculadas: feriasDoMilitar, contrato, dataBase }))
    .sort((a, b) => String(a.periodo?.inicio_aquisitivo || a.periodoId || '').localeCompare(String(b.periodo?.inicio_aquisitivo || b.periodoId || '')));

  const riscos = periodosAnalise.flatMap((item) => item.riscos.map((codigo) => ({ periodo_id: item.periodoId, periodo_ref: item.periodo?.periodo_aquisitivo_ref, codigo, bloqueante: item.bloqueantes.includes(codigo) })));
  const alertas = periodosAnalise.flatMap((item) => item.alertas.map((alerta) => ({ periodo_id: item.periodoId, ...alerta })));
  const conflitos = periodosAnalise.flatMap((item) => item.conflitos.map((conflito) => ({ periodo_id: item.periodoId, ...conflito })));
  const bloqueantes = periodosAnalise.flatMap((item) => item.bloqueantes.map((codigo) => ({ periodo_id: item.periodoId, periodo_ref: item.periodo?.periodo_aquisitivo_ref, codigo })));
  const totais = {
    periodos_analisados: periodosAnalise.length,
    acoes_sugeridas: periodosAnalise.reduce((acc, item) => ({ ...acc, [item.acaoSugerida]: (acc[item.acaoSugerida] || 0) + 1 }), {}),
    riscos: riscos.length,
    alertas: alertas.length,
    conflitos: conflitos.length,
    bloqueantes: bloqueantes.length,
    com_saldo_aberto: periodosAnalise.filter((item) => item.riscos.includes(RISCOS_TRANSICAO_DESIGNACAO.SALDO_ABERTO)).length,
    com_ferias_vinculadas: periodosAnalise.filter((item) => item.riscos.includes(RISCOS_TRANSICAO_DESIGNACAO.FERIAS_VINCULADAS)).length,
  };

  const resultado = { periodos: periodosAnalise, riscos, alertas, conflitos, bloqueantes, totais, previewHash: null };
  resultado.previewHash = calcularHash ? calcularPreviewHashTransicaoDesignacao({ militar, contrato, dataBase, periodos: periodosAnalise, totais }) : null;
  return resultado;
}
