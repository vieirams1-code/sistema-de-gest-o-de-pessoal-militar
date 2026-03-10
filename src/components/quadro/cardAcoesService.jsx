import { base44 } from '@/api/base44Client';

const entity = base44.entities.CardAcao;

export async function listCardAcoes(cardId) {
  return entity.filter({ card_id: cardId }, 'ordem', 200);
}

export async function createCardAcao(payload) {
  return entity.create(payload);
}

export async function updateCardAcao(acaoId, payload) {
  return entity.update(acaoId, payload);
}

export async function deleteCardAcao(acaoId) {
  return entity.delete(acaoId);
}