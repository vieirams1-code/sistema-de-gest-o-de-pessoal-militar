import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const REQUIRED_PERMISSION = 'perm_gerir_encaminhamento_dp_dintel_atestado';
const ACTION_KEY = 'gerir_encaminhamento_dp_dintel_atestado';

type Destino = 'DP' | 'DINTEL';

function normalizeId(value: unknown) {
  return String(value || '').trim();
}

function normalizeDestino(value: unknown): Destino | '' {
  const destino = String(value || '').trim().toUpperCase();
  return destino === 'DP' || destino === 'DINTEL' ? destino : '';
}

function normalizeMotivo(value: unknown) {
  return String(value || '').trim().slice(0, 500);
}

function buildUserSnapshot(user: Record<string, unknown> | null | undefined) {
  const email = String(user?.email || '').trim().toLowerCase();
  return {
    id: String(user?.id || '').trim(),
    email,
    nome: String(user?.full_name || user?.name || email || '').trim(),
  };
}

function responseError(status: number, code: string, error: string, meta: Record<string, unknown> = {}) {
  return Response.json({ error, code, meta }, { status });
}

async function registrarAuditoria(
  base44: ReturnType<typeof createClientFromRequest>,
  params: {
    acao: string;
    atestadoId: string;
    militarId: string;
    destino: Destino;
    enviado: boolean;
    versaoAnterior: number;
    versaoNova: number;
    motivo: string;
    user: ReturnType<typeof buildUserSnapshot>;
  },
) {
  const payload = {
    modulo: 'Atestados',
    origem: 'alterarEncaminhamentoAtestado',
    acao: params.acao,
    atestado_id: params.atestadoId,
    militar_id: params.militarId,
    destino: params.destino,
    enviado: params.enviado,
    versao_anterior: params.versaoAnterior,
    versao_nova: params.versaoNova,
    motivo: params.motivo || null,
    usuario_id: params.user.id,
    usuario_email: params.user.email,
    usuario_nome: params.user.nome,
    data_hora: new Date().toISOString(),
    sensiveis_incluidos: false,
  };

  await base44.asServiceRole.entities.AssistenteLog.create({
    tipo: 'auditoria_encaminhamento_atestado',
    acao: params.acao,
    descricao: JSON.stringify(payload),
    metadata: payload,
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return responseError(401, 'UNAUTHENTICATED', 'Não autenticado.');

    let payload: Record<string, unknown> = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const atestadoId = normalizeId(payload?.atestado_id);
    const destino = normalizeDestino(payload?.destino);
    const enviado = payload?.enviado;
    const motivo = normalizeMotivo(payload?.motivo);
    const expectedVersao = payload?.expected_versao;

    if (!atestadoId) return responseError(400, 'ATESTADO_ID_REQUIRED', 'atestado_id é obrigatório.');
    if (!destino) return responseError(400, 'DESTINO_INVALIDO', 'destino deve ser DP ou DINTEL.');
    if (typeof enviado !== 'boolean') return responseError(400, 'ENVIADO_INVALIDO', 'enviado deve ser booleano.');
    if (enviado === false && !motivo) return responseError(400, 'MOTIVO_OBRIGATORIO', 'motivo é obrigatório ao desmarcar encaminhamento.');
    if (expectedVersao !== undefined && (!Number.isFinite(Number(expectedVersao)) || Number(expectedVersao) < 0)) {
      return responseError(400, 'EXPECTED_VERSAO_INVALIDA', 'expected_versao deve ser um número não negativo.');
    }

    const permissionsResponse = await base44.functions.invoke('getUserPermissions', payload);
    const permissions = permissionsResponse?.data ?? permissionsResponse ?? {};
    const actions = (permissions?.actions && typeof permissions.actions === 'object') ? permissions.actions : {};
    const isAdmin = Boolean(permissions?.isAdmin) || String(authUser.role || '').toLowerCase() === 'admin';
    if (!isAdmin && !actions?.[ACTION_KEY]) {
      return responseError(403, 'FORBIDDEN_PERMISSION', `Permissão ${REQUIRED_PERMISSION} é obrigatória para gerir encaminhamento DP/DINTEL de atestados.`);
    }

    const [atestado] = await base44.asServiceRole.entities.Atestado.filter({ id: atestadoId }, undefined, 1, 0);
    if (!atestado) return responseError(404, 'ATESTADO_NOT_FOUND', 'Atestado não encontrado.');
    const militarId = normalizeId(atestado?.militar_id);
    if (!militarId) return responseError(422, 'ATESTADO_SEM_MILITAR', 'Atestado sem militar_id válido.');

    const scopedResponse = await base44.functions.invoke('getScopedAtestadosBundle', payload);
    const scopedData = scopedResponse?.data ?? scopedResponse ?? {};
    const scopedAtestados = Array.isArray(scopedData?.atestados) ? scopedData.atestados : [];
    const isInScope = scopedAtestados.some((item) => normalizeId(item?.id) === atestadoId && normalizeId(item?.militar_id) === militarId);
    if (!isInScope) return responseError(403, 'ATESTADO_OUT_OF_SCOPE', 'Atestado fora do escopo permitido do usuário.');

    const rows = await base44.asServiceRole.entities.AtestadoEncaminhamento.filter({ atestado_id: atestadoId }, '-created_date', 1, 0);
    let encaminhamento = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!encaminhamento) {
      encaminhamento = await base44.asServiceRole.entities.AtestadoEncaminhamento.create({
        atestado_id: atestadoId,
        militar_id: militarId,
        enviado_dp: false,
        enviado_dintel: false,
        versao: 0,
      });
    }

    const versaoAtual = Number(encaminhamento?.versao || 0);
    if (expectedVersao !== undefined && Number(expectedVersao) !== versaoAtual) {
      return responseError(409, 'ENCAMINHAMENTO_CONFLICT', 'Encaminhamento foi alterado por outro usuário. Recarregue os dados e tente novamente.', {
        expected_versao: Number(expectedVersao),
        versao_atual: versaoAtual,
        encaminhamento,
      });
    }

    const nowIso = new Date().toISOString();
    const userSnapshot = buildUserSnapshot(authUser);
    const prefix = destino === 'DP' ? 'enviado_dp' : 'enviado_dintel';
    const novaVersao = versaoAtual + 1;
    const patch: Record<string, unknown> = {
      militar_id: militarId,
      [prefix]: enviado,
      [`${prefix}_em`]: nowIso,
      [`${prefix}_por_id`]: userSnapshot.id,
      [`${prefix}_por_email`]: userSnapshot.email,
      [`${prefix}_por_nome`]: userSnapshot.nome,
      versao: novaVersao,
      atualizado_em: nowIso,
      atualizado_por_id: userSnapshot.id,
      atualizado_por_email: userSnapshot.email,
      atualizado_por_nome: userSnapshot.nome,
    };

    const atualizado = await base44.asServiceRole.entities.AtestadoEncaminhamento.update(encaminhamento.id, patch);
    const acao = `${enviado ? 'marcar' : 'desmarcar'}_enviado_${destino.toLowerCase()}`;
    await registrarAuditoria(base44, {
      acao,
      atestadoId,
      militarId,
      destino,
      enviado,
      versaoAnterior: versaoAtual,
      versaoNova: novaVersao,
      motivo,
      user: userSnapshot,
    });

    return Response.json({ encaminhamento: atualizado, meta: { acao, permissao: REQUIRED_PERMISSION } });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao alterar encaminhamento de atestado.', code: 'ALTERAR_ENCAMINHAMENTO_FAILED', meta: { status } }, { status });
  }
});
