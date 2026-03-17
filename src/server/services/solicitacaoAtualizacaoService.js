import {
  InvalidAccessConfigurationError,
  resolveCurrentAccessContext,
  secureCreate,
  secureGetById,
  secureList,
  secureUpdate,
} from '@/server/authz';

export function listSolicitacoesAtualizacao(query = {}, options = {}) {
  return secureList('SolicitacaoAtualizacao', query, options);
}

export function getSolicitacaoAtualizacaoById(id, options = {}) {
  return secureGetById('SolicitacaoAtualizacao', id, options);
}

export function createSolicitacaoAtualizacao(payload, options = {}) {
  return secureCreate('SolicitacaoAtualizacao', payload, options);
}

export async function decidirSolicitacaoAtualizacao(id, decisionPayload, options = {}) {
  const context = options.context || await resolveCurrentAccessContext(options);
  if (!context.isAdmin) {
    throw new InvalidAccessConfigurationError(
      'Decisao de solicitacao de atualizacao exige contexto administrativo.',
      { id }
    );
  }

  const solicitacao = await secureGetById('SolicitacaoAtualizacao', id, { ...options, context });
  if (!solicitacao) {
    return null;
  }

  const decision = await secureUpdate('SolicitacaoAtualizacao', id, decisionPayload, {
    ...options,
    context,
    mode: 'decision',
  });

  if (decision?.status === 'Aprovada' && solicitacao.militar_id && solicitacao.campo_chave) {
    await secureUpdate(
      'Militar',
      solicitacao.militar_id,
      { [solicitacao.campo_chave]: solicitacao.valor_proposto },
      {
        ...options,
        context,
        mode: 'approvedSolicitation',
      }
    );
  }

  return decision;
}
