import { base44 } from './base44Client';

const resolveEntity = (entityName) => {
  try {
    return base44?.entities?.[entityName] || null;
  } catch {
    return null;
  }
};

export const Query = resolveEntity('Query');

export const PunicaoDisciplinar = resolveEntity('PunicaoDisciplinar');
export const TarefaOperacional = resolveEntity('TarefaOperacional');
export const TarefaOperacionalDestinatario = resolveEntity('TarefaOperacionalDestinatario');
export const TarefaOperacionalHistorico = resolveEntity('TarefaOperacionalHistorico');

// auth sdk:
export const User = base44.auth;
