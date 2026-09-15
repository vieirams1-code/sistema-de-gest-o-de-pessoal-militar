import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Id',
};

const CHUNK_SCOPE = 450;
const CHUNK_MILITARES = 200;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
  });
}

function texto(value: unknown): string {
  return String(value ?? '').trim();
}

function erroMensagem(error: any, fallback: string): string {
  return error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback;
}

async function resolverPermissoes(base44: any, scopeMilitarIds?: string[]) {
  const payload = Array.isArray(scopeMilitarIds) ? { scopeMilitarIds } : {};
  const response = await base44.functions.invoke('getUserPermissions', payload);
  return response?.data ?? response ?? {};
}

function isAdminReal(authz: any): boolean {
  return authz?.isAdminByRole === true || authz?.isAdmin === true;
}

function podeVisualizar(authz: any): boolean {
  return isAdminReal(authz)
    || authz?.actions?.visualizar_solicitacoes_cadastrais === true
    || authz?.actions?.decidir_solicitacoes_cadastrais === true;
}

function podeDecidir(authz: any): boolean {
  return isAdminReal(authz) || authz?.actions?.decidir_solicitacoes_cadastrais === true;
}

async function idsPermitidosNoEscopo(base44: any, authzBase: any, militarIds: string[]): Promise<Set<string> | null> {
  if (isAdminReal(authzBase) || authzBase?.hasGlobalScope === true) return null;
  const idsUnicos = [...new Set((militarIds || []).map(texto).filter(Boolean))];
  const permitidos = new Set<string>();

  for (let i = 0; i < idsUnicos.length; i += CHUNK_SCOPE) {
    const chunk = idsUnicos.slice(i, i + CHUNK_SCOPE);
    const authzEscopo = await resolverPermissoes(base44, chunk);
    const allowed = authzEscopo?.scopeCheck?.allowedIds || [];
    for (const id of allowed) permitidos.add(String(id));
  }
  return permitidos;
}

async function militarEstaNoEscopo(base44: any, authzBase: any, militarId: string): Promise<boolean> {
  if (!militarId) return false;
  if (isAdminReal(authzBase) || authzBase?.hasGlobalScope === true) return true;
  const authzEscopo = await resolverPermissoes(base44, [militarId]);
  return authzEscopo?.scopeCheck?.allowedIds?.map(String).includes(String(militarId)) === true;
}

async function enriquecerMilitares(base44: any, solicitacoes: any[]): Promise<any[]> {
  const militarIds = [...new Set((solicitacoes || []).map((s: any) => texto(s?.militar_id)).filter(Boolean))];
  if (!militarIds.length) return solicitacoes || [];

  const militares: any[] = [];
  for (let i = 0; i < militarIds.length; i += CHUNK_MILITARES) {
    const chunk = militarIds.slice(i, i + CHUNK_MILITARES);
    const rows = await base44.asServiceRole.entities.Militar.filter(
      { id: { $in: chunk } },
      undefined,
      chunk.length,
      0,
      ['id', 'nome_completo', 'nome_guerra', 'posto_graduacao', 'matricula', 'lotacao', 'estrutura_nome'],
    ).catch(() => []);
    militares.push(...(rows || []));
  }

  const porId = new Map(militares.map((m: any) => [String(m.id), m]));
  return (solicitacoes || []).map((sol: any) => {
    const militar = porId.get(String(sol?.militar_id || '')) || {};
    return {
      ...sol,
      militar_nome: sol?.militar_nome || militar?.nome_completo || militar?.nome_guerra || '',
      militar_posto: sol?.militar_posto || militar?.posto_graduacao || '',
      militar_matricula: sol?.militar_matricula || militar?.matricula || '',
      militar_lotacao: militar?.lotacao || militar?.estrutura_nome || '',
    };
  });
}

