import { normalizarStatusContratoDesignacao, STATUS_CONTRATO_DESIGNACAO } from './contratosDesignacaoMilitarService.js';

const MS_DIA = 86400000;

export const SITUACAO_CONTRATO_DESIGNACAO = {
  ATIVO: 'ativo',
  ATIVO_VENCENDO: 'ativo_vencendo',
  ATIVO_VENCIDO: 'ativo_vencido',
  ENCERRADO: 'encerrado',
  CANCELADO: 'cancelado',
  SEM_DATA_FIM: 'sem_data_fim',
};

export const FILTRO_SITUACAO = {
  TODOS: 'todos',
  ATIVOS: 'ativos',
  ATIVOS_VENCENDO: 'ativos_vencendo',
  ATIVOS_VENCIDOS: 'ativos_vencidos',
  ENCERRADOS: 'encerrados',
  CANCELADOS: 'cancelados',
  SEM_DATA_FIM: 'sem_data_fim',
};

export const FILTRO_VENCIMENTO = {
  TODOS: 'todos',
  VENCIDOS: 'vencidos',
  ATE_30: 'ate_30',
  DE_31_A_60: '31_60',
  DE_61_A_90: '61_90',
  ACIMA_90: 'acima_90',
  SEM_DATA_FIM: 'sem_data_fim',
};

export const FILTRO_LEGADO = {
  TODOS: 'todos',
  APLICADO: 'aplicado',
  PENDENTE: 'pendente',
};

