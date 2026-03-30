import { base44 } from '@/api/base44Client';

const CANDIDATOS = {
  tarefa: ['TarefaOperacional', 'TarefasOperacionais', 'Tarefa_Operacional'],
  destinatario: ['TarefaOperacionalDestinatario', 'TarefaOperacionalDestinatarios', 'Tarefa_Operacional_Destinatario'],
  historico: ['TarefaOperacionalHistorico', 'TarefaOperacionalHistoricos', 'Tarefa_Operacional_Historico'],
};

const cache = {};

function isEntitySchemaNotFound(error) {
  return /Entity schema .* not found in app/i.test(error?.message || '');
}

async function resolveEntity(tipo, obrigatoria = true) {
  const cacheKey = `${tipo}:${obrigatoria ? 'required' : 'optional'}`;
  if (cache[cacheKey]) return cache[cacheKey];

  cache[cacheKey] = (async () => {
    const candidatos = CANDIDATOS[tipo] || [];

    for (const nome of candidatos) {
      const entity = base44.entities[nome];
      if (!entity) continue;

      try {
        await entity.list(undefined, 1);
        return entity;
      } catch (error) {
        if (isEntitySchemaNotFound(error)) continue;
        return entity;
      }
    }

    if (!obrigatoria) return null;

    throw new Error(
      `Entidade do módulo Tarefas Operacionais não encontrada no schema publicado. ` +
      `Tentativas: ${candidatos.join(', ')}.`
    );
  })();

  return cache[cacheKey];
}

export function getTarefaOperacionalEntity() {
  return resolveEntity('tarefa', true);
}

export function getTarefaOperacionalDestinatarioEntity() {
  return resolveEntity('destinatario', true);
}

export function getTarefaOperacionalHistoricoEntity() {
  return resolveEntity('historico', false);
}

export function normalizeTipoEstrutura(itemOrTipo) {
  const tipo = typeof itemOrTipo === 'string' ? itemOrTipo : itemOrTipo?.tipo;
  const nivel = typeof itemOrTipo === 'object' ? itemOrTipo?.nivel_hierarquico : undefined;

  if (tipo === 'Setor' || tipo === 'Grupamento') return 'Setor';
  if (tipo === 'Subsetor' || tipo === 'Subgrupamento') return 'Subsetor';
  if (tipo === 'Unidade') return 'Unidade';
  if (nivel === 1) return 'Setor';
  if (nivel === 2) return 'Subsetor';
  if (nivel === 3) return 'Unidade';

  return 'Setor';
}
