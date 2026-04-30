import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const LIMIT_MAX = 300;
const CHUNK_MILITAR_IDS = 200;
const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id'];
const normalizeTipo = (t) => String(t || '').trim().toLowerCase();
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

async function fetchWithRetry(queryFn) { let lastError; for (let i = 1; i <= RETRY_MAX_ATTEMPTS; i++) { try { return await queryFn(); } catch (e) { lastError = e; const status = e?.response?.status || e?.status || 0; if (!RETRY_STATUS.has(status) || i === RETRY_MAX_ATTEMPTS) break; await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, i - 1) + Math.floor(Math.random() * 200))); } } throw lastError; }

async function resolverPermissoes(base44, email) {
  const acessos = await fetchWithRetry(() => base44.asServiceRole.entities.UsuarioAcesso.filter({ user_email: email, ativo: true }, undefined, LIMIT_MAX, 0, CAMPOS_USUARIO_ACESSO));
  return { acessos: acessos || [], isAdminByAccess: (acessos || []).some((a) => normalizeTipo(a.tipo_acesso) === 'admin') };
}

async function resolverEscopoConsolidado(base44, acessos) {
  if (!acessos?.length) return { tipo: 'vazio' };
  if (acessos.some((a) => normalizeTipo(a.tipo_acesso) === 'admin')) return { isAdmin: true };
  const setores = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'setor' && a.grupamento_id);
  const subsetores = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'subsetor' && a.subgrupamento_id);
  const unidades = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'unidade' && a.subgrupamento_id);
  const proprios = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'proprio');
  const estruturaIds = new Set();
  if (setores.length) {
    const grupamentoIds = [...new Set(setores.map((s) => s.grupamento_id).filter(Boolean))];
    grupamentoIds.forEach((id) => estruturaIds.add(id));
    const descendentes = await fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter({ grupamento_raiz_id: { $in: grupamentoIds } }, undefined, LIMIT_MAX, 0, ['id']));
    (descendentes || []).forEach((d) => d?.id && estruturaIds.add(d.id));
  }
  if (subsetores.length) {
    const subIds = [...new Set(subsetores.map((s) => s.subgrupamento_id).filter(Boolean))];
    subIds.forEach((id) => estruturaIds.add(id));
    const filhos = await fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: { $in: subIds } }, undefined, LIMIT_MAX, 0, ['id']));
    (filhos || []).forEach((f) => f?.id && estruturaIds.add(f.id));
  }
  if (unidades.length) unidades.forEach((u) => u.subgrupamento_id && estruturaIds.add(u.subgrupamento_id));
  const militarIdsProprios = proprios.map((a) => a.militar_id).filter(Boolean);
  return { tipo: 'estrutura', estruturaIds: Array.from(estruturaIds), militarIdsProprios };
}

async function listarMilitarIdsEscopo(base44, escopo) {
  const ids = new Set(escopo.militarIdsProprios || []);
  if (escopo.estruturaIds?.length) {
    const militares = await fetchWithRetry(() => base44.asServiceRole.entities.Militar.filter({ estrutura_id: { $in: escopo.estruturaIds } }, undefined, 1000, 0, ['id']));
    (militares || []).forEach((m) => m?.id && ids.add(m.id));
  }
  return Array.from(ids);
}

async function listarPorEscopoIds(base44, entityName, militarIds, orderBy) {
  const out = []; let partialFailures = 0;
  for (let i = 0; i < militarIds.length; i += CHUNK_MILITAR_IDS) {
    try { const rows = await fetchWithRetry(() => base44.asServiceRole.entities[entityName].filter({ militar_id: { $in: militarIds.slice(i, i + CHUNK_MILITAR_IDS) } }, orderBy, 1000, 0)); out.push(...(rows || [])); }
    catch (_e) { partialFailures += 1; }
  }
  return { rows: out, partialFailures };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    let payload = {}; try { payload = await req.json(); } catch (_e) {}

    const authPerms = await resolverPermissoes(base44, authUser.email);
    const authIsAdmin = String(authUser.role || '').toLowerCase() === 'admin' || authPerms.isAdminByAccess;
    const effectiveEmailNorm = normalizeEmail(payload?.effectiveEmail);
    const wantsImpersonation = Boolean(effectiveEmailNorm) && effectiveEmailNorm !== normalizeEmail(authUser.email);
    if (wantsImpersonation && !authIsAdmin) return Response.json({ error: 'Ação não permitida: somente administradores podem usar effectiveEmail.' }, { status: 403 });

    const targetPerms = wantsImpersonation ? await resolverPermissoes(base44, effectiveEmailNorm) : authPerms;
    const targetEscopo = await resolverEscopoConsolidado(base44, targetPerms.acessos);
    if (authIsAdmin || targetEscopo?.isAdmin) {
      const [atestados, jisos] = await Promise.all([
        fetchWithRetry(() => base44.asServiceRole.entities.Atestado.list('-created_date')),
        fetchWithRetry(() => base44.asServiceRole.entities.JISO.list('-created_date')),
      ]);
      return Response.json({ atestados: atestados || [], jisos: jisos || [], meta: { totalMilitaresEscopo: null, totalAtestados: (atestados || []).length, totalJiso: (jisos || []).length, partialFailures: 0, warnings: [] } });
    }

    const militarIds = await listarMilitarIdsEscopo(base44, targetEscopo);
    if (!militarIds.length) return Response.json({ atestados: [], jisos: [], meta: { totalMilitaresEscopo: 0, totalAtestados: 0, totalJiso: 0, partialFailures: 0, warnings: ['SEM_ESCOPO'] } });

    const [atestadosResult, jisoResult] = await Promise.all([listarPorEscopoIds(base44, 'Atestado', militarIds, '-created_date'), listarPorEscopoIds(base44, 'JISO', militarIds, '-created_date')]);
    const partialFailures = atestadosResult.partialFailures + jisoResult.partialFailures;
    return Response.json({ atestados: atestadosResult.rows, jisos: jisoResult.rows, meta: { totalMilitaresEscopo: militarIds.length, totalAtestados: atestadosResult.rows.length, totalJiso: jisoResult.rows.length, partialFailures, warnings: partialFailures > 0 ? ['PARTIAL_FAILURES'] : [] } });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao carregar getScopedAtestadosBundle.', meta: { status } }, { status });
  }
});
