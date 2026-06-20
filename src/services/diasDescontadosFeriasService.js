import { base44 } from '@/api/base44Client';
import { criarEscopado, atualizarEscopado } from './cudEscopadoClient';

export const LIMITE_DIAS_DESCONTADOS_FERIAS = 8;
export const STATUS_DESCONTO_FERIAS = { ATIVO: 'ativo', REVERTIDO: 'revertido', CANCELADO: 'cancelado' };
export const TIPO_RP_DISPENSA_DESCONTO_FERIAS = 'Dispensa com Desconto em Férias';
export const TIPO_RP_TORNAR_SEM_EFEITO = 'Tornar sem Efeito';

const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const id = (v) => String(v || '').trim();
export const isDescontoAtivo = (d) => String(d?.status || '').toLowerCase() === STATUS_DESCONTO_FERIAS.ATIVO;

export function getPeriodoRef(periodo = {}) {
  return periodo.periodo_aquisitivo_ref || periodo.ano_referencia || [periodo.inicio_aquisitivo, periodo.fim_aquisitivo].filter(Boolean).join(' a ') || periodo.id || '';
}

export function getDiasAdquiridos(periodo = {}) { return n(periodo.dias_adquiridos ?? periodo.dias_direito ?? periodo.dias ?? 30); }
export function getDiasAdicionais(periodo = {}) { return n(periodo.dias_adicionais ?? periodo.dias_credito_extra ?? periodo.creditos_extra ?? 0); }
export function getSaldoPeriodo(periodo = {}) { return n(periodo.saldo_disponivel ?? periodo.saldo_atual ?? periodo.saldo ?? periodo.dias_saldo ?? (getDiasAdquiridos(periodo) + getDiasAdicionais(periodo))); }

export function calcularDataFinalDispensa(dataInicial = '', dias = 0) {
  if (!dataInicial || n(dias) <= 0) return '';
  const data = new Date(`${dataInicial}T00:00:00`);
  if (Number.isNaN(data.getTime())) return '';
  data.setDate(data.getDate() + n(dias) - 1);
  return data.toISOString().slice(0, 10);
}

export function periodoDisponivelParaDesconto(periodo = {}, descontos = []) {
  const status = String(periodo.status || periodo.situacao || '').toLowerCase();
  if (['encerrado', 'encerrada', 'cancelado', 'cancelada', 'totalmente_usufruido', 'totalmente usufruído', 'usufruido', 'usufruído'].includes(status)) return false;
  return calcularResumoDescontoPeriodo(periodo, descontos).disponivelParaDesconto > 0;
}

function getDiasDescontadosEntity() {
  const entity = base44?.entities?.DiasDescontadosFerias;
  if (!entity) throw new Error('Entidade DiasDescontadosFerias indisponível. Publique/sincronize o schema no Base44 antes de usar este fluxo.');
  return entity;
}

export function somarDescontosAtivos(descontos = [], periodoId) {
  return (descontos || []).filter((d) => isDescontoAtivo(d) && (!periodoId || id(d.periodo_aquisitivo_id) === id(periodoId))).reduce((t, d) => t + n(d.dias_descontados), 0);
}

export function calcularResumoDescontoPeriodo(periodo = {}, descontos = []) {
  const diasDescontados = somarDescontosAtivos(descontos, periodo.id);
  const limiteRestante = Math.max(0, LIMITE_DIAS_DESCONTADOS_FERIAS - diasDescontados);
  const saldoAtual = getSaldoPeriodo(periodo);
  return { periodo: getPeriodoRef(periodo), saldoAtual, diasDescontados, limiteRestante, disponivelParaDesconto: Math.max(0, Math.min(limiteRestante, saldoAtual)) };
}

