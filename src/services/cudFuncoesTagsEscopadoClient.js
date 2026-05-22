import { base44 } from '@/api/base44Client';

async function invocar(payload) {
  const response = await base44.functions.invoke('cudFuncoesTagsEscopado', payload);
  const body = response?.data ?? response;
  if (body?.error) throw new Error(body.error);
  return body?.data || body;
}

export const criarMilitarFuncaoEscopado = (data) => invocar({ entidade: 'MilitarFuncao', operacao: 'create', data });
export const atualizarMilitarFuncaoEscopado = (id, data) => invocar({ entidade: 'MilitarFuncao', operacao: 'update', id, data });
export const encerrarMilitarFuncaoEscopado = (id, data) => invocar({ entidade: 'MilitarFuncao', operacao: 'encerrar', id, data });
export const criarMilitarTagEscopado = (data) => invocar({ entidade: 'MilitarTag', operacao: 'create', data });
export const removerMilitarTagEscopado = (id, data) => invocar({ entidade: 'MilitarTag', operacao: 'remover', id, data });
export const criarFeriasTagEscopado = (data) => invocar({ entidade: 'FeriasTag', operacao: 'create', data });
export const removerFeriasTagEscopado = (id, data) => invocar({ entidade: 'FeriasTag', operacao: 'remover', id, data });

export const criarFuncaoMilitarEscopado = (data) => invocar({ entidade: 'FuncaoMilitar', operacao: 'create', data });
export const atualizarFuncaoMilitarEscopado = (id, data) => invocar({ entidade: 'FuncaoMilitar', operacao: 'update', id, data });
export const desativarFuncaoMilitarEscopado = (id, data) => invocar({ entidade: 'FuncaoMilitar', operacao: 'desativar', id, data });

export const criarTagGrupoEscopado = (data) => invocar({ entidade: 'TagGrupo', operacao: 'create', data });
export const atualizarTagGrupoEscopado = (id, data) => invocar({ entidade: 'TagGrupo', operacao: 'update', id, data });
export const desativarTagGrupoEscopado = (id, data) => invocar({ entidade: 'TagGrupo', operacao: 'desativar', id, data });

export const criarTagEscopado = (data) => invocar({ entidade: 'Tag', operacao: 'create', data });
export const atualizarTagEscopado = (id, data) => invocar({ entidade: 'Tag', operacao: 'update', id, data });
export const desativarTagEscopado = (id, data) => invocar({ entidade: 'Tag', operacao: 'desativar', id, data });
