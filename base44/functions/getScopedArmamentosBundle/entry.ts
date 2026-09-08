import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { normalizeTipoAcesso, resolverContextoAutorizacao } from '../authz.ts';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const CHUNK_MILITAR_IDS = 200;

async function fetchWithRetry(queryFn) {
  let lastError;
  for (let i = 1; i <= RETRY_MAX_ATTEMPTS; i += 1) {
    try { return await queryFn(); } catch (e) {
      lastError = e;
      const status = e?.response?.status || e?.status || 0;
      if (!RETRY_STATUS.has(status) || i === RETRY_MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, i - 1) + Math.floor(Math.random() * 200)));
    }
  }
  throw lastError;
}

async function resolverEscopoConsolidado(base44, acessos) {
  if (!acessos?.length) return { tipo: 'vazio' };
  if (acessos.some((a) => normalizeTipoAcesso(a.tipo_acesso) === 'admin')) return { isGlobalScope: true };
  const setores = acessos.filter((a) => normalizeTipoAcesso(a.tipo_acesso) === 'setor' && a.grupamento_id);
  const subsetores = acessos.filter((a) => normalizeTipoAcesso(a.tipo_acesso) === 'subsetor' && a.subgrupamento_id);
  const unidades = acessos.filter((a) => normalizeTipoAcesso(a.tipo_acesso) === 'unidade' && a.subgrupamento_id);
  const proprios = acessos.filter((a) => normalizeTipoAcesso(a.tipo_acesso) === 'proprio');
  const estruturaIds = new Set();
  if (setores.length) {
    const ids = [...new Set(setores.map((s) => s.grupamento_id).filter(Boolean))];
    ids.forEach((id) => estruturaIds.add(id));
    const desc = await fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter({ grupamento_raiz_id: { $in: ids } }, undefined, 1000, 0, ['id']));
    (desc || []).forEach((d) => d?.id && estruturaIds.add(d.id));
  }
  if (subsetores.length) {
    const ids = [...new Set(subsetores.map((s) => s.subgrupamento_id).filter(Boolean))];
    ids.forEach((id) => estruturaIds.add(id));
    const filhos = await fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: { $in: ids } }, undefined, 1000, 0, ['id']));
    (filhos || []).forEach((f) => f?.id && estruturaIds.add(f.id));
  }
  if (unidades.length) unidades.forEach((u) => u.subgrupamento_id && estruturaIds.add(u.subgrupamento_id));
  return { tipo: 'estrutura', estruturaIds: Array.from(estruturaIds), militarIdsProprios: proprios.map((a) => a.militar_id).filter(Boolean) };
}

async function listarMilitarIdsEscopo(base44, escopo) {
  const ids = new Set(escopo.militarIdsProprios || []);
  if (escopo.estruturaIds?.length) {
    const militares = await fetchWithRetry(() => base44.asServiceRole.entities.Militar.filter({ estrutura_id: { $in: escopo.estruturaIds } }, undefined, 1000, 0, ['id']));
    (militares || []).forEach((m) => m?.id && ids.add(m.id));
  }
  return Array.from(ids);
}

async function listarPorEscopoIds(base44, militarIds) {
  const out = [];
  let partialFailures = 0;
  for (let i = 0; i < militarIds.length; i += CHUNK_MILITAR_IDS) {
    try {
      const rows = await fetchWithRetry(() => base44.asServiceRole.entities.Armamento.filter({ militar_id: { $in: militarIds.slice(i, i + CHUNK_MILITAR_IDS) } }, '-created_date', 1000, 0));
      out.push(...(rows || []));
    } catch (_e) { partialFailures += 1; }
  }
  return { rows: out, partialFailures };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    let payload = {};
    try { payload = await req.json(); } catch (_e) {}

    const authz = await resolverContextoAutorizacao({ base44, authUser, effectiveEmail: payload?.effectiveEmail });
    const targetEscopo = await resolverEscopoConsolidado(base44, authz.acessos);
    const podeEscopoGlobal = authz.hasGlobalScope || targetEscopo?.isGlobalScope === true;

    if (podeEscopoGlobal) {
      const armamentos = await fetchWithRetry(() => base44.asServiceRole.entities.Armamento.list('-created_date'));
      return Response.json({ armamentos: armamentos || [], meta: { totalMilitaresEscopo: null, totalArmamentos: (armamentos || []).length, partialFailures: 0, warnings: [], isImpersonating: authz.isImpersonating } });
    }

    const militarIds = await listarMilitarIdsEscopo(base44, targetEscopo);
    if (!militarIds.length) return Response.json({ armamentos: [], meta: { totalMilitaresEscopo: 0, totalArmamentos: 0, partialFailures: 0, warnings: ['SEM_ESCOPO'], isImpersonating: authz.isImpersonating } });
    const result = await listarPorEscopoIds(base44, militarIds);
    return Response.json({ armamentos: result.rows, meta: { totalMilitaresEscopo: militarIds.length, totalArmamentos: result.rows.length, partialFailures: result.partialFailures, warnings: result.partialFailures > 0 ? ['PARTIAL_FAILURES'] : [], isImpersonating: authz.isImpersonating } });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao carregar getScopedArmamentosBundle.', meta: { status } }, { status });
  }
});
