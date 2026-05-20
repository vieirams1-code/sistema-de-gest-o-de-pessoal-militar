import { ESTADOS_PROMOCAO, getEstadoItemPromocao } from './promocaoStateMachine.js';

const STATUS_PUBLICACAO_OK = new Set(['concluida', 'concluído', 'concluido', 'sucesso', 'publicado', 'publicada']);

function texto(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function normalizar(v) {
  return texto(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isTrueLike(v) {
  return v === true || normalizar(v) === 'true' || normalizar(v) === 'sim';
}

export function deveAtualizarCadastroMilitarPorPromocao({ promocao, item, historico, contextoPublicacao } = {}) {
  const statusPromocao = normalizar(promocao?.status);
  if (statusPromocao === 'rascunho') return false;

  const estadoItem = getEstadoItemPromocao(item || {});
  if (estadoItem !== ESTADOS_PROMOCAO.PUBLICADA) return false;

  const statusHistorico = normalizar(historico?.status_registro);
  if (!texto(historico?.id) || statusHistorico !== 'ativo') return false;

  const efeito = normalizar(item?.resultado_aplicacao_cadastro);
  if (efeito !== 'imediatamente_superior') return false;

  if (!texto(promocao?.posto_graduacao) || !texto(promocao?.quadro)) return false;

  const itemStatus = normalizar(item?.status);
  if (['cancelado', 'cancelada', 'retificado', 'retificada'].includes(itemStatus)) return false;

  if (isTrueLike(item?.somente_turma_operacional) || normalizar(item?.origem) === 'turma_operacional') return false;

  if (isTrueLike(item?.retificacao) || isTrueLike(item?.cancelamento)) return false;

  const publicacaoConcluida = isTrueLike(contextoPublicacao?.publicacaoConcluida)
    || STATUS_PUBLICACAO_OK.has(normalizar(contextoPublicacao?.status));
  if (!publicacaoConcluida) return false;

  const contextoItemId = texto(contextoPublicacao?.itemId || contextoPublicacao?.promocaoMilitarId);
  if (contextoItemId && contextoItemId !== texto(item?.id)) return false;

  const contextoPromocaoId = texto(contextoPublicacao?.promocaoId);
  if (contextoPromocaoId && contextoPromocaoId !== texto(promocao?.id)) return false;

  return true;
}