export function normalizarTextoPainelContratos(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function parseDateOnlyPainelContratos(valor) {
  if (!valor) return null;
  const text = String(valor).slice(0, 10);
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calcularDiasParaVencimento(contrato = {}, hoje = new Date()) {
  const fim = parseDateOnlyPainelContratos(contrato?.data_fim_contrato || contrato?.data_encerramento_operacional);
  if (!fim) return null;
  const base = parseDateOnlyPainelContratos(hoje.toISOString?.() || hoje) || hoje;
  return Math.ceil((fim.getTime() - base.getTime()) / MS_DIA);
}

export function calcularSituacaoDerivadaContrato(contrato = {}, hoje = new Date()) {
  const status = normalizarStatusContratoDesignacao(contrato?.status_contrato);
  if (status === STATUS_CONTRATO_DESIGNACAO.ENCERRADO) return SITUACAO_CONTRATO_DESIGNACAO.ENCERRADO;
  if (status === STATUS_CONTRATO_DESIGNACAO.CANCELADO) return SITUACAO_CONTRATO_DESIGNACAO.CANCELADO;

  const dias = calcularDiasParaVencimento(contrato, hoje);
  if (dias === null) return SITUACAO_CONTRATO_DESIGNACAO.SEM_DATA_FIM;
  if (dias < 0) return SITUACAO_CONTRATO_DESIGNACAO.ATIVO_VENCIDO;
  if (dias <= 90) return SITUACAO_CONTRATO_DESIGNACAO.ATIVO_VENCENDO;
  return SITUACAO_CONTRATO_DESIGNACAO.ATIVO;
}

export function classificarVencimentoContrato(contrato = {}, hoje = new Date()) {
  const status = normalizarStatusContratoDesignacao(contrato?.status_contrato);
  if (status !== STATUS_CONTRATO_DESIGNACAO.ATIVO) return FILTRO_VENCIMENTO.TODOS;
  const dias = calcularDiasParaVencimento(contrato, hoje);
  if (dias === null) return FILTRO_VENCIMENTO.SEM_DATA_FIM;
  if (dias < 0) return FILTRO_VENCIMENTO.VENCIDOS;
  if (dias <= 30) return FILTRO_VENCIMENTO.ATE_30;
  if (dias <= 60) return FILTRO_VENCIMENTO.DE_31_A_60;
  if (dias <= 90) return FILTRO_VENCIMENTO.DE_61_A_90;
  return FILTRO_VENCIMENTO.ACIMA_90;
}

export function mapearLegadoPorContrato(periodos = []) {
  return (Array.isArray(periodos) ? periodos : []).reduce((acc, periodo) => {
    if (!periodo?.legado_ativa || !periodo?.legado_ativa_contrato_designacao_id) return acc;
    const contratoId = String(periodo.legado_ativa_contrato_designacao_id);
    const atual = acc[contratoId] || { aplicado: false, totalPeriodos: 0, ultimaAplicacaoEm: null };
    const aplicacao = periodo.legado_ativa_em || periodo.updated_date || periodo.created_date || null;
    acc[contratoId] = {
      aplicado: true,
      totalPeriodos: atual.totalPeriodos + 1,
      ultimaAplicacaoEm: !atual.ultimaAplicacaoEm || (aplicacao && aplicacao > atual.ultimaAplicacaoEm) ? aplicacao : atual.ultimaAplicacaoEm,
    };
    return acc;
  }, {});
}

export function montarTextoBuscaContratoPainel(contrato = {}, militar = {}, matriculas = []) {
  const matriculasTexto = (Array.isArray(matriculas) ? matriculas : [])
    .filter((m) => String(m?.militar_id || '') === String(contrato?.militar_id || militar?.id || ''))
    .map((m) => [m.matricula, m.matricula_normalizada, m.tipo_matricula].filter(Boolean).join(' '));
  return normalizarTextoPainelContratos([
    militar.nome_completo,
    militar.nome_guerra,
    militar.matricula,
    contrato.matricula_designacao,
    contrato.numero_contrato,
    contrato.boletim_publicacao,
    contrato.fonte_legal,
    contrato.tipo_designacao,
    ...matriculasTexto,
  ].filter(Boolean).join(' '));
}

export function aplicarFiltrosPainelContratos(contratos = [], contexto = {}) {
  const militaresPorId = contexto.militaresPorId || {};
  const matriculas = contexto.matriculasMilitar || [];
  const legado = contexto.legadoAtivaPorContrato || {};
  const hoje = contexto.hoje || new Date();
  const busca = normalizarTextoPainelContratos(contexto.busca);
  const filtroSituacao = contexto.situacao || FILTRO_SITUACAO.TODOS;
  const filtroVencimento = contexto.vencimento || FILTRO_VENCIMENTO.TODOS;
  const filtroLegado = contexto.legado || FILTRO_LEGADO.TODOS;

  return (Array.isArray(contratos) ? contratos : []).filter((contrato) => {
    const militar = militaresPorId[String(contrato?.militar_id || '')] || {};
    const situacao = calcularSituacaoDerivadaContrato(contrato, hoje);
    const vencimento = classificarVencimentoContrato(contrato, hoje);
    const legadoInfo = legado[String(contrato?.id || '')] || { aplicado: false };
    const status = normalizarStatusContratoDesignacao(contrato?.status_contrato);

    if (busca && !montarTextoBuscaContratoPainel(contrato, militar, matriculas).includes(busca)) return false;
    if (filtroSituacao === FILTRO_SITUACAO.ATIVOS && status !== STATUS_CONTRATO_DESIGNACAO.ATIVO) return false;
    if (filtroSituacao === FILTRO_SITUACAO.ATIVOS_VENCENDO && situacao !== SITUACAO_CONTRATO_DESIGNACAO.ATIVO_VENCENDO) return false;
    if (filtroSituacao === FILTRO_SITUACAO.ATIVOS_VENCIDOS && situacao !== SITUACAO_CONTRATO_DESIGNACAO.ATIVO_VENCIDO) return false;
    if (filtroSituacao === FILTRO_SITUACAO.ENCERRADOS && situacao !== SITUACAO_CONTRATO_DESIGNACAO.ENCERRADO) return false;
    if (filtroSituacao === FILTRO_SITUACAO.CANCELADOS && situacao !== SITUACAO_CONTRATO_DESIGNACAO.CANCELADO) return false;
    if (filtroSituacao === FILTRO_SITUACAO.SEM_DATA_FIM && situacao !== SITUACAO_CONTRATO_DESIGNACAO.SEM_DATA_FIM) return false;
    if (filtroVencimento !== FILTRO_VENCIMENTO.TODOS && vencimento !== filtroVencimento) return false;
    if (filtroLegado === FILTRO_LEGADO.APLICADO && !legadoInfo.aplicado) return false;
    if (filtroLegado === FILTRO_LEGADO.PENDENTE && legadoInfo.aplicado) return false;
    return true;
  });
}