export function validarNovoDesconto({ periodo, descontos = [], dias }) {
  const qtd = n(dias);
  const resumo = calcularResumoDescontoPeriodo(periodo, descontos);
  if (qtd <= 0) return { ok: false, message: 'A quantidade de dias descontados deve ser maior que zero.' };
  if (qtd > resumo.limiteRestante) return { ok: false, message: `Este período aquisitivo já possui ${resumo.diasDescontados} dias descontados. Restam apenas ${resumo.limiteRestante} dias disponíveis para desconto.` };
  if (qtd > resumo.saldoAtual) return { ok: false, message: 'O desconto informado ultrapassa o saldo disponível do período aquisitivo.' };
  return { ok: true, resumo };
}

export async function listarDescontosFerias(filtros = {}) {
  const entity = getDiasDescontadosEntity();
  if (filtros.publicacao_id) return entity.filter({ publicacao_id: filtros.publicacao_id });
  if (filtros.militar_id) return entity.filter({ militar_id: filtros.militar_id });
  return entity.list('-data_desconto');
}

async function buscarPublicacaoVinculada(desconto) {
  if (!desconto?.publicacao_id) return null;
  const [publicacao] = await base44.entities.PublicacaoExOfficio.filter({ id: desconto.publicacao_id });
  return publicacao || null;
}

export async function criarDescontoFeriasAutomatico({ militar, periodo, dias, dataDispensa, observacoes = '', usuario = '', textoPublicacao = '' }) {
  const existentesPeriodo = await listarDescontosFerias({ militar_id: militar.id });
  const descontosPeriodo = existentesPeriodo.filter((d) => id(d.periodo_aquisitivo_id) === id(periodo.id));
  const idempotente = descontosPeriodo.find((d) => (
    isDescontoAtivo(d)
    && n(d.dias_descontados) === n(dias)
    && id(d.data_dispensa || d.data_desconto) === id(dataDispensa)
  ));
  if (idempotente) return { desconto: idempotente, publicacao: await buscarPublicacaoVinculada(idempotente), idempotente: true };

  const validacao = validarNovoDesconto({ periodo, descontos: descontosPeriodo, dias });
  if (!validacao.ok) throw new Error(validacao.message);

  const texto = montarTextoDispensaDescontoFerias({
    militar,
    periodoLabel: getPeriodoRef(periodo),
    dias,
    dataDispensa,
  });
  const publicacao = await criarEscopado('PublicacaoExOfficio', {
    militar_id: militar.id,
    militar_nome: militar.nome_completo || militar.nome_guerra || '',
    militar_posto: militar.posto_graduacao || militar.posto || '',
    militar_matricula: militar.matricula || '',
    tipo: TIPO_RP_DISPENSA_DESCONTO_FERIAS,
    data_publicacao: dataDispensa,
    data_registro: dataDispensa,
    status: 'Aguardando Nota',
    texto_publicacao: textoPublicacao || texto,
    observacoes,
    periodo_aquisitivo_id: periodo.id,
    periodo_aquisitivo_ref: getPeriodoRef(periodo),
    dias_descontados: n(dias),
    data_dispensa: dataDispensa,
    origem_operacional: 'DiasDescontadosFerias',
  });
  const saldoAtualAntes = getSaldoPeriodo(periodo);
  const desconto = await criarEscopado('DiasDescontadosFerias', {
    militar_id: militar.id,
    militar_nome: militar.nome_completo || militar.nome_guerra || '',
    militar_posto: militar.posto_graduacao || militar.posto || '',
    militar_matricula: militar.matricula || '',
    periodo_aquisitivo_id: periodo.id,
    periodo_aquisitivo_ref: getPeriodoRef(periodo),
    publicacao_id: publicacao.id,
    publicacao_status: publicacao.status || 'Aguardando Nota',
    dias_descontados: n(dias),
    motivo: observacoes || TIPO_RP_DISPENSA_DESCONTO_FERIAS,
    observacoes,
    data_desconto: dataDispensa,
    data_dispensa: dataDispensa,
    status: STATUS_DESCONTO_FERIAS.ATIVO,
    usuario_criacao: usuario,
    auditoria: [{ acao: 'criacao_dias_descontados', usuario, data_hora: new Date().toISOString(), publicacao_id: publicacao.id, dias_descontados: n(dias) }],
  });
  await atualizarEscopado('PublicacaoExOfficio', publicacao.id, { dias_descontados_ferias_id: desconto.id });
  if (periodo?.id) {
    await atualizarEscopado('PeriodoAquisitivo', periodo.id, {
      dias_descontados: validacao.resumo.diasDescontados + n(dias),
      saldo_disponivel: Math.max(0, saldoAtualAntes - n(dias)),
      ultima_movimentacao_saldo: new Date().toISOString(),
    });
  }
  return { desconto, publicacao, idempotente: false };
}