function montarAtualizacaoMilitar(campoChave: string, valorFinal: any): Record<string, any> {
  const campo = texto(campoChave).toLowerCase();
  const updatePayload: Record<string, any> = {
    data_ultima_conferencia: new Date().toISOString().slice(0, 10),
  };

  if (campo === 'logradouro' || campo === 'endereco' || campo === 'endereco_logradouro') {
    updatePayload.logradouro = valorFinal;
  } else if (campo === 'numero_endereco' || campo === 'numero' || campo === 'endereco_numero') {
    updatePayload.numero_endereco = valorFinal;
  } else if (campo === 'bairro' || campo === 'endereco_bairro') {
    updatePayload.bairro = valorFinal;
  } else if (campo === 'cidade' || campo === 'municipio' || campo === 'endereco_cidade') {
    updatePayload.cidade = valorFinal;
  } else if (campo === 'cep' || campo === 'endereco_cep') {
    updatePayload.cep = valorFinal;
  } else if (campo === 'uf' || campo === 'endereco_uf') {
    updatePayload.uf = valorFinal;
  } else if (campo === 'complemento' || campo === 'endereco_complemento') {
    updatePayload.complemento = valorFinal;
  } else if (campo === 'telefone_celular' || campo === 'celular' || campo === 'telefone') {
    updatePayload.telefone = valorFinal;
    updatePayload.telefone_celular = valorFinal;
  } else if (campo === 'email_funcional') {
    updatePayload.email_funcional = valorFinal;
  } else if (campo === 'email_particular' || campo === 'email') {
    updatePayload.email_particular = valorFinal;
  } else if (campo) {
    updatePayload[campoChave] = valorFinal;
  }
  return updatePayload;
}

async function listar(base44: any, authz: any, statusFiltroRaw: unknown) {
  if (!podeVisualizar(authz)) {
    return json({ error: 'Sem permissão para visualizar solicitações cadastrais.' }, 403);
  }

  const statusFiltro = texto(statusFiltroRaw);
  let solicitacoes: any[] = [];
  if (statusFiltro && statusFiltro.toLowerCase() !== 'todos') {
    solicitacoes = await base44.asServiceRole.entities.SolicitacaoAtualizacao.filter({ status: statusFiltro });
  } else {
    solicitacoes = await base44.asServiceRole.entities.SolicitacaoAtualizacao.list('-data_solicitacao');
  }

  const ids = (solicitacoes || []).map((s: any) => texto(s?.militar_id)).filter(Boolean);
  const permitidos = await idsPermitidosNoEscopo(base44, authz, ids);
  const escopadas = permitidos === null
    ? (solicitacoes || [])
    : (solicitacoes || []).filter((s: any) => permitidos.has(String(s?.militar_id || '')));

  const enriquecidas = await enriquecerMilitares(base44, escopadas);
  enriquecidas.sort((a: any, b: any) => {
    const db = new Date(b?.created_date || b?.data_solicitacao || 0).getTime();
    const da = new Date(a?.created_date || a?.data_solicitacao || 0).getTime();
    return db - da;
  });

  return json({ ok: true, solicitacoes: enriquecidas });
}

async function decidirUma(base44: any, authz: any, payload: any, user: any) {
  if (!podeDecidir(authz)) return json({ error: 'Sem permissão para decidir solicitações cadastrais.' }, 403);

  const solicitacaoId = texto(payload?.solicitacao_id);
  const decisao = texto(payload?.decisao);
  if (!solicitacaoId || !['Aprovada', 'Rejeitada'].includes(decisao)) {
    return json({ error: 'Solicitação e decisão válidas são obrigatórias.' }, 400);
  }

  const sol = await base44.asServiceRole.entities.SolicitacaoAtualizacao.get(solicitacaoId).catch(() => null);
  if (!sol) return json({ error: 'Solicitação não encontrada.' }, 404);
  if (!await militarEstaNoEscopo(base44, authz, String(sol.militar_id || ''))) {
    return json({ error: 'Acesso negado: militar fora do escopo organizacional do gestor.' }, 403);
  }

  const foiEditado = payload?.valor_corrigido !== undefined
    && payload?.valor_corrigido !== null
    && payload.valor_corrigido !== sol.valor_proposto;
  const valorFinal = foiEditado ? payload.valor_corrigido : sol.valor_proposto;

  const solUpdate: Record<string, any> = {
    status: decisao,
    data_decisao: new Date().toISOString().slice(0, 10),
    usuario_decisao: user?.email || 'RH / Comando',
    observacao_decisao: texto(payload?.observacao) || (foiEditado ? `Retificado pelo gestor (original: "${sol.valor_proposto}")` : ''),
  };
  if (foiEditado) {
    solUpdate.valor_original_militar = sol.valor_proposto;
    solUpdate.valor_proposto = valorFinal;
    solUpdate.editado_pelo_gestor = true;
  }

  const solicitacao = await base44.asServiceRole.entities.SolicitacaoAtualizacao.update(solicitacaoId, solUpdate);
  let militarAtualizado: any = null;
  if (decisao === 'Aprovada' && sol.militar_id && sol.campo_chave) {
    militarAtualizado = await base44.asServiceRole.entities.Militar.update(
      sol.militar_id,
      montarAtualizacaoMilitar(sol.campo_chave, valorFinal),
    );
  }

  return json({ ok: true, solicitacao, militar_atualizado: militarAtualizado });
}

