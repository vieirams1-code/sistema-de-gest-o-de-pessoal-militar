import { differenceInDays, format } from 'date-fns';
import { getAlertaPeriodoConcessivo, hasPrevisaoValidaPeriodo, getFracaoNumero } from './feriasRules';
import { calcularSaldosPeriodo } from './periodoDiasUtils';

const STATUS_CODIGO_MAP = {
  'Pendente': 'pendente',
  'Disponível': 'disponivel',
  'Previsto': 'previsto',
  'Parcialmente Gozado': 'parcialmente_gozado',
  'Gozado': 'gozado',
  'Vencido': 'vencido',
  'Inativo': 'inativo',
};

const ALERTA_TIPO_MAP = {
  critico: 'danger',
  atencao: 'warning',
  ok: 'success',
};

function resolveNomeMilitar(periodo = {}) {
  return [
    periodo?.militar_nome_guerra,
    periodo?.militar_nome,
    periodo?.nome_guerra,
    periodo?.militar_nome_completo,
    periodo?.militar?.nome_guerra,
    periodo?.militar?.nome,
  ].find((nome) => typeof nome === 'string' && nome.trim()) || '';
}

function parseDateOnly(date) {
  if (!date) return null;
  return new Date(`${date}T00:00:00`);
}

function formatDateBR(date) {
  const parsed = parseDateOnly(date);
  if (!parsed) return null;
  return format(parsed, 'dd/MM/yyyy');
}

function getReferenciaPeriodo(periodo) {
  if (periodo?.ano_referencia) return periodo.ano_referencia;

  const inicio = parseDateOnly(periodo?.inicio_aquisitivo);
  const fim = parseDateOnly(periodo?.fim_aquisitivo);

  if (!inicio || !fim) return '';
  return `${format(inicio, 'yyyy')}/${format(fim, 'yyyy')}`;
}

function toStatusCodigo(status) {
  return STATUS_CODIGO_MAP[status] || 'pendente';
}

function normalizarFeriasFracoes(ferias = []) {
  return [...ferias]
    .sort((a, b) => getFracaoNumero(a?.fracionamento) - getFracaoNumero(b?.fracionamento))
    .map((item, index) => ({
      id: item.id,
      nome: item.fracionamento || `${index + 1}ª Fração`,
      dias: Number(item.dias || 0),
      status: item.status || 'Prevista',
      data: item.data_inicio && item.data_fim
        ? `${formatDateBR(item.data_inicio)} a ${formatDateBR(item.data_fim)}`
        : null,
      data_inicio: item.data_inicio || null,
      data_fim: item.data_fim || null,
    }));
}

function mapPeriodo(periodo, feriasRelacionadas = [], hoje) {
  const saldos = calcularSaldosPeriodo(periodo, feriasRelacionadas);
  const diasParaVencimento = periodo?.data_limite_gozo
    ? differenceInDays(parseDateOnly(periodo.data_limite_gozo), hoje)
    : null;

  const alertaConcessivo = getAlertaPeriodoConcessivo({
    dataLimiteGozo: periodo?.data_limite_gozo,
    hasPrevisaoValida: hasPrevisaoValidaPeriodo(periodo),
  });

  const alertaCodigo = alertaConcessivo?.nivel || 'ok';
  const alertaTipo = ALERTA_TIPO_MAP[alertaCodigo] || 'success';

  let mensagemVencimento = 'Sem prazo de gozo';
  if (typeof diasParaVencimento === 'number') {
    if (diasParaVencimento < 0) {
      mensagemVencimento = `Vencido há ${Math.abs(diasParaVencimento)} dias`;
    } else if (diasParaVencimento === 0) {
      mensagemVencimento = 'Vence hoje';
    } else {
      mensagemVencimento = `Vence em ${diasParaVencimento} dias`;
    }
  }

  return {
    id: periodo.id,
    referencia: getReferenciaPeriodo(periodo),
    aquisitivo: `${formatDateBR(periodo?.inicio_aquisitivo)} a ${formatDateBR(periodo?.fim_aquisitivo)}`,
    data_inicio_aquisitivo: periodo?.inicio_aquisitivo || null,
    data_fim_aquisitivo: periodo?.fim_aquisitivo || null,
    limite_gozo: formatDateBR(periodo?.data_limite_gozo),
    data_limite_gozo_iso: periodo?.data_limite_gozo || null,
    status_operacional: periodo?.status || 'Pendente',
    status_codigo: toStatusCodigo(periodo?.status),
    alerta_gerencial: alertaCodigo === 'critico' ? 'Crítico' : alertaCodigo === 'atencao' ? 'Atenção' : 'Em dia',
    alerta_codigo: alertaCodigo,
    alerta_tipo: alertaTipo,
    dias_para_vencimento: diasParaVencimento,
    mensagem_vencimento: mensagemVencimento,
    dias_base: saldos.dias_base,
    dias_ajuste: saldos.dias_ajuste,
    dias_total: saldos.dias_total,
    dias_previstos: saldos.dias_previstos,
    dias_gozados: saldos.dias_gozados,
    dias_saldo: saldos.dias_saldo,
    fracoes: normalizarFeriasFracoes(feriasRelacionadas),
  };
}

