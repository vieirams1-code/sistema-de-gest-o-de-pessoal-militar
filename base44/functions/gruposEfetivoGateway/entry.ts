import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACTIONS = {
  LIST: 'visualizar_grupos_efetivo',
  CREATE_GROUP: 'criar_grupos_efetivo',
  UPDATE_GROUP: 'editar_grupos_efetivo',
  TOGGLE_GROUP: 'editar_grupos_efetivo',
  ADD_MEMBER: 'gerir_membros_grupos_efetivo',
  REMOVE_MEMBER: 'gerir_membros_grupos_efetivo',
};

const normalizeTipo = (v: unknown) => String(v || '').trim().toLowerCase();
const today = () => new Date().toISOString().slice(0, 10);

async function getAuthz(base44: any, scopeMilitarIds: string[] = []) {
  const response = await base44.functions.invoke('getUserPermissions', scopeMilitarIds.length ? { scopeMilitarIds } : {});
  return response?.data ?? response ?? {};
}

function requireCapability(authz: any, action: string) {
  if (authz?.isAdmin === true) return;
  if (authz?.modules?.grupos_efetivo !== true || authz?.actions?.[action] !== true) {
    throw Object.assign(new Error(`Permissão necessária: ${action}.`), { status: 403 });
  }
}

function requireScope(authz: any) {
  if (authz?.isAdmin === true || authz?.hasGlobalScope === true) return;
  if (authz?.scopeCheck?.allAllowed !== true) {
    throw Object.assign(new Error('Militar fora do escopo organizacional autorizado.'), { status: 403 });
  }
}

async function listarMilitaresEscopados(base44: any, authz: any) {
  const fields = ['id', 'nome_completo', 'nome_guerra', 'matricula', 'posto_graduacao', 'quadro', 'estrutura_id', 'subgrupamento_id', 'grupamento_id', 'grupamento_raiz_id', 'situacao_militar', 'status_cadastro'];
  if (authz?.isAdmin === true || authz?.hasGlobalScope === true) {
    return base44.asServiceRole.entities.Militar.list('nome_completo', 1000, 0, fields);
  }

  const ids = new Set<string>();
  for (const acesso of authz?.acessos || []) {
    const tipo = normalizeTipo(acesso?.tipo_acesso);
    if (tipo === 'proprio' && acesso?.militar_id) ids.add(String(acesso.militar_id));
    const grupamentoId = String(acesso?.grupamento_id || '').trim();
    const subgrupamentoId = String(acesso?.subgrupamento_id || '').trim();
    const queries: any[] = [];
    if (tipo === 'setor' && grupamentoId) {
      queries.push({ grupamento_raiz_id: grupamentoId }, { grupamento_id: grupamentoId }, { estrutura_id: grupamentoId });
    } else if ((tipo === 'subsetor' || tipo === 'unidade') && subgrupamentoId) {
      queries.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
      if (tipo === 'subsetor') {
        const filhos = await base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }, undefined, 500, 0, ['id']);
        for (const filho of filhos || []) if (filho?.id) queries.push({ estrutura_id: filho.id }, { subgrupamento_id: filho.id });
      }
    }
    for (const query of queries) {
      const rows = await base44.asServiceRole.entities.Militar.filter(query, undefined, 1000, 0, ['id']);
      for (const row of rows || []) if (row?.id) ids.add(String(row.id));
    }
  }

  if (!ids.size) return [];
  const out: any[] = [];
  for (const id of ids) {
    const rows = await base44.asServiceRole.entities.Militar.filter({ id }, undefined, 1, 0, fields);
    if (rows?.[0]) out.push(rows[0]);
  }
  return out.sort((a, b) => String(a?.nome_completo || a?.nome_guerra || '').localeCompare(String(b?.nome_completo || b?.nome_guerra || ''), 'pt-BR'));
}

