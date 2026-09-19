import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACTIONS = {
  BOOTSTRAP: 'visualizar_central_conferencias',
  LIST: 'visualizar_central_conferencias',
  SAVE: 'gerir_central_conferencias',
  UPDATE_ITEM: 'gerir_central_conferencias',
  CONCLUDE: 'gerir_central_conferencias',
};

const normalizeTipo = (v: unknown) => String(v || '').trim().toLowerCase();

async function getAuthz(base44: any, scopeMilitarIds: string[] = []) {
  const response = await base44.functions.invoke('getUserPermissions', scopeMilitarIds.length ? { scopeMilitarIds } : {});
  return response?.data ?? response ?? {};
}

function requireCapability(authz: any, action: string) {
  if (authz?.isAdmin === true) return;
  if (authz?.modules?.central_conferencias !== true || authz?.actions?.[action] !== true) {
    throw Object.assign(new Error(`Permissão necessária: ${action}.`), { status: 403 });
  }
}

function requireScope(authz: any) {
  if (authz?.isAdmin === true || authz?.hasGlobalScope === true) return;
  if (authz?.scopeCheck?.allAllowed !== true) {
    throw Object.assign(new Error('Há militar fora do escopo organizacional autorizado.'), { status: 403 });
  }
}

async function listarMilitaresEscopados(base44: any, authz: any) {
  const fields = ['id','nome_completo','nome','nome_guerra','matricula','posto_graduacao','quadro','estrutura_id','estrutura_nome','subgrupamento_id','subgrupamento_nome','grupamento_id','grupamento_raiz_id','situacao_militar','status_cadastro'];
  if (authz?.isAdmin === true || authz?.hasGlobalScope === true) {
    return base44.asServiceRole.entities.Militar.list('nome_completo', 2000, 0, fields);
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
      const rows = await base44.asServiceRole.entities.Militar.filter(query, undefined, 2000, 0, ['id']);
      for (const row of rows || []) if (row?.id) ids.add(String(row.id));
    }
  }
  if (!ids.size) return [];
  const rows = await base44.asServiceRole.entities.Militar.list('nome_completo', 2000, 0, fields);
  return (rows || []).filter((m: any) => ids.has(String(m.id)));
}

function parseIds(raw: any) {
  try { const value = JSON.parse(String(raw || '[]')); return Array.isArray(value) ? value.map(String) : []; } catch { return []; }
}

