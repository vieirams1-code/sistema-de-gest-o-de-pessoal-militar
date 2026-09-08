import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const CHUNK_MILITAR_IDS = 200;

const normalizeTipo = (value: unknown) => String(value || '').trim().toLowerCase();

async function fetchWithRetry(queryFn: () => Promise<any>) {
  let lastError: any;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await queryFn();
    } catch (error: any) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      if (!RETRY_STATUS.has(status) || attempt === RETRY_MAX_ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(
        resolve,
        RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200),
      ));
    }
  }
  throw lastError;
}

async function resolverAutorizacaoCanonica(base44: any, effectiveEmail?: string) {
  const requestPayload = effectiveEmail ? { effectiveEmail } : {};
  const response = await base44.functions.invoke('getUserPermissions', requestPayload);
  return response?.data ?? response ?? {};
}

async function resolverEscopoConsolidado(base44: any, acessos: any[] = []) {
  if (!acessos?.length) return { tipo: 'vazio', estruturaIds: [], militarIdsProprios: [] };
  if (acessos.some((acesso) => normalizeTipo(acesso?.tipo_acesso) === 'admin')) return { isAdmin: true };

  const setores = acessos.filter((acesso) => normalizeTipo(acesso?.tipo_acesso) === 'setor' && acesso?.grupamento_id);
  const subsetores = acessos.filter((acesso) => normalizeTipo(acesso?.tipo_acesso) === 'subsetor' && acesso?.subgrupamento_id);
  const unidades = acessos.filter((acesso) => normalizeTipo(acesso?.tipo_acesso) === 'unidade' && acesso?.subgrupamento_id);
  const proprios = acessos.filter((acesso) => normalizeTipo(acesso?.tipo_acesso) === 'proprio');
  const estruturaIds = new Set<string>();

  if (setores.length) {
    const ids = [...new Set(setores.map((item) => item.grupamento_id).filter(Boolean))];
    ids.forEach((id) => estruturaIds.add(id));
    const descendentes = await fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter(
      { grupamento_raiz_id: { $in: ids } }, undefined, 1000, 0, ['id'],
    ));
    (descendentes || []).forEach((item: any) => item?.id && estruturaIds.add(item.id));
  }

  if (subsetores.length) {
    const ids = [...new Set(subsetores.map((item) => item.subgrupamento_id).filter(Boolean))];
    ids.forEach((id) => estruturaIds.add(id));
    const filhos = await fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter(
      { parent_id: { $in: ids } }, undefined, 1000, 0, ['id'],
    ));
    (filhos || []).forEach((item: any) => item?.id && estruturaIds.add(item.id));
  }

  unidades.forEach((item) => item?.subgrupamento_id && estruturaIds.add(item.subgrupamento_id));

  return {
    tipo: 'estrutura',
    estruturaIds: Array.from(estruturaIds),
    militarIdsProprios: proprios.map((item) => item?.militar_id).filter(Boolean),
  };
}

async function listarMilitaresEscopo(base44: any, escopo: any) {
  const ids = new Set<string>(escopo?.militarIdsProprios || []);
  if (!escopo?.estruturaIds?.length) return { ids: Array.from(ids), militares: [] };

  const militares = await fetchWithRetry(() => base44.asServiceRole.entities.Militar.filter(
    { estrutura_id: { $in: escopo.estruturaIds } }, undefined, 1000, 0,
  ));
  (militares || []).forEach((militar: any) => militar?.id && ids.add(militar.id));
  return { ids: Array.from(ids), militares: militares || [] };
}

async function listarPorEscopoIds(base44: any, militarIds: string[]) {
  const rows: any[] = [];
  let partialFailures = 0;
  for (let i = 0; i < militarIds.length; i += CHUNK_MILITAR_IDS) {
    try {
      const chunk = militarIds.slice(i, i + CHUNK_MILITAR_IDS);
      const result = await fetchWithRetry(() => base44.asServiceRole.entities.Medalha.filter(
        { militar_id: { $in: chunk } }, '-data_indicacao', 1000, 0,
      ));
      rows.push(...(result || []));
    } catch {
      partialFailures += 1;
    }
  }
  return { rows, partialFailures };
}

function filtrarSolicitacao(rows: any[] = [], payload: any = {}) {
  const medalhaId = String(payload?.medalhaId || '').trim();
  const tipoMedalhaCodigo = String(payload?.tipoMedalhaCodigo || '').trim();
  return (rows || []).filter((item) => {
    if (medalhaId && String(item?.id || '') !== medalhaId) return false;
    if (tipoMedalhaCodigo && String(item?.tipo_medalha_codigo || '') !== tipoMedalhaCodigo) return false;
    return true;
  });
}

