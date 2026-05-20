import { normalizar, statusNormalizado } from '../../services/promocaoService.js';



const POSTOS_INICIO_CADEIA = new Set(['soldado', 'sd', 'cabo', 'cb', '3 sgt', '3º sgt', '3o sgt', '3° sgt']);

function isInicioCadeiaPorPosto(postoGraduacao = '') {
  const postoNormalizado = normalizar(String(postoGraduacao || '')).replace(/\s+/g, ' ').trim();
  return POSTOS_INICIO_CADEIA.has(postoNormalizado);
}

function normalizarStatusHistorico(promocao = {}) {
  if (promocao?.publicado === true) return 'publicado';
  const status = statusNormalizado(promocao?.status);
  if (status === 'cancelado' || status === 'retificado') return 'cancelado';
  if (status === 'publicado' || status === 'publicada' || status === 'consolidado' || status === 'consolidada') return 'publicado';
  return 'rascunho';
}

function normalizarStatusOperacional(promocao = {}) {
  const historico = normalizarStatusHistorico(promocao);
  if (historico === 'cancelado') return 'cancelado';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataPromocao = promocao?.data_promocao ? new Date(promocao.data_promocao) : null;

  if (historico === 'publicado') {
    if (dataPromocao instanceof Date && !Number.isNaN(dataPromocao.getTime()) && dataPromocao > hoje) return 'futura';
    return 'publicado';
  }

  if (dataPromocao instanceof Date && !Number.isNaN(dataPromocao.getTime()) && dataPromocao < hoje) return 'historica';
  if (dataPromocao instanceof Date && !Number.isNaN(dataPromocao.getTime()) && dataPromocao > hoje) return 'futura';
  return 'rascunho';
}

export function buildPromocaoContext(promocao = {}) {
  const posto = promocao?.posto_graduacao || '';
  const quadro = promocao?.quadro || '';
  const contextoPromocao = { ...promocao, posto_graduacao: posto, quadro };

  const promocaoInicio = isInicioCadeiaPorPosto(contextoPromocao.posto_graduacao);
  const promocaoSucessiva = !promocaoInicio;
  const statusHistorico = normalizarStatusHistorico(promocao);
  const statusOperacional = normalizarStatusOperacional(promocao);

  const permiteOrdenacao = promocaoSucessiva;
  const permiteEdicaoOrdem = promocaoInicio;

  return {
    tipoFluxo: promocaoInicio ? 'inicio_cadeia' : 'sucessiva',
    promocaoInicio,
    promocaoSucessiva,
    permiteOrdenacao,
    permiteEdicaoOrdem,
    statusOperacional: normalizar(statusOperacional),
    statusHistorico: normalizar(statusHistorico),
  };
}

export default buildPromocaoContext;
