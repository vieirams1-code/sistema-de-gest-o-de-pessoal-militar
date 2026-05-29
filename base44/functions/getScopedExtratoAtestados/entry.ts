import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CHUNK_SIZE = 200;

const SENSITIVE_FIELDS = [
  'cid_10',
  'observacoes',
  'observacao',
  'observacoes_jiso',
  'parecer_jiso',
  'diagnostico',
  'hipotese_diagnostica',
];

function sanitizeAtestado(atestado: Record<string, unknown>) {
  const clone: Record<string, unknown> = { ...atestado };
  for (const key of SENSITIVE_FIELDS) {
    if (key in clone) delete clone[key];
  }
  return clone;
}

function normalizeId(value: unknown) {
  return String(value || '').trim();
}

async function listarEncaminhamentos(base44: ReturnType<typeof createClientFromRequest>, atestadoIds: string[]) {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < atestadoIds.length; i += CHUNK_SIZE) {
    const chunk = atestadoIds.slice(i, i + CHUNK_SIZE);
    if (!chunk.length) continue;
    const encontrados = await base44.asServiceRole.entities.AtestadoEncaminhamento.filter(
      { atestado_id: { $in: chunk } },
      undefined,
      1000,
      0,
    );
    if (Array.isArray(encontrados)) rows.push(...encontrados);
  }
  return rows;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch (_e) {
      payload = {};
    }

    const scopedResponse = await base44.functions.invoke('getScopedAtestadosBundle', payload);
    const data = scopedResponse?.data ?? scopedResponse ?? {};

    const atestadosRaw = Array.isArray(data.atestados) ? data.atestados : [];
    const jisos = Array.isArray(data.jisos) ? data.jisos : [];

    const atestadoIds = Array.from(new Set(atestadosRaw.map((item) => normalizeId(item?.id)).filter(Boolean)));
    const encaminhamentos = atestadoIds.length ? await listarEncaminhamentos(base44, atestadoIds) : [];

    return Response.json({
      atestados: atestadosRaw.map((item) => sanitizeAtestado(item)),
      jisos,
      encaminhamentos,
      meta: data.meta || {},
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao carregar getScopedExtratoAtestados.', meta: { status } }, { status });
  }
});
