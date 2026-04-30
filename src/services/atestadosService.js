import { sincronizarAtestadoJisoNoQuadro } from '@/components/quadro/quadroHelpers';
import { atualizarEscopado } from '@/services/cudEscopadoClient';

const STATUS_BLOQUEADOS = ['homologado', 'encerrado', 'cancelado', 'finalizado'];

function normalizarTexto(valor) {
  return String(valor || '').trim().toLowerCase();
}

export function isStatusAtestadoBloqueado({ statusJiso, status }) {
  const composto = `${normalizarTexto(statusJiso)} ${normalizarTexto(status)}`;
  return STATUS_BLOQUEADOS.some((chave) => composto.includes(chave));
}

export async function encaminharAtestadoParaJiso(atestado = {}) {
  if (!atestado?.id) throw new Error('Atestado inválido para encaminhamento.');

  const payload = {
    necessita_jiso: true,
    status_jiso: atestado.status_jiso || 'Aguardando JISO',
  };

  await atualizarEscopado('Atestado', atestado.id, payload);
  await sincronizarAtestadoJisoNoQuadro({ ...atestado, ...payload });

  return payload;
}

export async function marcarAtestadoJisoEmAnalise(atestado = {}) {
  if (!atestado?.id) throw new Error('Atestado inválido para marcação.');
  if (!Object.prototype.hasOwnProperty.call(atestado, 'status_jiso')) {
    throw new Error('Campo status_jiso indisponível para este atestado.');
  }

  if (isStatusAtestadoBloqueado({ statusJiso: atestado.status_jiso, status: atestado.status })) {
    throw new Error('Status finalizado/homologado não permite marcação em análise.');
  }

  await atualizarEscopado('Atestado', atestado.id, { status_jiso: 'Em análise' });
}