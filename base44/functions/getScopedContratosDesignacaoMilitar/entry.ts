import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const LIMIT_USUARIO_ACESSO = 1000;
const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id', 'perfil_id'];

const CAMPOS_PERIODO_LEGADO = [
  'id',
  'militar_id',
  'legado_ativa',
  'legado_ativa_contrato_designacao_id',
  'legado_ativa_em',
  'updated_date',
  'created_date',
];

function montarLegado(periodos) {
  return (Array.isArray(periodos) ? periodos : []).reduce((acc, periodo) => {
    if (!periodo?.legado_ativa || !periodo?.legado_ativa_contrato_designacao_id) return acc;
    const contratoId = String(periodo.legado_ativa_contrato_designacao_id);
    const atual = acc[contratoId] || { aplicado: false, totalPeriodos: 0, ultimaAplicacaoEm: null };
    const aplicacao = periodo.legado_ativa_em || periodo.updated_date || periodo.created_date || null;
    acc[contratoId] = {
      aplicado: true,
      totalPeriodos: atual.totalPeriodos + 1,
      ultimaAplicacaoEm: !atual.ultimaAplicacaoEm || (aplicacao && aplicacao > atual.ultimaAplicacaoEm) ? aplicacao : atual.ultimaAplicacaoEm,
    };
    return acc;
  }, {});
}

const normalizeTipo = (t) => String(t || '').trim().toLowerCase();
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

async function fetchWithRetry(queryFn, label = 'query') {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      if (!RETRY_STATUS.has(status) || attempt === RETRY_MAX_ATTEMPTS) break;
      const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((res) => setTimeout(res, waitMs));
      console.warn(`[getScopedContratosDesignacaoMilitar] retry step=${label} attempt=${attempt} status=${status}`);
    }
  }
  throw lastError;
}


async function resolverAutorizacaoCanonica(base44, effectiveEmail) {
  const requestPayload = effectiveEmail ? { effectiveEmail } : {};
  const response = await base44.functions.invoke('getUserPermissions', requestPayload);
  return response?.data ?? response ?? {};
}

async function listarMilitarIdsDoEscopo(base44, acessos, criteriosAplicados) {
  const ids = new Set();
  for (const acesso of acessos || []) {
    const tipo = normalizeTipo(acesso?.tipo_acesso);
    if (tipo === 'admin') return null;
    if (tipo === 'proprio') {
      if (acesso?.militar_id) {
        ids.add(String(acesso.militar_id));
        criteriosAplicados.add('proprio');
      }
      continue;
    }

    const grupamentoId = acesso?.grupamento_id || null;
    const subgrupamentoId = acesso?.subgrupamento_id || null;
    const filtros = [];
    if (tipo === 'setor' && grupamentoId) {
      filtros.push({ grupamento_raiz_id: grupamentoId }, { grupamento_id: grupamentoId }, { estrutura_id: grupamentoId });
      criteriosAplicados.add('setor');
    } else if (tipo === 'subsetor' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
      criteriosAplicados.add('subsetor');
      try {
        const filhos = await fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }), `subgrupamento.parent:${subgrupamentoId}`);
        for (const filho of (filhos || [])) {
          if (filho?.id) filtros.push({ estrutura_id: filho.id }, { subgrupamento_id: filho.id });
        }
      } catch (_e) {
        // Mantém escopo principal quando a carga de filhos falhar.
      }
    } else if (tipo === 'unidade' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
      criteriosAplicados.add('unidade');
    }

    for (const filtro of filtros) {
      try {
        const militares = await fetchWithRetry(
          () => base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, ['id']),
          `militar.escopo:${JSON.stringify(filtro)}`,
        );
        for (const militar of (militares || [])) if (militar?.id) ids.add(String(militar.id));
      } catch (_e) {
        // Segue com os filtros que responderem.
      }
    }
  }
  return Array.from(ids);
}

