import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    return Response.json({
      atestados: atestadosRaw.map((item) => sanitizeAtestado(item)),
      jisos,
      meta: data.meta || {},
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao carregar getScopedExtratoAtestados.', meta: { status } }, { status });
  }
});
