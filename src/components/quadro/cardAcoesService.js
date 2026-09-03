import { base44 } from '@/api/base44Client';
import { criarEscopado, atualizarEscopado, excluirEscopado } from '@/services/cudEscopadoClient';

const CARD_ACAO_ENTITY_CANDIDATES = [
  'CardAcao',
  'CardAcaoOperacional',
  'CardAcoes',
  'CardOperacionalAcao',
  'AcaoCard',
];

let resolvedEntityPromise;

function isEntitySchemaNotFound(error) {
  return /Entity schema .* not found in app/i.test(error?.message || '');
}

async function resolveCardAcoesEntity() {
  if (!resolvedEntityPromise) {
    resolvedEntityPromise = (async () => {
      for (const entityName of CARD_ACAO_ENTITY_CANDIDATES) {
        const entity = base44.entities[entityName];
        if (!entity) continue;

        try {
          await entity.list(undefined, 1);
          return { entity, entityName };
        } catch (error) {
          if (isEntitySchemaNotFound(error)) {
            continue;
          }
          return { entity, entityName };
        }
      }

      throw new Error(
        `Nenhuma entidade de ações de card encontrada. Tentativas: ${CARD_ACAO_ENTITY_CANDIDATES.join(', ')}`
      );
    })();
  }

  return resolvedEntityPromise;
}

export async function getCardAcoesEntityInfo() {
  return resolveCardAcoesEntity();
}

export async function listCardAcoes(cardId) {
  const { entity } = await resolveCardAcoesEntity();
  return entity.filter({ card_id: cardId }, 'ordem', 200);
}

export async function listAllCardAcoes(limit = 2000) {
  const { entity } = await resolveCardAcoesEntity();
  return entity.list('-created_date', limit);
}

export async function createCardAcao(payload) {
  const { entityName } = await resolveCardAcoesEntity();
  if (entityName !== 'CardAcao') throw new Error(`Entidade de ações não homologada para escrita segura: ${entityName}`);
  return criarEscopado('CardAcao', payload);
}

export async function updateCardAcao(acaoId, payload) {
  const { entityName } = await resolveCardAcoesEntity();
  if (entityName !== 'CardAcao') throw new Error(`Entidade de ações não homologada para escrita segura: ${entityName}`);
  return atualizarEscopado('CardAcao', acaoId, payload);
}

export async function deleteCardAcao(acaoId) {
  const { entityName } = await resolveCardAcoesEntity();
  if (entityName !== 'CardAcao') throw new Error(`Entidade de ações não homologada para escrita segura: ${entityName}`);
  return excluirEscopado('CardAcao', acaoId);
}