async function bulkCreate(entitySvc: any, rows: any[]) {
  if (!rows.length) return [];
  if (typeof entitySvc.bulkCreate === 'function') return entitySvc.bulkCreate(rows);
  const out = [];
  for (let i = 0; i < rows.length; i += 40) {
    const batch = rows.slice(i, i + 40);
    out.push(...await Promise.all(batch.map((row) => entitySvc.create(row))));
  }
  return out;
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

    let authz = await getAuthz(base44);
    requireCapability(authz, ACTIONS[action]);

    const militares = await listarMilitaresEscopados(base44, authz);
    const allowedIds = new Set((militares || []).map((m: any) => String(m.id)));

    if (action === 'BOOTSTRAP') {
      const [grupos, membros] = await Promise.all([
        base44.asServiceRole.entities.GrupoEfetivo.filter({ ativo: true }, 'nome', 500, 0),
        base44.asServiceRole.entities.MembroGrupoEfetivo.filter({ ativo: true }, '-created_date', 3000, 0),
      ]);
      return Response.json({
        militares: militares || [],
        grupos: grupos || [],
        membros: (membros || []).filter((m: any) => allowedIds.has(String(m?.militar_id || ''))),
      });
    }

    if (action === 'LIST') {
      const conferencias = await base44.asServiceRole.entities.CentralConferencia.list('-created_date', 500, 0);
      const visiveis = (conferencias || []).filter((c: any) => {
        if (authz?.isAdmin === true || authz?.hasGlobalScope === true) return true;
        const ids = parseIds(c?.universo_ids_json);
        return ids.length === 0 || ids.every((id) => allowedIds.has(String(id)));
      });
      return Response.json({ conferencias: visiveis });
    }

    if (action === 'SAVE') {
      const cab = payload?.conferencia || {};
      const itens = Array.isArray(payload?.itens) ? payload.itens : [];
      const ids = [...new Set([
        ...parseIds(cab?.universo_ids_json),
        ...itens.map((i: any) => String(i?.militar_id || '')).filter(Boolean),
      ])];
      if (ids.length) {
        authz = await getAuthz(base44, ids);
        requireCapability(authz, ACTIONS[action]);
        requireScope(authz);
      }
      const created = await base44.asServiceRole.entities.CentralConferencia.create({
        ...cab,
        criado_por_email: String(user?.email || ''),
        criado_por_nome: String(user?.full_name || user?.name || ''),
      });
      const safeItens = itens.map((i: any) => ({
        conferencia_id: String(created.id),
        tipo_linha: String(i?.tipo_linha || 'ENTRADA'),
        ordem: Number(i?.ordem || 0),
        entrada_original: String(i?.entrada_original || '').slice(0, 1000),
        nome_normalizado: String(i?.nome_normalizado || '').slice(0, 300),
        matricula_informada: String(i?.matricula_informada || '').slice(0, 50),
        militar_id: String(i?.militar_id || ''),
        militar_nome: String(i?.militar_nome || '').slice(0, 300),
        militar_matricula: String(i?.militar_matricula || '').slice(0, 50),
        militar_posto_graduacao: String(i?.militar_posto_graduacao || '').slice(0, 100),
        status: String(i?.status || 'NAO_LOCALIZADO'),
        score: Number(i?.score || 0),
        criterio: String(i?.criterio || '').slice(0, 100),
        observacao: String(i?.observacao || '').slice(0, 1000),
      }));
      await bulkCreate(base44.asServiceRole.entities.CentralConferenciaItem, safeItens);
      return Response.json({ conferencia: created });
    }

    if (action === 'UPDATE_ITEM') {
      const itemId = String(payload?.itemId || '');
      const item = await base44.asServiceRole.entities.CentralConferenciaItem.get(itemId);
      if (!item) return Response.json({ error: 'Item não encontrado.' }, { status: 404 });
      const militarId = String(payload?.data?.militar_id || item?.militar_id || '');
      if (militarId) {
        authz = await getAuthz(base44, [militarId]);
        requireCapability(authz, ACTIONS[action]);
        requireScope(authz);
      }
      const data = {
        ...(payload?.data || {}),
        ajustado_por_email: String(user?.email || ''),
        ajustado_em: new Date().toISOString(),
      };
      const updated = await base44.asServiceRole.entities.CentralConferenciaItem.update(itemId, data);
      return Response.json({ item: updated });
    }

    if (action === 'CONCLUDE') {
      const id = String(payload?.conferenciaId || '');
      const conf = await base44.asServiceRole.entities.CentralConferencia.get(id);
      if (!conf) return Response.json({ error: 'Conferência não encontrada.' }, { status: 404 });
      const ids = parseIds(conf?.universo_ids_json);
      if (ids.length) {
        authz = await getAuthz(base44, ids);
        requireCapability(authz, ACTIONS[action]);
        requireScope(authz);
      }
      const updated = await base44.asServiceRole.entities.CentralConferencia.update(id, { status: 'CONCLUIDA', concluido_em: new Date().toISOString() });
      return Response.json({ conferencia: updated });
    }

    return Response.json({ error: 'Ação não tratada.' }, { status: 400 });
  } catch (error) {
    const status = Number(error?.status || error?.response?.status || 500);
    console.error('[centralConferenciasGateway]', error?.message || error);
    return Response.json({ error: error?.message || 'Erro na Central de Conferências.' }, { status });
  }
});