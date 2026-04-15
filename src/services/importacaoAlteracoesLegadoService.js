import { base44 } from '@/api/base44Client';

const ENTITY_NAME = 'ImportacaoAlteracoesLegado';
const ENTITY_ERROR_MESSAGE = 'Falha ao acessar o histórico da migração de alterações legado. Verifique se a entidade ImportacaoAlteracoesLegado está publicada no app.';

function getEntity() {
  const entity = base44?.entities?.[ENTITY_NAME];
  if (!entity) throw new Error(ENTITY_ERROR_MESSAGE);
  return entity;
}

function isSchemaNotFoundError(error) {
  const message = String(error?.message || '');
  return message.includes(`Entity schema ${ENTITY_NAME} not found in app`);
}

async function runWithFriendlyEntityError(operation) {
  try {
    return await operation();
  } catch (error) {
    if (isSchemaNotFoundError(error)) throw new Error(ENTITY_ERROR_MESSAGE);
    throw error;
  }
}

function garantirRetornoHistorico(registro, acao) {
  if (!registro?.id) {
    throw new Error(`Não foi possível ${acao} o histórico da migração legado: resposta sem ID válido.`);
  }
  return registro;
}

export async function criarHistoricoImportacaoAlteracoesLegado(payload) {
  const criado = await runWithFriendlyEntityError(() => getEntity().create(payload));
  return garantirRetornoHistorico(criado, 'criar');
}

export async function atualizarHistoricoImportacaoAlteracoesLegado(id, payload) {
  const atualizado = await runWithFriendlyEntityError(() => getEntity().update(id, payload));
  return garantirRetornoHistorico(atualizado, 'atualizar');
}