function sanitizeGroupInput(data: any = {}) {
  const nome = String(data?.nome || '').trim();
  if (!nome) throw Object.assign(new Error('Nome do grupo é obrigatório.'), { status: 400 });
  return {
    nome,
    sigla: String(data?.sigla || '').trim().toUpperCase(),
    tipo: String(data?.tipo || 'SEGMENTO_ADMINISTRATIVO'),
    descricao: String(data?.descricao || '').trim(),
    ativo: data?.ativo !== false,
    data_inicio: String(data?.data_inicio || ''),
    data_fim: String(data?.data_fim || ''),
    origem: String(data?.origem || 'MANUAL'),
    observacoes: String(data?.observacoes || '').trim(),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').toUpperCase();
    const payload = body?.payload || {};
    if (!ACTIONS[action]) return Response.json({ error: 'Ação inválida.' }, { status: 400 });

    const scopeIds = ['ADD_MEMBER'].includes(action) ? [String(payload?.militarId || '')].filter(Boolean) : [];
    let authz = await getAuthz(base44, scopeIds);
    requireCapability(authz, ACTIONS[action]);
    if (scopeIds.length) requireScope(authz);

    if (action === 'LIST') {
      const [grupos, membros, militares] = await Promise.all([
        base44.asServiceRole.entities.GrupoEfetivo.list('-created_date'),
        base44.asServiceRole.entities.MembroGrupoEfetivo.list('-created_date'),
        listarMilitaresEscopados(base44, authz),
      ]);
      const allowedIds = new Set((militares || []).map((m: any) => String(m.id)));
      return Response.json({
        grupos: grupos || [],
        membros: (membros || []).filter((m: any) => allowedIds.has(String(m?.militar_id || ''))),
        militares: militares || [],
      });
    }

    if (action === 'CREATE_GROUP') {
      const created = await base44.asServiceRole.entities.GrupoEfetivo.create(sanitizeGroupInput(payload?.data));
      return Response.json({ grupo: created });
    }

    if (action === 'UPDATE_GROUP' || action === 'TOGGLE_GROUP') {
      const grupoId = String(payload?.grupoId || '');
      const atual = await base44.asServiceRole.entities.GrupoEfetivo.get(grupoId);
      if (!atual) return Response.json({ error: 'Grupo não encontrado.' }, { status: 404 });
      const data = action === 'TOGGLE_GROUP'
        ? { ativo: atual.ativo === false }
        : sanitizeGroupInput({ ...atual, ...(payload?.data || {}) });
      const updated = await base44.asServiceRole.entities.GrupoEfetivo.update(grupoId, data);
      return Response.json({ grupo: updated });
    }

    if (action === 'ADD_MEMBER') {
      const grupoId = String(payload?.grupoId || '');
      const militarId = String(payload?.militarId || '');
      if (!grupoId || !militarId) return Response.json({ error: 'Grupo e militar são obrigatórios.' }, { status: 400 });
      const existentes = await base44.asServiceRole.entities.MembroGrupoEfetivo.filter({ grupo_id: grupoId, militar_id: militarId });
      const ativo = (existentes || []).find((m: any) => m.ativo !== false);
      if (ativo) return Response.json({ membro: ativo, skipped: 'already_active' });
      const inativo = (existentes || [])[0];
      const membro = inativo
        ? await base44.asServiceRole.entities.MembroGrupoEfetivo.update(inativo.id, { ativo: true, data_inicio: today(), data_fim: '', origem: 'MANUAL' })
        : await base44.asServiceRole.entities.MembroGrupoEfetivo.create({ grupo_id: grupoId, militar_id: militarId, ativo: true, data_inicio: today(), data_fim: '', origem: 'MANUAL' });
      return Response.json({ membro });
    }

    if (action === 'REMOVE_MEMBER') {
      const membroId = String(payload?.membroId || '');
      const membro = await base44.asServiceRole.entities.MembroGrupoEfetivo.get(membroId);
      if (!membro) return Response.json({ error: 'Membro não encontrado.' }, { status: 404 });
      authz = await getAuthz(base44, [String(membro.militar_id || '')]);
      requireCapability(authz, ACTIONS[action]);
      requireScope(authz);
      const updated = await base44.asServiceRole.entities.MembroGrupoEfetivo.update(membroId, { ativo: false, data_fim: today() });
      return Response.json({ membro: updated });
    }

    return Response.json({ error: 'Ação não tratada.' }, { status: 400 });
  } catch (error) {
    const status = Number(error?.status || error?.response?.status || 500);
    console.error('[gruposEfetivoGateway]', error?.message || error);
    return Response.json({ error: error?.message || 'Erro no serviço de Grupos do Efetivo.' }, { status });
  }
});
