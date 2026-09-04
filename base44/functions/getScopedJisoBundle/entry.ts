import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PAGE_SIZE = 500;
const MAX_ROWS = 20000;
const ACTIONS_JISO = ['gerir_jiso', 'registrar_decisao_jiso', 'publicar_ata_jiso'];

function normalizeId(value: unknown) {
  return String(value || '').trim();
}

async function listAll(entity: any) {
  const rows: any[] = [];
  for (let skip = 0; skip < MAX_ROWS; skip += PAGE_SIZE) {
    const page = await entity.filter({}, undefined, PAGE_SIZE, skip);
    const list = Array.isArray(page) ? page : [];
    rows.push(...list);
    if (list.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchScopedMilitares(base44: any, payload: Record<string, unknown>) {
  const militares: any[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < MAX_ROWS; offset += pageSize) {
    const response = await base44.functions.invoke('getScopedMilitares', {
      ...payload,
      limit: pageSize,
      offset,
      includeFoto: false,
    });
    const data = response?.data ?? response ?? {};
    const page = Array.isArray(data?.militares) ? data.militares : [];
    militares.push(...page);
    if (page.length < pageSize) break;
  }
  return militares;
}

function projectAtestado(atestado: any) {
  return {
    id: atestado?.id,
    militar_id: atestado?.militar_id,
    militar_nome: atestado?.militar_nome,
    militar_posto: atestado?.militar_posto,
    militar_matricula: atestado?.militar_matricula,
    tipo_afastamento: atestado?.tipo_afastamento,
    data_inicio: atestado?.data_inicio,
    dias: atestado?.dias,
    data_termino: atestado?.data_termino,
    data_retorno: atestado?.data_retorno,
    status: atestado?.status,
    fluxo_homologacao: atestado?.fluxo_homologacao,
    necessita_jiso: atestado?.necessita_jiso,
    status_jiso: atestado?.status_jiso,
    data_jiso_agendada: atestado?.data_jiso_agendada,
    hora_jiso_agendada: atestado?.hora_jiso_agendada,
    jiso_id: atestado?.jiso_id,
    dias_jiso: atestado?.dias_jiso,
    data_termino_jiso: atestado?.data_termino_jiso,
    data_retorno_jiso: atestado?.data_retorno_jiso,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload: Record<string, unknown> = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const permissionResponse = await base44.functions.invoke('getUserPermissions', payload);
    const permissionData = permissionResponse?.data ?? permissionResponse ?? {};
    const actions = permissionData?.actions && typeof permissionData.actions === 'object'
      ? permissionData.actions
      : {};
    const isAdmin = Boolean(permissionData?.isAdmin) || String(authUser.role || '').toLowerCase() === 'admin';
    const podeVerJiso = isAdmin || ACTIONS_JISO.some((key) => actions?.[key] === true);
    if (!podeVerJiso) {
      return Response.json({
        error: 'Acesso negado: nenhuma permissão JISO disponível.',
        code: 'JISO_PERMISSION_REQUIRED',
      }, { status: 403 });
    }

    const militares = await fetchScopedMilitares(base44, payload);
    const militarIds = new Set(militares.map((item: any) => normalizeId(item?.id)).filter(Boolean));

    if (militarIds.size === 0) {
      return Response.json({
        jisos: [],
        vinculos: [],
        atestados: [],
        militares: [],
        meta: {
          total_jisos: 0,
          total_vinculos: 0,
          total_atestados: 0,
          total_militares_escopo: 0,
          generatedAt: new Date().toISOString(),
        },
      });
    }

    const [allJisos, allVinculos, allAtestados] = await Promise.all([
      listAll(base44.asServiceRole.entities.JISO),
      listAll(base44.asServiceRole.entities.JISOAtestado).catch(() => []),
      listAll(base44.asServiceRole.entities.Atestado),
    ]);

    const jisos = allJisos.filter((item: any) => militarIds.has(normalizeId(item?.militar_id)));
    const jisoIds = new Set(jisos.map((item: any) => normalizeId(item?.id)).filter(Boolean));

    const vinculos = allVinculos.filter((item: any) => (
      militarIds.has(normalizeId(item?.militar_id))
      && jisoIds.has(normalizeId(item?.jiso_id))
    ));

    const atestadoIdsVinculados = new Set(
      vinculos.map((item: any) => normalizeId(item?.atestado_id)).filter(Boolean),
    );
    for (const jiso of jisos) {
      const legadoId = normalizeId(jiso?.atestado_id);
      if (legadoId) atestadoIdsVinculados.add(legadoId);
    }

    const atestados = allAtestados
      .filter((item: any) => (
        militarIds.has(normalizeId(item?.militar_id))
        && (
          atestadoIdsVinculados.has(normalizeId(item?.id))
          || item?.necessita_jiso === true
          || String(item?.fluxo_homologacao || '').toLowerCase() === 'jiso'
        )
      ))
      .map(projectAtestado);

    return Response.json({
      jisos,
      vinculos,
      atestados,
      militares,
      meta: {
        total_jisos: jisos.length,
        total_vinculos: vinculos.length,
        total_atestados: atestados.length,
        total_militares_escopo: militares.length,
        include_legacy_links: true,
        sensitive_medical_fields_returned: false,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    const status = error?.status || error?.response?.status || 500;
    console.error('[getScopedJisoBundle] erro', { status, message: error?.message });
    return Response.json({
      error: error?.message || 'Erro ao carregar JISOs escopadas.',
      code: 'GET_SCOPED_JISO_BUNDLE_FAILED',
    }, { status });
  }
});
