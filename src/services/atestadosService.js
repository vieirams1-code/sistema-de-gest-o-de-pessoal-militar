import { jisoService } from '@/services/jisoService';

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

  return jisoService.criar({ atestadoIds: [atestado.id], jiso: { finalidade_jiso: 'LTS' } });
}

export async function marcarAtestadoJisoEmAnalise() {
  throw new Error('A análise e o resultado devem ser registrados no processo JISO independente.');
}
