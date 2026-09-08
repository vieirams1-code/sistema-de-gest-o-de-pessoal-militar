import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ENTIDADES = new Set(['RegistroLivro', 'PublicacaoExOfficio']);
const CAMPOS_EDICAO_TIPO = new Set(['tipo_registro', 'tipo', 'tipo_alterado_por', 'tipo_alterado_em']);

function erro(status: number, message: string, requiredPermission?: string) {
  return Response.json({ error: message, ...(requiredPermission ? { requiredPermission } : {}) }, { status });
}

async function resolverAutorizacao(base44: any) {
  const response = await base44.functions.invoke('getUserPermissions', {});
  return response?.data ?? response ?? {};
}

function temAcao(authz: any, action: string) {
  return authz?.isAdmin === true || authz?.actions?.[action] === true;
}

function dentroEscopo(authz: any, militarId: unknown) {
  if (authz?.isAdmin === true || authz?.hasGlobalScope === true) return true;
  const alvo = String(militarId || '').trim();
  if (!alvo) return false;
  const ids = Array.isArray(authz?.allowedMilitarIds)
    ? authz.allowedMilitarIds.map(String)
    : Array.isArray(authz?.scopeCheck?.allowedIds)
      ? authz.scopeCheck.allowedIds.map(String)
      : [];
  return ids.includes(alvo);
}

async function carregarRegistro(base44: any, entityName: string, id: string) {
  const entity = base44.asServiceRole.entities[entityName];
  const registro = await entity.get(id).catch(() => null);
  return registro?.id ? registro : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return erro(401, 'Não autenticado.');

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toUpperCase();
    const entityName = String(body?.entityName || '').trim();
    const id = String(body?.id || '').trim();
    const data = body?.data && typeof body.data === 'object' ? body.data : {};

    if (!ENTIDADES.has(entityName)) return erro(400, 'Entidade de registro inválida.');
    if (!id) return erro(400, 'ID do registro é obrigatório.');

    const authz = await resolverAutorizacao(base44);
    const registro = await carregarRegistro(base44, entityName, id);
    if (!registro) return erro(404, 'Registro não encontrado.');
    if (!dentroEscopo(authz, registro?.militar_id)) return erro(403, 'Registro fora do escopo organizacional autorizado.');

    if (action === 'UPDATE_TYPE') {
      if (!temAcao(authz, 'editar_registros_militar')) {
        return erro(403, 'Sem permissão para editar registros do militar.', 'editar_registros_militar');
      }
      const chaves = Object.keys(data || {});
      if (!chaves.length || !chaves.every((key) => CAMPOS_EDICAO_TIPO.has(key))) {
        return erro(400, 'Esta operação permite alterar apenas a classificação do registro.');
      }
      const campoTipo = entityName === 'PublicacaoExOfficio' ? 'tipo' : 'tipo_registro';
      const tipo = String(data?.[campoTipo] || '').trim();
      if (!tipo) return erro(400, 'Tipo do registro é obrigatório.');

      const payload = {
        [campoTipo]: tipo,
        tipo_alterado_por: String(user?.email || ''),
        tipo_alterado_em: new Date().toISOString(),
      };
      const atualizado = await base44.asServiceRole.entities[entityName].update(id, payload);
      return Response.json({ data: atualizado });
    }

    if (action === 'DELETE') {
      if (!temAcao(authz, 'excluir_registros_militar')) {
        return erro(403, 'Sem permissão para excluir registros do militar.', 'excluir_registros_militar');
      }
      await base44.asServiceRole.entities[entityName].delete(id);
      return Response.json({ data: { id, deleted: true } });
    }

    return erro(400, 'Ação inválida.');
  } catch (error: any) {
    console.error('[registrosMilitarGateway]', error?.message || error);
    return erro(Number(error?.status || 500), error?.message || 'Erro interno no gateway de Registros do Militar.');
  }
});
