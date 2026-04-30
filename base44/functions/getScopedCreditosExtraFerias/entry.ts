import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =====================================================================
// getScopedCreditosExtraFerias — Backend Hardening (Créditos Extra Férias)
// ---------------------------------------------------------------------
// Listagem ESCOPADA de CreditoExtraFerias.
//
// Regras:
//   - autentica usuário real;
//   - resolve effectiveEmail (somente admins reais podem impersonar);
//   - admin: retorna todos os créditos (com filtros opcionais);
//   - restrito: resolve militares do escopo usando a mesma lógica de
//     getScopedMilitares (estrutura/proprio) e retorna apenas créditos
//     cujo militar_id ∈ escopo;
//   - aceita filtros opcionais seguros: gozo_ferias_id, status, militar_id;
//     militar_id no filtro é interceptado contra o escopo — IDs fora do
//     escopo são silenciosamente descartados;
//   - retorna [] quando não há escopo;
//   - jamais retorna crédito fora do escopo.
// =====================================================================

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const LIMIT_DEFAULT = 500;
const LIMIT_MAX = 1000;

const CAMPOS_USUARIO_ACESSO = [
  'id',
  'user_email',
  'ativo',
  'tipo_acesso',
  'grupamento_id',
  'subgrupamento_id',
  'militar_id',
  'perfil_id',
];

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
      const isRetryable = RETRY_STATUS.has(status);
      if (!isRetryable || attempt === RETRY_MAX_ATTEMPTS) break;
      const exp = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 200);
      await new Promise((res) => setTimeout(res, exp + jitter));
      console.warn(`[getScopedCreditosExtraFerias] retry step=${label} attempt=${attempt} status=${status}`);
    }
  }
  throw lastError;
}

async function resolverPermissoes(base44, email) {
  const acessos = await fetchWithRetry(
    () => base44.asServiceRole.entities.UsuarioAcesso.filter(
      { user_email: email, ativo: true },
      undefined,
      LIMIT_MAX,
      0,
      CAMPOS_USUARIO_ACESSO,
    ),
    `usuarioAcesso.list:${email}`,
  );
  const isAdminByAccess = (acessos || []).some(
    (a) => normalizeTipo(a.tipo_acesso) === 'admin',
  );
  return { acessos: acessos || [], isAdminByAccess };
}

// Reaproveita exatamente a mesma lógica do cudEscopado para garantir
// consistência: retorna null para admin (sem restrição) ou Array de IDs.
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
      filtros.push({ grupamento_raiz_id: grupamentoId });
      filtros.push({ grupamento_id: grupamentoId });
      filtros.push({ estrutura_id: grupamentoId });
    } else if (tipo === 'subsetor' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId });
      filtros.push({ subgrupamento_id: subgrupamentoId });
      try {
        const filhos = await fetchWithRetry(
          () => base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }),
          `subgrupamento.parent:${subgrupamentoId}`,
        );
        for (const filho of (filhos || [])) {
          if (filho?.id) {
            filtros.push({ estrutura_id: filho.id });
            filtros.push({ subgrupamento_id: filho.id });
          }
        }
      } catch (_e) {
        // segue com o que conseguiu coletar
      }
    } else if (tipo === 'unidade' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId });
      filtros.push({ subgrupamento_id: subgrupamentoId });
    }

    for (const filtro of filtros) {
      try {
        const militares = await fetchWithRetry(
          () => base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, ['id']),
          `militar.escopo:${JSON.stringify(filtro)}`,
        );
        for (const m of (militares || [])) {
          if (m?.id) ids.add(String(m.id));
        }
      } catch (_e) {
        // mantém o que coletou
      }
    }
  }

  return Array.from(ids);
}