async function decidirLote(base44: any, authz: any, payload: any, user: any) {
  if (!podeDecidir(authz)) return json({ error: 'Sem permissão para decidir solicitações cadastrais.' }, 403);

  const militarId = texto(payload?.militar_id);
  const decisao = texto(payload?.decisao);
  if (!militarId || !['Aprovada', 'Rejeitada'].includes(decisao)) {
    return json({ error: 'Militar e decisão válidos são obrigatórios.' }, 400);
  }
  if (!await militarEstaNoEscopo(base44, authz, militarId)) {
    return json({ error: 'Acesso negado: militar fora do escopo organizacional do gestor.' }, 403);
  }

  const itens = Array.isArray(payload?.itens_decisao) ? payload.itens_decisao : [];
  if (!itens.length) return json({ error: 'Nenhuma solicitação foi informada para decisão em lote.' }, 400);

  const updateMilitar: Record<string, any> = {
    data_ultima_conferencia: new Date().toISOString().slice(0, 10),
  };
  const atualizadas: any[] = [];

  for (const item of itens) {
    const solicitacaoId = texto(item?.solicitacao_id);
    if (!solicitacaoId) continue;
    const sol = await base44.asServiceRole.entities.SolicitacaoAtualizacao.get(solicitacaoId).catch(() => null);
    if (!sol || String(sol.militar_id || '') !== militarId) continue;

    const foiEditado = item?.valor_corrigido !== undefined
      && item?.valor_corrigido !== null
      && item.valor_corrigido !== sol.valor_proposto;
    const valorFinal = foiEditado ? item.valor_corrigido : sol.valor_proposto;
    const solUpdate: Record<string, any> = {
      status: decisao,
      data_decisao: new Date().toISOString().slice(0, 10),
      usuario_decisao: user?.email || 'RH / Comando',
      observacao_decisao: texto(item?.observacao || payload?.observacao) || (foiEditado ? `Retificado pelo gestor (original: "${sol.valor_proposto}")` : ''),
    };
    if (foiEditado) {
      solUpdate.valor_original_militar = sol.valor_proposto;
      solUpdate.valor_proposto = valorFinal;
      solUpdate.editado_pelo_gestor = true;
    }

    const atualizada = await base44.asServiceRole.entities.SolicitacaoAtualizacao.update(sol.id, solUpdate);
    atualizadas.push(atualizada);

    if (decisao === 'Aprovada' && sol.campo_chave) {
      Object.assign(updateMilitar, montarAtualizacaoMilitar(sol.campo_chave, valorFinal));
    }
  }

  let militarAtualizado: any = null;
  if (decisao === 'Aprovada' && Object.keys(updateMilitar).length > 1) {
    militarAtualizado = await base44.asServiceRole.entities.Militar.update(militarId, updateMilitar);
  }

  return json({ ok: true, solicitacoes: atualizadas, militar_atualizado: militarAtualizado });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return json({ error: 'Usuário não autenticado no SGP.' }, 401);

    const payload = await req.json().catch(() => ({}));
    const action = texto(payload?.action || payload?.acao).toUpperCase();
    const authz = await resolverPermissoes(base44);

    if (authz?.error && !authz?.user) {
      return json({ error: authz.error || 'Falha ao resolver permissões do usuário.' }, 403);
    }

    if (action === 'LISTAR' || action === 'LIST') return await listar(base44, authz, payload?.status);
    if (action === 'DECIDIR') return await decidirUma(base44, authz, payload, user);
    if (action === 'DECIDIR_LOTE') return await decidirLote(base44, authz, payload, user);

    return json({ error: 'Ação inválida no gateway de Solicitações Cadastrais.' }, 400);
  } catch (error: any) {
    console.error('[solicitacoesCadastraisGateway]', error?.message || error);
    return json({ error: erroMensagem(error, 'Erro interno no gateway de Solicitações Cadastrais.') }, Number(error?.status || error?.response?.status || 500));
  }
});
