import { base44 } from '@/api/base44Client';

const ENTITY_NAME = 'ImportacaoAlteracoesLegado';
const ENTITY_ERROR_MESSAGE = 'Falha ao acessar histórico da migração legada. Verifique se a entidade ImportacaoAlteracoesLegado foi publicada no app.';

function getEntity() {
  const entity = base44?.entities?.[ENTITY_NAME];
  if (!entity) throw new Error(ENTITY_ERROR_MESSAGE);
  return entity;
}

export async function criarHistoricoImportacaoAlteracoesLegado(payload) {
  return getEntity().create(payload);
}

export async function atualizarHistoricoImportacaoAlteracoesLegado(id, payload) {
  return getEntity().update(id, payload);
}
