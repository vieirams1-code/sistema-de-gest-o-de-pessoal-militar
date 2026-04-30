import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const LIMIT_USUARIO_ACESSO = 1000;
const CHUNK_MILITAR_IDS = 200;

const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id', 'perfil_id'];
const normalizeTipo = (t) => String(t || '').trim().toLowerCase();
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

async function fetchWithRetry(queryFn, label = 'query') {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      if (!RETRY_STATUS.has(status) || attempt === RETRY_MAX_ATTEMPTS) break;
      const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((res) => setTimeout(res, waitMs));
      console.warn(`[getScopedFeriasBundle] retry step=${label} attempt=${attempt} status=${status}`);
    }
  }
  throw lastError;
}

async function resolverPermissoes(base44, email) {
  const acessos = await fetchWithRetry(() => base44.asServiceRole.entities.UsuarioAcesso.filter({ user_email: email, ativo: true }, undefined, LIMIT_USUARIO_ACESSO, 0, CAMPOS_USUARIO_ACESSO), `usuarioAcesso.list:${email}`);
  return { acessos: acessos || [], isAdminByAccess: (acessos || []).some((a) => normalizeTipo(a.tipo_acesso) === 'admin') };
}

async function listarMilitarIdsDoEscopo(base44, acessos) {
  const ids = new Set();
  for (const acesso of acessos || []) {
    const tipo = normalizeTipo(acesso?.tipo_acesso);
    if (tipo === 'admin') return null;
    if (tipo === 'proprio') {
      if (acesso?.militar_id) ids.add(String(acesso.militar_id));
      continue;
    }
    const grupamentoId = acesso?.grupamento_id || null;
    const subgrupamentoId = acesso?.subgrupamento_id || null;
    const filtros = [];
    if (tipo === 'setor' && grupamentoId) {
      filtros.push({ grupamento_raiz_id: grupamentoId }, { grupamento_id: grupamentoId }, { estrutura_id: grupamentoId });
    } else if (tipo === 'subsetor' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
      try {
        const filhos = await fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }), `subgrupamento.parent:${subgrupamentoId}`);
        for (const f of (filhos || [])) {
          if (f?.id) filtros.push({ estrutura_id: f.id }, { subgrupamento_id: f.id });
        }
      } catch (_e) {}
    } else if (tipo === 'unidade' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
    }
    for (const filtro of filtros) {
      try {
        const militares = await fetchWithRetry(() => base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, ['id']), `militar.escopo:${JSON.stringify(filtro)}`);
        for (const m of (militares || [])) if (m?.id) ids.add(String(m.id));
      } catch (_e) {}
    }
  }
  return Array.from(ids);
}

async function listarPorEscopoIds(base44, entityName, militarIds, orderBy) {
  const out = [];
  let partialFailures = 0;
  for (let i = 0; i < militarIds.length; i += CHUNK_MILITAR_IDS) {
    const chunk = militarIds.slice(i, i + CHUNK_MILITAR_IDS);
    try {
      const rows = await fetchWithRetry(() => base44.asServiceRole.entities[entityName].filter({ militar_id: { $in: chunk } }, orderBy, 1000, 0), `${entityName}.chunk`);
      out.push(...(rows || []));
    } catch (_e) {
      partialFailures += 1;
    }
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

    const authUserEmail = normalizeEmail(authUser.email);
    const effectiveEmailNorm = normalizeEmail(payload?.effectiveEmail);
    const wantsImpersonation = Boolean(effectiveEmailNorm) && effectiveEmailNorm !== authUserEmail;

    const authPerms = await resolverPermissoes(base44, authUser.email);
    const authIsAdmin = String(authUser.role || '').toLowerCase() === 'admin' || authPerms.isAdminByAccess;
    if (wantsImpersonation && !authIsAdmin) {
      return Response.json({ error: 'Ação não permitida: somente administradores podem usar effectiveEmail.' }, { status: 403 });
    }

    const isImpersonating = wantsImpersonation && authIsAdmin;
    const targetEmail = isImpersonating ? effectiveEmailNorm : authUser.email;
    const targetPerms = isImpersonating ? await resolverPermissoes(base44, targetEmail) : authPerms;
    const targetIsAdmin = isImpersonating ? targetPerms.isAdminByAccess : authIsAdmin;

    if (targetIsAdmin) {
      const [ferias, registrosLivro] = await Promise.all([
        fetchWithRetry(() => base44.asServiceRole.entities.Ferias.list('-data_inicio'), 'ferias.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.RegistroLivro.list(), 'registroLivro.admin'),
      ]);
      return Response.json({ ferias: ferias || [], registrosLivro: registrosLivro || [], meta: { totalMilitaresEscopo: null, totalFerias: (ferias || []).length, totalRegistrosLivro: (registrosLivro || []).length, hasMore: false, partialFailures: 0, warnings: [], targetIsAdmin: true } });
    }

    const militarIds = await listarMilitarIdsDoEscopo(base44, targetPerms.acessos);
    if (!militarIds || militarIds.length === 0) {
      return Response.json({ ferias: [], registrosLivro: [], meta: { totalMilitaresEscopo: 0, totalFerias: 0, totalRegistrosLivro: 0, hasMore: false, partialFailures: 0, warnings: ['SEM_ESCOPO'], targetIsAdmin: false } });
    }

    const [feriasResult, registrosResult] = await Promise.all([
      listarPorEscopoIds(base44, 'Ferias', militarIds, '-data_inicio'),
      listarPorEscopoIds(base44, 'RegistroLivro', militarIds, undefined),
    ]);

    const partialFailures = feriasResult.partialFailures + registrosResult.partialFailures;
    return Response.json({
      ferias: feriasResult.rows,
      registrosLivro: registrosResult.rows,
      meta: {
        totalMilitaresEscopo: militarIds.length,
        totalFerias: feriasResult.rows.length,
        totalRegistrosLivro: registrosResult.rows.length,
        hasMore: false,
        partialFailures,
        warnings: partialFailures > 0 ? ['PARTIAL_FAILURES'] : [],
        targetIsAdmin: false,
      },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao carregar bundle de férias.', meta: { status } }, { status });
  }
});
