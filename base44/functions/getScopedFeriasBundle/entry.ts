import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const LIMIT_USUARIO_ACESSO = 1000;
const CHUNK_MILITAR_IDS = 200;
const CHUNK_FERIAS_IDS = 100;
const LIMIT_FERIAS_TAGS_PER_CHUNK = 5000;
const FERIAS_TAGS_CONCURRENCY_FALLBACK = 8;

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

function extrairMatrizPermissoes(descricao) {
  if (typeof descricao !== 'string' || !descricao) return {};
  const start = descricao.indexOf('[SGP_PERMISSIONS_MATRIX]');
  const end = descricao.indexOf('[/SGP_PERMISSIONS_MATRIX]');
  if (start === -1 || end === -1 || end <= start) return {};
  try {
    const parsed = JSON.parse(descricao.slice(start + '[SGP_PERMISSIONS_MATRIX]'.length, end).trim());
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_e) {
    return {};
  }
}

function consolidarPermissoesFerias(perfis = []) {
  const modules = {};
  const actions = {};
  const aplicar = (fonte) => {
    if (!fonte || typeof fonte !== 'object') return;
    for (const [key, value] of Object.entries(fonte)) {
      if (value !== true) continue;
      if (key.startsWith('acesso_')) modules[key.replace(/^acesso_/, '')] = true;
      if (key.startsWith('perm_')) actions[key.replace(/^perm_/, '')] = true;
    }
  };
  for (const perfil of perfis || []) {
    aplicar(perfil);
    aplicar(extrairMatrizPermissoes(perfil?.descricao));
  }
  return { modules, actions };
}

