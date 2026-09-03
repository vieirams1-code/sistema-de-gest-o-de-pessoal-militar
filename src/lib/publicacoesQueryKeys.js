import { buildAccessScopeKey } from '@/lib/accessScopeKey';

export function buildPublicacoesScopeKey(args = {}) {
  return buildAccessScopeKey(args);
}

export const publicacoesQueryKeys = {
  registrosLivro: (scopeKey) => ['registros-livro', scopeKey],
  exOfficio: (scopeKey) => ['publicacoes-ex-officio', scopeKey],
  atestados: (scopeKey) => ['atestados-publicacao', scopeKey],
  rpLista: (scopeKey) => ['registro-rp-lista', scopeKey],
};
