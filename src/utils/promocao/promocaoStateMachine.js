import { statusNormalizado } from '../../services/promocaoService.js';
import { buildPromocaoContext } from './buildPromocaoContext.js';

export const ESTADOS_PROMOCAO = {
  RASCUNHO: 'RASCUNHO',
  EM_EDICAO: 'EM_EDICAO',
  PRONTA_PUBLICAR: 'PRONTA_PUBLICAR',
  PUBLICADA: 'PUBLICADA',
  REVERTIDA: 'REVERTIDA',
  CANCELADA: 'CANCELADA',
};

function hasItemPublicado(item = {}) {
  const status = statusNormalizado(item?.status);
  return Boolean(item?.publicado) || ['publicado', 'publicada', 'consolidado', 'consolidada'].includes(status);
}

function hasItemCanceladoOuRetificado(item = {}) {
  const status = statusNormalizado(item?.status);
  return ['cancelado', 'cancelada', 'retificado', 'retificada'].includes(status);
}

export function getEstadoItemPromocao(item = {}) {
  if (hasItemPublicado(item)) return ESTADOS_PROMOCAO.PUBLICADA;
  if (hasItemCanceladoOuRetificado(item)) return ESTADOS_PROMOCAO.CANCELADA;
  if (statusNormalizado(item?.status) === 'revertido') return ESTADOS_PROMOCAO.REVERTIDA;
  return ESTADOS_PROMOCAO.EM_EDICAO;
}

export function getEstadoPromocao(promocao = {}, itens = []) {
  const status = statusNormalizado(promocao?.status);
  if (['cancelada', 'cancelado'].includes(status)) return ESTADOS_PROMOCAO.CANCELADA;
  if (['publicada', 'publicado', 'consolidada', 'consolidado'].includes(status)) {
    if (Array.isArray(itens) && itens.some((item) => getEstadoItemPromocao(item) === ESTADOS_PROMOCAO.EM_EDICAO)) {
      return ESTADOS_PROMOCAO.PRONTA_PUBLICAR;
    }
    return ESTADOS_PROMOCAO.PUBLICADA;
  }
  if (status === 'revertida' || itens.some((item) => getEstadoItemPromocao(item) === ESTADOS_PROMOCAO.REVERTIDA)) return ESTADOS_PROMOCAO.REVERTIDA;
  if (status === 'rascunho') return ESTADOS_PROMOCAO.RASCUNHO;
  if ((itens || []).length === 0) return ESTADOS_PROMOCAO.EM_EDICAO;
  return ESTADOS_PROMOCAO.PRONTA_PUBLICAR;
}

export function canEditarOrdem(item = {}, contexto = {}) {
  const estado = getEstadoItemPromocao(item);
  const ctx = contexto?.promocaoContext || buildPromocaoContext(contexto?.promocao || {});
  if (!ctx?.promocaoInicio || !ctx?.permiteEdicaoOrdem) return false;
  if (item?.historico_promocao_v2_id) return false;
  return estado === ESTADOS_PROMOCAO.EM_EDICAO;
}

export function canRemoverDaTurma(item = {}, contexto = {}) {
  const estadoItem = getEstadoItemPromocao(item);
  if (estadoItem === ESTADOS_PROMOCAO.PUBLICADA) return false;
  if (item?.historico_promocao_v2_id) return false;
  const estadoPromocao = getEstadoPromocao(contexto?.promocao || {}, contexto?.itens || []);
  return [ESTADOS_PROMOCAO.RASCUNHO, ESTADOS_PROMOCAO.EM_EDICAO, ESTADOS_PROMOCAO.PRONTA_PUBLICAR, ESTADOS_PROMOCAO.REVERTIDA].includes(estadoPromocao);
}

export function canPublicarItem(item = {}) {
  return getEstadoItemPromocao(item) === ESTADOS_PROMOCAO.EM_EDICAO;
}

export function canReverterItem(item = {}, contexto = {}) {
  if (!contexto?.isAdmin) return false;
  return getEstadoItemPromocao(item) === ESTADOS_PROMOCAO.PUBLICADA;
}

export function canExcluirDefinitivo(item = {}, contexto = {}) {
  if (!contexto?.isAdmin) return false;
  return [ESTADOS_PROMOCAO.CANCELADA, ESTADOS_PROMOCAO.REVERTIDA].includes(getEstadoItemPromocao(item));
}