function clampLimit(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return LIMIT_DEFAULT;
  return Math.min(n, LIMIT_MAX);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const authUser = await base44.auth.me();
    if (!authUser) {
      return Response.json({ error: 'Não autenticado.', creditos: [] }, { status: 401 });
    }

    let payload = {};
    try {
      payload = await req.json();
    } catch (_e) {
      payload = {};
    }

    const {
      gozo_ferias_id: gozoFeriasIdRaw,
      status: statusRaw,
      militar_id: militarIdRaw,
      orderBy: orderByRaw,
      limit: limitRaw,
      effectiveEmail: effectiveEmailRaw,
    } = payload || {};

    const gozoFeriasId = gozoFeriasIdRaw ? String(gozoFeriasIdRaw).trim() : '';
    const statusFiltro = statusRaw ? String(statusRaw).trim() : '';
    const militarIdFiltro = militarIdRaw ? String(militarIdRaw).trim() : '';
    const orderBy = orderByRaw && typeof orderByRaw === 'string' ? orderByRaw : '-data_referencia';
    const effLimit = clampLimit(limitRaw);

    // ---- Resolução de auth/effective ----
    const authUserEmail = normalizeEmail(authUser.email);
    const effectiveEmailNorm = normalizeEmail(effectiveEmailRaw);
    const wantsImpersonation = Boolean(effectiveEmailNorm) && effectiveEmailNorm !== authUserEmail;

    const authPerms = await resolverPermissoes(base44, authUser.email);
    const authIsAdminByRole = String(authUser.role || '').toLowerCase() === 'admin';
    const authIsAdmin = authIsAdminByRole || authPerms.isAdminByAccess;

    if (wantsImpersonation && !authIsAdmin) {
      return Response.json(
        { error: 'Ação não permitida: somente administradores podem usar effectiveEmail.', creditos: [] },
        { status: 403 },
      );
    }

    const isImpersonating = wantsImpersonation && authIsAdmin;
    const targetEmail = isImpersonating ? effectiveEmailNorm : authUser.email;
    const targetPerms = isImpersonating
      ? await resolverPermissoes(base44, targetEmail)
      : authPerms;
    const targetIsAdmin = isImpersonating ? targetPerms.isAdminByAccess : authIsAdmin;

    // ---- Construção do filtro base ----
    const baseFilter = {};
    if (gozoFeriasId) baseFilter.gozo_ferias_id = gozoFeriasId;
    if (statusFiltro) baseFilter.status = statusFiltro;

    // ---- Caminho ADMIN ----
    if (targetIsAdmin) {
      const filtroFinal = { ...baseFilter };
      if (militarIdFiltro) filtroFinal.militar_id = militarIdFiltro;

      const creditos = await fetchWithRetry(
        () => base44.asServiceRole.entities.CreditoExtraFerias.filter(
          filtroFinal,
          orderBy,
          effLimit,
          0,
        ),
        'creditoExtraFerias.filter.admin',
      );

      return Response.json({
        creditos: creditos || [],
        meta: {
          authUserEmail: authUser.email,
          effectiveUserEmail: targetEmail,
          isImpersonating,
          targetIsAdmin: true,
          returned: (creditos || []).length,
          scope_tipo: 'admin',
        },
      });
    }

    // ---- Caminho RESTRITO ----
    const idsPermitidos = await listarMilitarIdsDoEscopo(base44, targetPerms.acessos);

    // null = admin (já tratado acima); aqui sempre é Array
    if (!idsPermitidos || idsPermitidos.length === 0) {
      return Response.json({
        creditos: [],
        meta: {
          authUserEmail: authUser.email,
          effectiveUserEmail: targetEmail,
          isImpersonating,
          targetIsAdmin: false,
          returned: 0,
          scope_tipo: 'vazio',
          reason: 'SEM_ESCOPO',
        },
      });
    }

    const setPermitidos = new Set(idsPermitidos.map(String));

    // Se um militar_id específico foi solicitado, valida contra o escopo.
    // Fora do escopo => silenciosamente descartado (retorna []).
    let militaresAlvo;
    if (militarIdFiltro) {
      if (!setPermitidos.has(militarIdFiltro)) {
        return Response.json({
          creditos: [],
          meta: {
            authUserEmail: authUser.email,
            effectiveUserEmail: targetEmail,
            isImpersonating,
            targetIsAdmin: false,
            returned: 0,
            scope_tipo: 'estrutura',
            reason: 'MILITAR_FORA_DO_ESCOPO',
          },
        });
      }
      militaresAlvo = [militarIdFiltro];
    } else {
      militaresAlvo = idsPermitidos;
    }

    // Busca créditos por militar_id ∈ militaresAlvo, em lotes de até 25 IDs
    // (evita filter $in com listas excessivamente longas).
    const creditosAcumulados = [];
    const tamanhoLote = 25;
    for (let inicio = 0; inicio < militaresAlvo.length; inicio += tamanhoLote) {
      const lote = militaresAlvo.slice(inicio, inicio + tamanhoLote);
      const filtroLote = { ...baseFilter, militar_id: { $in: lote } };
      const parcial = await fetchWithRetry(
        () => base44.asServiceRole.entities.CreditoExtraFerias.filter(
          filtroLote,
          orderBy,
          effLimit,
          0,
        ),
        `creditoExtraFerias.filter.lote:${inicio}`,
      );
      for (const c of (parcial || [])) {
        if (c?.id && setPermitidos.has(String(c.militar_id))) {
          creditosAcumulados.push(c);
        }
      }
    }

    // Dedup por id e ordenação final por data_referencia desc
    const dedup = new Map();
    for (const c of creditosAcumulados) {
      if (c?.id && !dedup.has(c.id)) dedup.set(c.id, c);
    }
    const ordenados = Array.from(dedup.values()).sort((a, b) => {
      const da = String(a?.data_referencia || '');
      const db = String(b?.data_referencia || '');
      // orderBy padrão: '-data_referencia' (desc)
      if (orderBy === 'data_referencia') return da.localeCompare(db);
      return db.localeCompare(da);
    });

    const truncados = ordenados.slice(0, effLimit);

    return Response.json({
      creditos: truncados,
      meta: {
        authUserEmail: authUser.email,
        effectiveUserEmail: targetEmail,
        isImpersonating,
        targetIsAdmin: false,
        returned: truncados.length,
        scope_tipo: 'estrutura',
        militares_no_escopo: idsPermitidos.length,
      },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    console.error('[getScopedCreditosExtraFerias] erro fatal', {
      message: error?.message,
      status,
    });
    return Response.json(
      { error: error?.message || 'Erro interno ao buscar créditos extraordinários.', creditos: [] },
      { status },
    );
  }
});