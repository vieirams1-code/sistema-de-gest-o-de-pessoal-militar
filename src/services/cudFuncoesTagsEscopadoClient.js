import { base44 } from '@/api/base44Client';

function criarErroSemantico(message, extras = {}) {
  const err = new Error(message || 'Falha ao executar operação em funções e tags.');
  Object.assign(err, extras);
  return err;
}

async function invocar(payload) {
  try {
    console.debug('[CUD_FUNCOES_TAGS_REQUEST]', payload);
    const response = await base44.functions.invoke('cudFuncoesTagsEscopado', payload);
    console.debug('[CUD_FUNCOES_TAGS_RESPONSE]', response);
    const body = response?.data ?? response;
    if (body?.error) throw new Error(body.error);
    return body?.data || body;
  } catch (error) {
    console.debug('[CUD_FUNCOES_TAGS_ERROR]', error);
    const status = error?.response?.status;
    const body = error?.response?.data;
    const backendMessage = body?.message || body?.error || body?.details || error?.message;

    if (body?.code === 'TAG_COM_VINCULOS' || body?.code === 'GRUPO_COM_TAGS_ATIVAS') {
      throw criarErroSemantico(backendMessage, {
        code: body?.code,
        militar_id: body?.militar_id,
        militar_nome: body?.militar_nome,
        posto_grad: body?.posto_grad,
        militar_tags: body?.militar_tags,
        ferias_tags: body?.ferias_tags,
        atestado_tags: body?.atestado_tags,
        tags_ativas: body?.tags_ativas,
      });
    }

    if (status === 400) {
      throw criarErroSemantico(backendMessage || 'Requisição inválida ao atualizar catálogo de funções e tags.');
    }

    throw criarErroSemantico(backendMessage || 'Falha ao executar operação em funções e tags.', {
      code: body?.code,
      militar_id: body?.militar_id,
      militar_nome: body?.militar_nome,
      posto_grad: body?.posto_grad,
      militar_tags: body?.militar_tags,
      ferias_tags: body?.ferias_tags,
      atestado_tags: body?.atestado_tags,
    });
  }
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
export const excluirTagGrupoEscopado = (id) => invocar({ entidade: 'TagGrupo', operacao: 'delete', id });

export const criarTagEscopado = (data) => invocar({ entidade: 'Tag', operacao: 'create', data });
export const atualizarTagEscopado = (id, data) => invocar({ entidade: 'Tag', operacao: 'update', id, data });
export const desativarTagEscopado = (id, data) => invocar({ entidade: 'Tag', operacao: 'desativar', id, data });
export const excluirTagEscopado = (id) => invocar({ entidade: 'Tag', operacao: 'delete', id });

