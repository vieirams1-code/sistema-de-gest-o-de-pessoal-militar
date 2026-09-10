import { base44 } from '../api/base44Client.js';

async function invoke(action, payload = {}) {
  const response = await base44.functions.invoke('importacaoMilitaresHistoricoGateway', { action, payload });
  const body = response?.data ?? response ?? {};
  if (body?.error) {
    const error = new Error(body.error);
    if (body?.status) error.status = body.status;
    throw error;
  }
  return body?.result ?? null;
}

export function listarHistoricoImportacaoMilitaresGateway() {
  return invoke('LIST_HISTORY');
}

export function obterAnaliseImportacaoMilitaresGateway(id) {
  return invoke('GET_ANALYSIS', { id });
}

export function criarHistoricoImportacaoMilitaresGateway(data) {
  return invoke('CREATE', { data });
}

export function atualizarHistoricoImportacaoMilitaresGateway(id, data) {
  return invoke('UPDATE', { id, data });
}

export function excluirHistoricoImportacaoMilitaresGateway(id) {
  return invoke('DELETE', { id });
}

export function migrarSnapshotsFinalizadosImportacaoMilitaresGateway() {
  return invoke('MIGRATE_FINALIZED_SNAPSHOTS');
}
