import { normalizar, statusNormalizado } from '../../services/promocaoService.js';

const POSTOS_INICIAIS_CANONICOS = new Set([
  'sd', 'soldado', 'cb', 'cabo', '3sgt', '3sargento', '2ten', '2tenente',
]);

export function isPostoDestinoPromocaoInicial(postoGraduacao = '') {
  const bruto = String(postoGraduacao || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[º°]/g, '')
    .replace(/\b([23])o\b/g, '$1')
    .replace(/\./g, ' ')
    .replace(/\bterceiro\b/g, '3')
    .replace(/\bsegundo\b/g, '2')
    .replace(/\s+/g, ' ')
    .trim();
  const canonico = bruto.replace(/\s+/g, '');
  return POSTOS_INICIAIS_CANONICOS.has(canonico);
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

  const promocaoInicio = isPostoDestinoPromocaoInicial(contextoPromocao.posto_graduacao);
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
