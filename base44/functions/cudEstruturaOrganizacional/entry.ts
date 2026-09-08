import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const OPERACOES = new Set(['create', 'update', 'delete']);
const ACOES_PERMITIDAS = new Set(['gerir_estrutura_organizacional', 'gerir_estrutura']);
const erro = (status: number, message: string) => Response.json({ error: message }, { status });

async function resolverAutorizacaoCanonica(base44: any) {
  const response = await base44.functions.invoke('getUserPermissions', {});
  return response?.data ?? response ?? {};
}

function validarPayload(operation: string, registroId: string | undefined, data: Record<string, unknown> | undefined) {
  if (!OPERACOES.has(operation)) throw new Error('Operação inválida. Use create, update ou delete.');
  if ((operation === 'update' || operation === 'delete') && !registroId) throw new Error('registroId é obrigatório para update/delete.');
  if ((operation === 'create' || operation === 'update') && (!data || typeof data !== 'object')) throw new Error('data é obrigatória para create/update.');
  if ((operation === 'create' || operation === 'update') && !String(data?.nome || '').trim()) throw new Error('nome é obrigatório para create/update.');
  if (operation === 'create' || operation === 'update') {
    const tipo = String(data?.tipo || '').trim();
    const nivel = Number(data?.nivel_hierarquico);
    const parent = String(data?.grupamento_id || data?.setor_pai_id || data?.parent_id || '').trim();
    if (!tipo) throw new Error('tipo é obrigatório.');
    if (![1, 2, 3].includes(nivel)) throw new Error('nivel_hierarquico inválido.');
    if (nivel === 1 && parent) throw new Error('Setor (nível 1) não pode ter unidade pai.');
    if (nivel > 1 && !parent) throw new Error('Subsetor/Unidade devem possuir unidade pai.');
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const operation = String(body?.operation || '').trim();
    const registroId = body?.registroId ? String(body.registroId) : undefined;
    const data = (body?.data && typeof body.data === 'object') ? body.data : undefined;
    validarPayload(operation, registroId, data as any);

    const user = await base44.auth.me();
    if (!user?.email) return erro(401, 'Usuário não autenticado.');

    const authz = await resolverAutorizacaoCanonica(base44);
    const actions = authz?.actions || {};
    const isPlatformAdmin = authz?.isAdmin === true;
    const autorizado = isPlatformAdmin || Array.from(ACOES_PERMITIDAS).some((acao) => actions?.[acao] === true);
    if (!autorizado) return erro(403, 'Sem permissão para gerir estrutura organizacional.');

    if (operation === 'create') return Response.json({ ok: true, data: await base44.asServiceRole.entities.Subgrupamento.create(data) });
    if (operation === 'update') return Response.json({ ok: true, data: await base44.asServiceRole.entities.Subgrupamento.update(registroId, data) });

    const id = String(registroId);
    const filhos = await base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: id }, undefined, 1, 0, ['id']);
    if ((filhos || []).length > 0) return erro(409, 'Não é possível excluir: existem unidades filhas vinculadas.');
    for (const filtro of [{ estrutura_id: id }, { subgrupamento_id: id }, { grupamento_id: id }]) {
      const vinculados = await base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1, 0, ['id']);
      if ((vinculados || []).length > 0) return erro(409, 'Não é possível excluir: existem militares vinculados a esta estrutura.');
    }
    return Response.json({ ok: true, data: await base44.asServiceRole.entities.Subgrupamento.delete(id) });
  } catch (err: any) {
    const message = err?.message || 'Erro inesperado no CUD da Estrutura Organizacional.';
    const status = Number(err?.status || err?.response?.status || 500);
    return erro(Number.isFinite(status) ? status : 500, message);
  }
});