async function listarGlobaisFiltradas(base44: any, payload: any) {
  const medalhaId = String(payload?.medalhaId || '').trim();
  const tipoMedalhaCodigo = String(payload?.tipoMedalhaCodigo || '').trim();
  if (medalhaId) {
    return fetchWithRetry(() => base44.asServiceRole.entities.Medalha.filter({ id: medalhaId }, '-data_indicacao', 10, 0));
  }
  if (tipoMedalhaCodigo) {
    return fetchWithRetry(() => base44.asServiceRole.entities.Medalha.filter(
      { tipo_medalha_codigo: tipoMedalhaCodigo }, '-data_indicacao', 1000, 0,
    ));
  }
  return fetchWithRetry(() => base44.asServiceRole.entities.Medalha.list('-data_indicacao'));
}

function autorizarLeitura(authz: any, payload: any) {
  if (authz?.isAdmin === true) return { ok: true };
  const purpose = String(payload?.readPurpose || 'VIEW').trim().toUpperCase();

  if (purpose === 'EDIT') {
    if (!String(payload?.medalhaId || '').trim()) {
      return { ok: false, status: 400, error: 'medalhaId é obrigatório para leitura de edição.' };
    }
    const ok = authz?.modules?.medalhas === true && authz?.actions?.editar_medalhas === true;
    return ok
      ? { ok: true }
      : { ok: false, status: 403, error: 'Acesso negado: editar medalha exige acesso a Medalhas e editar_medalhas.' };
  }

  if (purpose === 'MIGRATION') {
    if (!String(payload?.tipoMedalhaCodigo || '').trim()) {
      return { ok: false, status: 400, error: 'tipoMedalhaCodigo é obrigatório para leitura de migração.' };
    }
    const ok = authz?.modules?.migracao_alteracoes_legado === true;
    return ok
      ? { ok: true }
      : { ok: false, status: 403, error: 'Acesso negado: leitura para migração exige o módulo Migração de Alterações Legado.' };
  }

  const ok = authz?.modules?.medalhas === true && authz?.actions?.visualizar_medalhas === true;
  return ok
    ? { ok: true }
    : { ok: false, status: 403, error: 'Acesso negado: é necessário acesso a Medalhas e a permissão visualizar_medalhas.' };
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const authz = await resolverAutorizacaoCanonica(base44, payload?.effectiveEmail);
    if (authz?.error) return Response.json({ error: authz.error }, { status: 403 });

    const auth = autorizarLeitura(authz, payload);
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status || 403 });

    const targetEscopo = await resolverEscopoConsolidado(base44, authz?.acessos || []);
    const tiposMedalhaPromise = fetchWithRetry(() => base44.asServiceRole.entities.TipoMedalha.list('nome'));

    if (authz?.hasGlobalScope === true || targetEscopo?.isAdmin) {
      const [medalhas, tiposMedalha] = await Promise.all([
        listarGlobaisFiltradas(base44, payload),
        tiposMedalhaPromise,
      ]);
      const filtradas = filtrarSolicitacao(medalhas || [], payload);
      return Response.json({
        medalhas: filtradas,
        militares: [],
        tiposMedalha: tiposMedalha || [],
        meta: {
          totalMilitaresEscopo: null,
          totalMedalhas: filtradas.length,
          partialFailures: 0,
          warnings: [],
          hasMore: false,
        },
      });
    }

    const { ids, militares } = await listarMilitaresEscopo(base44, targetEscopo);
    if (!ids.length) {
      return Response.json({
        medalhas: [],
        militares: [],
        tiposMedalha: [],
        meta: {
          totalMilitaresEscopo: 0,
          totalMedalhas: 0,
          partialFailures: 0,
          warnings: ['SEM_ESCOPO'],
          hasMore: false,
        },
      });
    }

    const [medResult, tiposMedalha] = await Promise.all([
      listarPorEscopoIds(base44, ids),
      tiposMedalhaPromise,
    ]);
    const filtradas = filtrarSolicitacao(medResult.rows, payload);

    return Response.json({
      medalhas: filtradas,
      militares,
      tiposMedalha: tiposMedalha || [],
      meta: {
        totalMilitaresEscopo: ids.length,
        totalMedalhas: filtradas.length,
        partialFailures: medResult.partialFailures,
        warnings: medResult.partialFailures > 0 ? ['PARTIAL_FAILURES'] : [],
        hasMore: false,
      },
    });
  } catch (error: any) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({
      error: error?.message || 'Erro ao carregar getScopedMedalhasBundle.',
      meta: { status },
    }, { status });
  }
});