export async function cancelarOuReverterDescontoFerias({ desconto, motivo = 'Cancelamento/reversão de desconto em férias', usuario = '' }) {
  if (!isDescontoAtivo(desconto)) return desconto;
  const publicacao = await buscarPublicacaoVinculada(desconto);
  if (desconto.periodo_aquisitivo_id) {
    const [periodo] = await base44.entities.PeriodoAquisitivo.filter({ id: desconto.periodo_aquisitivo_id });
    if (periodo?.id) {
      await atualizarEscopado('PeriodoAquisitivo', periodo.id, {
        dias_descontados: Math.max(0, n(periodo.dias_descontados) - n(desconto.dias_descontados)),
        saldo_disponivel: getSaldoPeriodo(periodo) + n(desconto.dias_descontados),
        ultima_movimentacao_saldo: new Date().toISOString(),
      });
    }
  }
  const publicada = Boolean(publicacao?.numero_bg || publicacao?.data_bg || String(publicacao?.status || '').toLowerCase() === 'publicado');
  let publicacaoReversao = null;
  if (publicacao?.id && !publicada) {
    await atualizarEscopado('PublicacaoExOfficio', publicacao.id, { status: 'Cancelado', cancelado: true, motivo_cancelamento: motivo });
  } else if (publicacao?.id) {
    publicacaoReversao = await criarEscopado('PublicacaoExOfficio', {
      militar_id: desconto.militar_id,
      militar_nome: desconto.militar_nome,
      militar_posto: desconto.militar_posto,
      militar_matricula: desconto.militar_matricula,
      tipo: TIPO_RP_TORNAR_SEM_EFEITO,
      data_publicacao: new Date().toISOString().slice(0, 10),
      status: 'Aguardando Nota',
      publicacao_referencia_id: publicacao.id,
      publicacao_referencia_numero_bg: publicacao.numero_bg || '',
      publicacao_referencia_data_bg: publicacao.data_bg || '',
      texto_publicacao: `Torna sem efeito a publicação ${publicacao.numero_bg || publicacao.id}, referente à dispensa com desconto em férias de ${desconto.militar_posto || ''} ${desconto.militar_nome || ''}.`,
      origem_operacional: 'DiasDescontadosFeriasReversao',
    });
  }
  return atualizarEscopado('DiasDescontadosFerias', desconto.id, {
    status: publicada ? STATUS_DESCONTO_FERIAS.REVERTIDO : STATUS_DESCONTO_FERIAS.CANCELADO,
    data_reversao: new Date().toISOString().slice(0, 10),
    motivo_reversao: motivo,
    usuario_reversao: usuario,
    publicacao_reversao_id: publicacaoReversao?.id || '',
    auditoria: [...(desconto.auditoria || []), { acao: publicada ? 'reversao_com_tornar_sem_efeito' : 'cancelamento_publicacao_nao_publicada', usuario, data_hora: new Date().toISOString(), publicacao_id: desconto.publicacao_id, publicacao_reversao_id: publicacaoReversao?.id || '', motivo }],
  });
}