async function resolverPermissoes(base44, email) {
  const acessos = await fetchWithRetry(() => base44.asServiceRole.entities.UsuarioAcesso.filter({ user_email: email, ativo: true }, undefined, LIMIT_USUARIO_ACESSO, 0, CAMPOS_USUARIO_ACESSO), `usuarioAcesso.list:${email}`);
  const perfilIds = Array.from(new Set((acessos || []).map((a) => a?.perfil_id).filter(Boolean)));
  const perfis = perfilIds.length
    ? await fetchWithRetry(() => base44.asServiceRole.entities.PerfilPermissao.filter({ id: { $in: perfilIds }, ativo: true }), `perfilPermissao.in:${email}`)
    : [];
  const { modules, actions } = consolidarPermissoesFerias(perfis || []);
  return {
    acessos: acessos || [],
    modules,
    actions,
    hasGlobalScope: (acessos || []).some((a) => normalizeTipo(a.tipo_acesso) === 'admin'),
    canViewFerias: modules.ferias === true && actions.visualizar_ferias === true,
  };
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

async function listarFeriasTagsPorFeriasIds(base44, feriasIds) {
  const out = [];
  const seen = new Set();
  let partialFailures = 0;
  let usedFallback = false;

  if (!Array.isArray(feriasIds) || feriasIds.length === 0) {
    return { rows: [], partialFailures: 0, usedFallback: false };
  }

  const idsNormalizados = Array.from(new Set(feriasIds.map(String).filter(Boolean)));

  for (let i = 0; i < idsNormalizados.length; i += CHUNK_FERIAS_IDS) {
    const chunk = idsNormalizados.slice(i, i + CHUNK_FERIAS_IDS);
    let chunkOk = false;
    try {
      const rows = await fetchWithRetry(
        () => base44.asServiceRole.entities.FeriasTag.filter(
          { ferias_id: { $in: chunk } },
          '-created_date',
          LIMIT_FERIAS_TAGS_PER_CHUNK,
          0,
        ),
        'feriasTag.in.chunk',
      );
      for (const r of (rows || [])) {
        if (!r?.id || seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(r);
      }
      chunkOk = true;
    } catch (errIn) {
      console.warn('[getScopedFeriasBundle] feriasTag.$in chunk falhou — usando fallback por id', errIn?.message);
    }

    if (chunkOk) continue;

    usedFallback = true;
    for (let j = 0; j < chunk.length; j += FERIAS_TAGS_CONCURRENCY_FALLBACK) {
      const slice = chunk.slice(j, j + FERIAS_TAGS_CONCURRENCY_FALLBACK);
      const results = await Promise.allSettled(slice.map((feriasId) => fetchWithRetry(
        () => base44.asServiceRole.entities.FeriasTag.filter({ ferias_id: feriasId }, '-created_date', 1000, 0),
        `feriasTag.byId:${feriasId}`,
      )));
      for (const res of results) {
        if (res.status !== 'fulfilled') {
          partialFailures += 1;
          continue;
        }
        for (const r of (res.value || [])) {
          if (!r?.id || seen.has(r.id)) continue;
          seen.add(r.id);
          out.push(r);
        }
      }
    }
  }

  return { rows: out, partialFailures, usedFallback };
}

async function listarCatalogoTagsParaFeriasTags(base44, feriasTags) {
  if (!Array.isArray(feriasTags) || feriasTags.length === 0) return { rows: [], partialFailures: 0 };
  const tagIds = Array.from(new Set(feriasTags.map((v) => String(v?.tag_id || '')).filter(Boolean)));
  if (tagIds.length === 0) return { rows: [], partialFailures: 0 };

  const out = [];
  const seen = new Set();
  let partialFailures = 0;
  for (let i = 0; i < tagIds.length; i += CHUNK_FERIAS_IDS) {
    const chunk = tagIds.slice(i, i + CHUNK_FERIAS_IDS);
    try {
      const rows = await fetchWithRetry(
        () => base44.asServiceRole.entities.Tag.filter({ id: { $in: chunk } }, undefined, 1000, 0),
        'tag.catalogo.chunk',
      );
      for (const r of (rows || [])) {
        if (!r?.id || seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(r);
      }
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
    const authIsAdminByRole = String(authUser.role || '').toLowerCase() === 'admin';
    if (wantsImpersonation && !authIsAdminByRole) {
      return Response.json({ error: 'Ação não permitida: somente administradores da plataforma podem usar effectiveEmail.' }, { status: 403 });
    }

    const isImpersonating = wantsImpersonation && authIsAdminByRole;
    const targetEmail = isImpersonating ? effectiveEmailNorm : authUser.email;
    const targetPerms = isImpersonating ? await resolverPermissoes(base44, targetEmail) : authPerms;
    const targetCanViewFerias = !isImpersonating && authIsAdminByRole ? true : targetPerms.canViewFerias;
    if (!targetCanViewFerias) {
      return Response.json({ error: 'Acesso negado: é necessária a permissão de visualizar férias.', requiredPermission: 'visualizar_ferias' }, { status: 403 });
    }
    const targetHasGlobalScope = (!isImpersonating && authIsAdminByRole) || targetPerms.hasGlobalScope;

    if (targetHasGlobalScope) {
      const [ferias, registrosLivro] = await Promise.all([
        fetchWithRetry(() => base44.asServiceRole.entities.Ferias.list('-data_inicio'), 'ferias.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.RegistroLivro.list(), 'registroLivro.admin'),
      ]);

      const feriasIdsAdmin = (ferias || []).map((f) => String(f?.id || '')).filter(Boolean);
      const feriasTagsResultAdmin = await listarFeriasTagsPorFeriasIds(base44, feriasIdsAdmin);
      const tagsCatalogoAdmin = await listarCatalogoTagsParaFeriasTags(base44, feriasTagsResultAdmin.rows);

      const warningsAdmin = [];
      if (feriasTagsResultAdmin.partialFailures > 0) warningsAdmin.push('FERIAS_TAGS_PARTIAL_FAILURES');
      if (feriasTagsResultAdmin.usedFallback) warningsAdmin.push('FERIAS_TAGS_FALLBACK');
      if (tagsCatalogoAdmin.partialFailures > 0) warningsAdmin.push('TAGS_CATALOGO_PARTIAL_FAILURES');

      return Response.json({
        ferias: ferias || [],
        registrosLivro: registrosLivro || [],
        feriasTags: feriasTagsResultAdmin.rows,
        tagsCatalogo: tagsCatalogoAdmin.rows,
        meta: {
          totalMilitaresEscopo: null,
          totalFerias: (ferias || []).length,
          totalRegistrosLivro: (registrosLivro || []).length,
          totalFeriasTags: feriasTagsResultAdmin.rows.length,
          totalTagsCatalogo: tagsCatalogoAdmin.rows.length,
          hasMore: false,
          partialFailures: 0,
          feriasTagsPartialFailures: feriasTagsResultAdmin.partialFailures,
          feriasTagsUsedFallback: feriasTagsResultAdmin.usedFallback,
          warnings: warningsAdmin,
          targetIsAdmin: true,
          hasGlobalScope: true,
        },
      });
    }

    const militarIds = await listarMilitarIdsDoEscopo(base44, targetPerms.acessos);
    if (!militarIds || militarIds.length === 0) {
      return Response.json({
        ferias: [],
        registrosLivro: [],
        feriasTags: [],
        tagsCatalogo: [],
        meta: {
          totalMilitaresEscopo: 0,
          totalFerias: 0,
          totalRegistrosLivro: 0,
          totalFeriasTags: 0,
          totalTagsCatalogo: 0,
          hasMore: false,
          partialFailures: 0,
          feriasTagsPartialFailures: 0,
          feriasTagsUsedFallback: false,
          warnings: ['SEM_ESCOPO'],
          targetIsAdmin: false,
          hasGlobalScope: false,
        },
      });
    }

    const [feriasResult, registrosResult] = await Promise.all([
      listarPorEscopoIds(base44, 'Ferias', militarIds, '-data_inicio'),
      listarPorEscopoIds(base44, 'RegistroLivro', militarIds, undefined),
    ]);

    const feriasIdsEscopo = feriasResult.rows.map((f) => String(f?.id || '')).filter(Boolean);
    const feriasTagsResult = await listarFeriasTagsPorFeriasIds(base44, feriasIdsEscopo);
    const tagsCatalogoResult = await listarCatalogoTagsParaFeriasTags(base44, feriasTagsResult.rows);

    const partialFailures = feriasResult.partialFailures + registrosResult.partialFailures;
    const warnings = [];
    if (partialFailures > 0) warnings.push('PARTIAL_FAILURES');
    if (feriasTagsResult.partialFailures > 0) warnings.push('FERIAS_TAGS_PARTIAL_FAILURES');
    if (feriasTagsResult.usedFallback) warnings.push('FERIAS_TAGS_FALLBACK');
    if (tagsCatalogoResult.partialFailures > 0) warnings.push('TAGS_CATALOGO_PARTIAL_FAILURES');

    return Response.json({
      ferias: feriasResult.rows,
      registrosLivro: registrosResult.rows,
      feriasTags: feriasTagsResult.rows,
      tagsCatalogo: tagsCatalogoResult.rows,
      meta: {
        totalMilitaresEscopo: militarIds.length,
        totalFerias: feriasResult.rows.length,
        totalRegistrosLivro: registrosResult.rows.length,
        totalFeriasTags: feriasTagsResult.rows.length,
        totalTagsCatalogo: tagsCatalogoResult.rows.length,
        hasMore: false,
        partialFailures,
        feriasTagsPartialFailures: feriasTagsResult.partialFailures,
        feriasTagsUsedFallback: feriasTagsResult.usedFallback,
        warnings,
        targetIsAdmin: false,
      },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao carregar bundle de férias.', meta: { status } }, { status });
  }
});