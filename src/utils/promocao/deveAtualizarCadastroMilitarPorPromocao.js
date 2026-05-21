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
  const bloquear = (motivo) => ({ permitido: false, motivo });
  const statusPromocao = normalizar(promocao?.status);
  if (statusPromocao === 'rascunho') return bloquear('nao_publicado');

  const estadoItem = getEstadoItemPromocao(item || {});
  if (estadoItem !== ESTADOS_PROMOCAO.PUBLICADA) return bloquear('estado_invalido');

  const statusHistorico = normalizar(historico?.status_registro);
  if (!texto(historico?.id)) return bloquear('historico_inexistente');
  if (statusHistorico !== 'ativo') return bloquear('sem_historico_ativo');

  const efeito = normalizar(item?.resultado_aplicacao_cadastro);
  if (efeito !== 'imediatamente_superior') return bloquear('efeito_nao_imediatamente_superior');

  if (!texto(promocao?.posto_graduacao) || !texto(promocao?.quadro)) return bloquear('contexto_invalido');

  const itemStatus = normalizar(item?.status);
  if (['cancelado', 'cancelada', 'retificado', 'retificada'].includes(itemStatus)) return bloquear('estado_invalido');

  if (isTrueLike(item?.somente_turma_operacional) || normalizar(item?.origem) === 'turma_operacional') return bloquear('estado_invalido');

  if (isTrueLike(item?.retificacao) || isTrueLike(item?.cancelamento)) return bloquear('estado_invalido');

  const publicacaoConcluida = isTrueLike(contextoPublicacao?.publicacaoConcluida)
    || STATUS_PUBLICACAO_OK.has(normalizar(contextoPublicacao?.status));
  if (!publicacaoConcluida) return bloquear('nao_publicado');

  const contextoItemId = texto(contextoPublicacao?.itemId || contextoPublicacao?.promocaoMilitarId);
  if (contextoItemId && contextoItemId !== texto(item?.id)) return bloquear('contexto_invalido');

  const contextoPromocaoId = texto(contextoPublicacao?.promocaoId);
  if (contextoPromocaoId && contextoPromocaoId !== texto(promocao?.id)) return bloquear('contexto_invalido');

  return { permitido: true, motivo: 'permitido' };
}
