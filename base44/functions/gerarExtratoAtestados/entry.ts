import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SENSITIVE_FIELDS = [
  'cid_10',
  'cid_descricao',
  'observacoes',
  'observacao',
  'observacoes_jiso',
  'parecer_jiso',
  'diagnostico',
  'hipotese_diagnostica',
  'nota_para_bg',
  'texto_publicacao',
  'das_escusas',
  'retorno',
  'crm_medico',
  'medico',
];

function sanitizeAtestado(atestado: Record<string, unknown>, incluirSensivel: boolean) {
  if (incluirSensivel) return { ...atestado };
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
    } catch {
      payload = {};
    }

    const formato = payload?.formato === 'pdf' ? 'pdf' : 'xlsx';
    const incluirSensivelSolicitado = Boolean(payload?.incluirSensivel);
    const idsSelecionados = Array.isArray(payload?.idsSelecionados) ? payload.idsSelecionados.map((id) => String(id)) : [];

    const scopedResponse = await base44.functions.invoke('getScopedAtestadosBundle', payload);
    const data = scopedResponse?.data ?? scopedResponse ?? {};
    const scopedAtestados = Array.isArray(data.atestados) ? data.atestados : [];

    const scopedIdSet = new Set(scopedAtestados.map((a: any) => String(a?.id)).filter(Boolean));
    const selectedIdSet = new Set(idsSelecionados.filter((id) => scopedIdSet.has(id)));

    const atestadosSelecionados = scopedAtestados
      .filter((atestado: any) => selectedIdSet.has(String(atestado?.id)))
      .map((atestado: any) => sanitizeAtestado(atestado, incluirSensivel));

    return Response.json({
      formato,
      atestados: atestadosSelecionados,
      extrato_parcial: atestadosSelecionados.length < scopedAtestados.length,
      meta: {
        totalNoEscopo: scopedAtestados.length,
        totalSelecionado: atestadosSelecionados.length,
        sensiveis_incluidos: incluirSensivel,
        sensiveis_bloqueados: incluirSensivelSolicitado && !podeVerSensivel,
      },
    });
  } catch (error) {
    const status = (error as any)?.response?.status || (error as any)?.status || 500;
    return Response.json({ error: (error as any)?.message || 'Erro ao gerar extrato de atestados.', meta: { status } }, { status });
  }
});
    const userPermsResponse = await base44.functions.invoke('getUserPermissions', payload);
    const userPerms = userPermsResponse?.data ?? userPermsResponse ?? {};
    const actions = (userPerms?.actions && typeof userPerms.actions === 'object') ? userPerms.actions : {};
    const podeVerSensivel = Boolean(actions?.ver_dados_sensiveis_atestado);
    const incluirSensivel = incluirSensivelSolicitado && podeVerSensivel;
