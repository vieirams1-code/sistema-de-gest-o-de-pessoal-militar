import { base44 } from './base44Client';

function resolveEntity(aliases) {
  for (const alias of aliases) {
    if (base44.entities?.[alias]) return base44.entities[alias];
  }
  return undefined;
}

export const Query = base44.entities.Query;

export const PunicaoDisciplinar = base44.entities.PunicaoDisciplinar;
export const TarefaOperacional = resolveEntity(['TarefaOperacional', 'TarefasOperacionais', 'tarefaOperacional']);
export const TarefaOperacionalDestinatario = resolveEntity([
  'TarefaOperacionalDestinatario',
  'TarefaOperacionalDestinatarios',
  'tarefaOperacionalDestinatario',
]);
export const TarefaOperacionalHistorico = resolveEntity([
  'TarefaOperacionalHistorico',
  'TarefaOperacionalHistoricos',
  'tarefaOperacionalHistorico',
]);

// auth sdk:
export const User = base44.auth;