function createMilitarResumo(periodos = []) {
  const resumoBase = {
    total: periodos.length,
    critico: 0,
    atencao: 0,
    ok: 0,
    proximo_vencimento: null,
    dias_proximo_vencimento: null,
    alerta_principal: 'success',
  };

  if (!periodos.length) return resumoBase;

  const diasOrdenados = periodos
    .filter((periodo) => typeof periodo.dias_para_vencimento === 'number')
    .sort((a, b) => a.dias_para_vencimento - b.dias_para_vencimento);

  periodos.forEach((periodo) => {
    if (periodo.alerta_codigo === 'critico') resumoBase.critico += 1;
    else if (periodo.alerta_codigo === 'atencao') resumoBase.atencao += 1;
    else resumoBase.ok += 1;
  });

  const proximo = diasOrdenados[0] || null;
  if (proximo) {
    resumoBase.proximo_vencimento = proximo.limite_gozo;
    resumoBase.dias_proximo_vencimento = proximo.dias_para_vencimento;
  }

  if (resumoBase.critico > 0) resumoBase.alerta_principal = 'danger';
  else if (resumoBase.atencao > 0) resumoBase.alerta_principal = 'warning';

  return resumoBase;
}

export function mapPeriodosAquisitivosPorMilitar({ periodos = [], ferias = [] } = {}) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const feriasPorPeriodo = ferias.reduce((acc, item) => {
    if (!item) return acc;

    const keys = [item.periodo_aquisitivo_id, item.periodo_aquisitivo_ref].filter(Boolean);
    keys.forEach((key) => {
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
    });

    return acc;
  }, {});

  const militaresMap = periodos.reduce((acc, periodo) => {
    if (!periodo?.militar_id) return acc;

    if (!acc[periodo.militar_id]) {
      acc[periodo.militar_id] = {
        militar: {
          id: periodo.militar_id,
          nome_guerra: resolveNomeMilitar(periodo),
          posto_graduacao: periodo.militar_posto || '',
          matricula: periodo.militar_matricula || '',
        },
        periodos: [],
      };
    }

    const referencia = getReferenciaPeriodo(periodo);
    const relacionadas = [
      ...(feriasPorPeriodo[periodo.id] || []),
      ...(feriasPorPeriodo[referencia] || []),
    ];

    const unicas = [...new Map(relacionadas.map((item) => [item.id, item])).values()];
    acc[periodo.militar_id].periodos.push(mapPeriodo(periodo, unicas, hoje));

    return acc;
  }, {});

  const militares = Object.values(militaresMap)
    .map((grupo) => {
      const periodosOrdenados = [...grupo.periodos].sort((a, b) => {
        if (!a.data_inicio_aquisitivo || !b.data_inicio_aquisitivo) return 0;
        return b.data_inicio_aquisitivo.localeCompare(a.data_inicio_aquisitivo);
      });

      return {
        militar: grupo.militar,
        resumo: createMilitarResumo(periodosOrdenados),
        periodos: periodosOrdenados,
      };
    })
    .sort((a, b) => a.militar.nome_guerra.localeCompare(b.militar.nome_guerra));

  return { militares };
}
