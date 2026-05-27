import { buildScopeKey } from './buildScopeKey';

export const queryKeys = {
  lotacoes: {
    root: (scope) => ['lotacoes', buildScopeKey(scope)],
  },
  funcoes: {
    root: (scope) => ['funcoes', buildScopeKey(scope)],
  },
  cards: {
    root: (scope) => ['cards', buildScopeKey(scope)],
  },
  ferias: {
    edicao: (scope) => ['ferias', 'edicao', buildScopeKey(scope)],
  },
};

export default queryKeys;
