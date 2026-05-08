import { compareDateOnly, normalizeDateOnly } from './dateOnlyService.js';

export const STATUS_FINALIZADOS_LEGADO_ATIVA = Object.freeze(['Gozado', 'Inativo']);
export const STATUS_FERIAS_EM_CURSO = 'Em Curso';
export const STATUS_FERIAS_PREVISTA_AUTORIZADA = Object.freeze(['Prevista', 'Autorizada']);

export function getRegistroId(registro) {
  return registro?.id ?? registro?._id ?? null;
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPeriodoRef(periodo) {
  return periodo?.periodo_aquisitivo_ref || periodo?.ano_referencia || '';
}

function feriasVinculadaAoPeriodo(ferias, periodo) {
  const periodoId = getRegistroId(periodo);
  const periodoRef = getPeriodoRef(periodo);
  if (periodoId && ferias?.periodo_aquisitivo_id && String(ferias.periodo_aquisitivo_id) === String(periodoId)) return true;
  if (periodoRef && ferias?.periodo_aquisitivo_ref && String(ferias.periodo_aquisitivo_ref) === String(periodoRef)) return true;
  return false;
}

export function classificarPreviaLegadoAtiva({ militarId, dataBase, periodos = [], ferias = [] } = {}) {
  const dataBaseNormalizada = normalizeDateOnly(dataBase);
  if (!militarId) throw new Error('militarId é obrigatório para classificar a prévia.');
  if (!dataBaseNormalizada) throw new Error('dataBase válida é obrigatória para classificar a prévia.');

  const candidatos = [];
  const ignorados = [];
  const jaMarcados = [];
  const riscos = [];
  const periodosDoMilitar = (Array.isArray(periodos) ? periodos : []).filter((periodo) => String(periodo?.militar_id || '') === String(militarId));
  const feriasDoMilitar = (Array.isArray(ferias) ? ferias : []).filter((item) => String(item?.militar_id || '') === String(militarId));

  periodosDoMilitar.forEach((periodo) => {
    const id = getRegistroId(periodo);
    const fim = normalizeDateOnly(periodo?.fim_aquisitivo);
    const resumo = {
      id,
      ano_referencia: periodo?.ano_referencia || periodo?.periodo_aquisitivo_ref || null,
      inicio_aquisitivo: normalizeDateOnly(periodo?.inicio_aquisitivo) || periodo?.inicio_aquisitivo || null,
      fim_aquisitivo: fim || periodo?.fim_aquisitivo || null,
      status: periodo?.status || null,
      inativo: periodo?.inativo === true,
      dias_saldo: toNumber(periodo?.dias_saldo),
      origem_periodo: periodo?.origem_periodo || null,
    };

    if (Boolean(periodo?.legado_ativa)) {
      jaMarcados.push({ ...resumo, motivo: 'ja_marcado_legado_ativa' });
      ignorados.push({ ...resumo, motivo: 'ja_marcado_legado_ativa' });
      return;
    }

    if (!fim) {
      ignorados.push({ ...resumo, motivo: 'fim_aquisitivo_invalido' });
      return;
    }

    if (periodo?.inativo === true) {
      ignorados.push({ ...resumo, motivo: 'periodo_inativo' });
      return;
    }

    if (compareDateOnly(fim, dataBaseNormalizada) !== -1) {
      ignorados.push({ ...resumo, motivo: 'fim_aquisitivo_maior_ou_igual_data_base' });
      return;
    }

    const feriasRelacionadas = feriasDoMilitar.filter((item) => feriasVinculadaAoPeriodo(item, periodo));
    const codigosRisco = [];
    if (resumo.dias_saldo > 0) codigosRisco.push('saldo_aberto');
    if (feriasRelacionadas.length > 0) codigosRisco.push('ferias_vinculadas');
    if (feriasRelacionadas.some((item) => item?.status === STATUS_FERIAS_EM_CURSO)) codigosRisco.push('ferias_em_curso');
    if (feriasRelacionadas.some((item) => STATUS_FERIAS_PREVISTA_AUTORIZADA.includes(item?.status))) codigosRisco.push('ferias_prevista_ou_autorizada');
    if (!STATUS_FINALIZADOS_LEGADO_ATIVA.includes(periodo?.status)) codigosRisco.push('status_nao_finalizado');
    if (periodo?.status === 'Pago') codigosRisco.push('status_pago_nao_previsto');

    const candidato = {
      ...resumo,
      ferias_vinculadas: feriasRelacionadas.length,
      riscos: codigosRisco,
    };
    candidatos.push(candidato);

    codigosRisco.forEach((codigo) => {
      riscos.push({
        periodo_id: id,
        periodo_ref: resumo.ano_referencia,
        codigo,
        bloqueante: ['ferias_em_curso', 'ferias_prevista_ou_autorizada', 'status_pago_nao_previsto'].includes(codigo),
      });
    });
  });

  const totais = {
    periodos_analisados: periodosDoMilitar.length,
    candidatos: candidatos.length,
    ignorados: ignorados.length,
    ja_marcados: jaMarcados.length,
    com_saldo_aberto: candidatos.filter((item) => item.riscos.includes('saldo_aberto')).length,
    com_ferias_vinculadas: candidatos.filter((item) => item.riscos.includes('ferias_vinculadas')).length,
    bloqueantes: riscos.filter((item) => item.bloqueante).length,
  };

  return { candidatos, ignorados, jaMarcados, riscos, totais };
}
