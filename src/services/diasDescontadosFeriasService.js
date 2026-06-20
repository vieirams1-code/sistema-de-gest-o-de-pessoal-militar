import { base44 } from '@/api/base44Client';
import { criarEscopado, atualizarEscopado } from './cudEscopadoClient';

export const LIMITE_DIAS_DESCONTADOS_FERIAS = 8;
export const STATUS_DESCONTO_FERIAS = { ATIVO: 'ativo', REVERTIDO: 'revertido', CANCELADO: 'cancelado' };
export const TIPO_RP_DISPENSA_DESCONTO_FERIAS = 'Dispensa com Desconto em Férias';

const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const id = (v) => String(v || '').trim();
export const isDescontoAtivo = (d) => String(d?.status || '').toLowerCase() === STATUS_DESCONTO_FERIAS.ATIVO;

export function getPeriodoRef(periodo = {}) {
  return periodo.periodo_aquisitivo_ref || periodo.ano_referencia || [periodo.inicio_aquisitivo, periodo.fim_aquisitivo].filter(Boolean).join(' a ') || periodo.id || '';
}

export function getDiasAdquiridos(periodo = {}) { return n(periodo.dias_adquiridos ?? periodo.dias_direito ?? periodo.dias ?? 30); }
export function getDiasAdicionais(periodo = {}) { return n(periodo.dias_adicionais ?? periodo.dias_credito_extra ?? periodo.creditos_extra ?? 0); }
export function getSaldoPeriodo(periodo = {}) { return n(periodo.saldo_disponivel ?? periodo.saldo_atual ?? periodo.saldo ?? (getDiasAdquiridos(periodo) + getDiasAdicionais(periodo))); }

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
  if (filtros.publicacao_id) return base44.entities.DiasDescontadosFerias.filter({ publicacao_id: filtros.publicacao_id });
  if (filtros.militar_id) return base44.entities.DiasDescontadosFerias.filter({ militar_id: filtros.militar_id });
  return base44.entities.DiasDescontadosFerias.list('-data_desconto');
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
    motivo: publicacao.fundamentacao || publicacao.motivo || publicacao.observacoes || TIPO_RP_DISPENSA_DESCONTO_FERIAS, data_desconto: publicacao.data_dispensa || publicacao.data_registro,
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

export function montarTextoDispensaDescontoFerias({ militar = {}, periodoLabel = '', dias = 0, dataDispensa = '', fundamentacao = '' }) {
  return `Fica concedida dispensa ao ${militar.posto_graduacao || militar.militar_posto || ''} ${militar.nome_completo || militar.militar_nome || militar.nome_guerra || ''}, matrícula ${militar.matricula || militar.militar_matricula || ''}, com desconto de ${dias} dia(s) em seu período aquisitivo de férias ${periodoLabel}, conforme fundamentação constante no respectivo processo administrativo.${fundamentacao ? ` Fundamentação: ${fundamentacao}.` : ''}${dataDispensa ? ` Data da dispensa: ${dataDispensa}.` : ''}`.replace(/\s+/g, ' ').trim();
}