function getModoAcesso(criteriosAplicados) {
  if (criteriosAplicados.size === 1) return Array.from(criteriosAplicados)[0];
  if (criteriosAplicados.size > 1) return 'multiplo';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const militarId = payload?.militarId ? String(payload.militarId) : '';
    if (!militarId) return Response.json({ error: 'militarId é obrigatório.' }, { status: 400 });

    const authz = await resolverAutorizacaoCanonica(base44, payload?.effectiveEmail);
    if (authz?.error) return Response.json({ error: authz.error }, { status: 403 });
    const authUserEmail = normalizeEmail(authz?.authUserEmail || authUser.email);
    const effectiveEmailNorm = normalizeEmail(authz?.effectiveUserEmail || authUser.email);
    const isImpersonating = authz?.isImpersonating === true;
    const targetIsAdmin = authz?.isAdmin === true;
    const targetHasGlobalScope = authz?.hasGlobalScope === true;
    const targetPerms = { actions: authz?.actions || {}, acessos: authz?.acessos || [] };
    const criteriosAplicados = new Set();
    const warnings = [];
    let totalMilitaresEscopo = null;

    if (!targetIsAdmin && targetPerms.actions?.visualizar_contratos_designacao !== true && targetPerms.actions?.gerir_contratos_designacao !== true) {
      return Response.json(
        { error: 'Acesso negado: permissão funcional insuficiente.', requiredPermission: 'visualizar_contratos_designacao ou gerir_contratos_designacao' },
        { status: 403 },
      );
    }

    if (!targetHasGlobalScope) {
      const militarIds = await listarMilitarIdsDoEscopo(base44, targetPerms.acessos, criteriosAplicados);
      if (!militarIds || militarIds.length === 0) {
        warnings.push('SEM_ESCOPO');
        totalMilitaresEscopo = 0;
        return Response.json({
          contratos: [],
          meta: { isAdmin: targetIsAdmin, hasGlobalScope: targetHasGlobalScope, modoAcesso: getModoAcesso(criteriosAplicados), userEmail: authUserEmail || null, effectiveEmail: isImpersonating ? effectiveEmailNorm : null, warnings, totalMilitaresEscopo },
        });
      }
      totalMilitaresEscopo = militarIds.length;
      if (!new Set(militarIds.map(String)).has(militarId)) {
        return Response.json({ error: 'Acesso negado: militar fora do seu escopo.' }, { status: 403 });
      }
    } else {
      criteriosAplicados.add('global');
    }

    const contratos = await fetchWithRetry(
      () => base44.asServiceRole.entities.ContratoDesignacaoMilitar.filter({ militar_id: militarId }, '-data_inicio_contrato', 1000, 0),
      `ContratoDesignacaoMilitar.militar:${militarId}`,
    );
    const periodosLegado = await fetchWithRetry(
      () => base44.asServiceRole.entities.PeriodoAquisitivo.filter({ militar_id: militarId, legado_ativa: true }, '-legado_ativa_em', 1000, 0, CAMPOS_PERIODO_LEGADO),
      `PeriodoAquisitivo.legado:${militarId}`,
    );
    const contratoIds = new Set((contratos || []).map((c) => String(c?.id || '')).filter(Boolean));
    const legadoAtivaPorContrato = montarLegado((periodosLegado || []).filter((p) => contratoIds.has(String(p?.legado_ativa_contrato_designacao_id || ''))));

    return Response.json({
      contratos: contratos || [],
      legadoAtivaPorContrato,
      meta: {
        isAdmin: targetIsAdmin,
        hasGlobalScope: targetHasGlobalScope,
        modoAcesso: getModoAcesso(criteriosAplicados),
        userEmail: authUserEmail || null,
        effectiveEmail: isImpersonating ? effectiveEmailNorm : null,
        warnings,
        totalMilitaresEscopo,
      },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao carregar contratos de designação.', meta: { status } }, { status });
  }
});
