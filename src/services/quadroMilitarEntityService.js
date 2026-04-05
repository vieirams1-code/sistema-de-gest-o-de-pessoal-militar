import { base44 } from '@/api/base44Client';

const QUADRO_ENTITY_CANDIDATES = [
  'QuadroMilitar',
  'Quadro',
  'QuadrosMilitares',
];

let resolvedEntityPromise;

function isEntitySchemaNotFound(error) {
  return /Entity schema .* not found in app/i.test(error?.message || '');
}

function normalizeErrorMessage(error) {
  const original = String(error?.message || '').trim();

  if (!original) {
    return 'Não foi possível concluir a operação com quadros. Tente novamente em instantes.';
  }

  if (isEntitySchemaNotFound(error)) {
    return 'O cadastro de quadros está indisponível no momento porque a entidade de dados não foi encontrada. Contate o administrador para revisar o schema do app.';
  }

  return original;
}

async function resolveQuadroEntity() {
  if (!resolvedEntityPromise) {
    resolvedEntityPromise = (async () => {
      for (const entityName of QUADRO_ENTITY_CANDIDATES) {
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
        `Nenhuma entidade de quadro encontrada. Tentativas: ${QUADRO_ENTITY_CANDIDATES.join(', ')}`
      );
    })();
  }

  return resolvedEntityPromise;
}

export async function getQuadroMilitarEntityInfo() {
  return resolveQuadroEntity();
}

export async function listQuadrosMilitares(orderBy = 'nome', limit) {
  const { entity } = await resolveQuadroEntity();
  return entity.list(orderBy, limit);
}

export async function filterQuadrosMilitares(filter = {}, orderBy = 'nome', limit) {
  const { entity } = await resolveQuadroEntity();
  return entity.filter(filter, orderBy, limit);
}

export async function createQuadroMilitar(payload) {
  const { entity } = await resolveQuadroEntity();
  return entity.create(payload);
}

export async function updateQuadroMilitar(id, payload) {
  const { entity } = await resolveQuadroEntity();
  return entity.update(id, payload);
}

export async function deleteQuadroMilitar(id) {
  const { entity } = await resolveQuadroEntity();
  return entity.delete(id);
}

export function getMensagemErroQuadro(error, fallbackMessage) {
  const normalized = normalizeErrorMessage(error);
  return normalized || fallbackMessage || 'Não foi possível concluir a operação com quadros.';
}