export async function efetivarDescontoPorPublicacao({ publicacao, periodo, descontosPeriodo = [], usuario = '' }) {
  const existentes = await listarDescontosFerias({ publicacao_id: publicacao.id });
  const ativoExistente = existentes.find(isDescontoAtivo);
  if (ativoExistente) return { desconto: ativoExistente, idempotente: true, resumo: calcularResumoDescontoPeriodo(periodo, descontosPeriodo) };
  const dias = n(publicacao.dias_descontados || publicacao.dias);
  const validacao = validarNovoDesconto({ periodo, descontos: descontosPeriodo, dias });
  if (!validacao.ok) throw new Error(validacao.message);
  const saldoAtualAntes = getSaldoPeriodo(periodo);
  const desconto = await criarEscopado('DiasDescontadosFerias', {
    militar_id: publicacao.militar_id, militar_nome: publicacao.militar_nome, militar_posto: publicacao.militar_posto, militar_matricula: publicacao.militar_matricula,
    periodo_aquisitivo_id: periodo.id, periodo_aquisitivo_ref: getPeriodoRef(periodo), publicacao_id: publicacao.id,
    publicacao_numero_bg: publicacao.numero_bg || '', publicacao_data_bg: publicacao.data_bg || '', dias_descontados: dias,
    motivo: publicacao.motivo || publicacao.observacoes || TIPO_RP_DISPENSA_DESCONTO_FERIAS, data_desconto: publicacao.data_dispensa || publicacao.data_registro,
    status: STATUS_DESCONTO_FERIAS.ATIVO, usuario_criacao: usuario, auditoria: [{ acao: 'criacao', usuario, data_hora: new Date().toISOString(), publicacao_id: publicacao.id, dias_descontados: dias }]
  });
  if (periodo?.id) {
    await atualizarEscopado('PeriodoAquisitivo', periodo.id, {
      dias_descontados: validacao.resumo.diasDescontados + dias,
      saldo_disponivel: Math.max(0, saldoAtualAntes - dias),
      ultima_movimentacao_saldo: new Date().toISOString(),
    });
  }
  return { desconto, idempotente: false, resumo: { ...validacao.resumo, diasDescontados: validacao.resumo.diasDescontados + dias, saldoAtual: Math.max(0, saldoAtualAntes - dias) } };
}

export async function reverterDescontoPorPublicacao({ publicacaoId, motivo = 'Reversão automática', usuario = '' }) {
  const descontos = await listarDescontosFerias({ publicacao_id: publicacaoId });
  const ativo = descontos.find(isDescontoAtivo);
  if (!ativo) return null;
  const revertido = await atualizarEscopado('DiasDescontadosFerias', ativo.id, { status: STATUS_DESCONTO_FERIAS.REVERTIDO, data_reversao: new Date().toISOString().slice(0, 10), motivo_reversao: motivo, usuario_reversao: usuario, auditoria: [...(ativo.auditoria || []), { acao: 'reversao', usuario, data_hora: new Date().toISOString(), publicacao_id: publicacaoId, dias_descontados: ativo.dias_descontados, motivo }] });
  if (ativo.periodo_aquisitivo_id) {
    const [periodo] = await base44.entities.PeriodoAquisitivo.filter({ id: ativo.periodo_aquisitivo_id });
    if (periodo?.id) {
      await atualizarEscopado('PeriodoAquisitivo', periodo.id, {
        dias_descontados: Math.max(0, n(periodo.dias_descontados) - n(ativo.dias_descontados)),
        saldo_disponivel: getSaldoPeriodo(periodo) + n(ativo.dias_descontados),
        ultima_movimentacao_saldo: new Date().toISOString(),
      });
    }
  }
  return revertido;
}

export function montarTextoDispensaDescontoFerias({ militar = {}, periodoLabel = '', dias = 0, dataDispensa = '', dataFinalDispensa = '' }) {
  const periodoDispensa = dataFinalDispensa && dataFinalDispensa !== dataDispensa ? `, no período de ${dataDispensa} a ${dataFinalDispensa}` : (dataDispensa ? `, em ${dataDispensa}` : '');
  return `Fica concedida dispensa ao ${militar.posto_graduacao || militar.militar_posto || ''} ${militar.nome_completo || militar.militar_nome || militar.nome_guerra || ''}, matrícula ${militar.matricula || militar.militar_matricula || ''}, com desconto de ${dias} dia(s) em seu período aquisitivo de férias ${periodoLabel}${periodoDispensa}.`.replace(/\s+/g, ' ').trim();
}
