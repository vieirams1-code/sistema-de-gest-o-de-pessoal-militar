import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACTION_GERIR_JISO = 'gerir_jiso';
const ACTION_REGISTRAR_DECISAO = 'registrar_decisao_jiso';
const OPERACOES = new Set(['create', 'update', 'delete']);
const CAMPOS_IDENTIDADE = new Set(['jiso_id', 'atestado_id', 'militar_id']);
const CAMPOS_UPDATE_PERMITIDOS = new Set([
  'tipo_vinculo',
  'resultado_atestado',
  'dias_homologados',
  'data_termino_resultante',
  'data_retorno_resultante',
  'observacoes',
]);

function normalizeId(value: unknown) {
  return String(value || '').trim();
}

function responseError(status: number, code: string, error: string, meta: Record<string, unknown> = {}) {
  return Response.json({ error, code, meta }, { status });
}

function buildUserSnapshot(user: any) {
  const email = String(user?.email || '').trim().toLowerCase();
  return {
    id: String(user?.id || '').trim(),
    email,
    nome: String(user?.full_name || user?.name || email || '').trim(),
  };
}

async function resolvePermissions(base44: any, payload: Record<string, unknown>, authUser: any) {
  const response = await base44.functions.invoke('getUserPermissions', payload);
  const data = response?.data ?? response ?? {};
  const actions = data?.actions && typeof data.actions === 'object' ? data.actions : {};
  const isAdmin = Boolean(data?.isAdmin) || String(authUser?.role || '').toLowerCase() === 'admin';
  return { actions, isAdmin };
}

async function buscarJiso(base44: any, jisoId: string) {
  const rows = await base44.asServiceRole.entities.JISO.filter({ id: jisoId }, undefined, 1, 0);
  return rows?.[0] || null;
}

async function buscarAtestado(base44: any, atestadoId: string) {
  const rows = await base44.asServiceRole.entities.Atestado.filter({ id: atestadoId }, undefined, 1, 0);
  return rows?.[0] || null;
}

async function buscarVinculo(base44: any, id: string) {
  const rows = await base44.asServiceRole.entities.JISOAtestado.filter({ id }, undefined, 1, 0);
  return rows?.[0] || null;
}

async function garantirAtestadoNoEscopo(base44: any, payload: Record<string, unknown>, atestadoId: string, militarId: string) {
  const response = await base44.functions.invoke('getScopedAtestadosBundle', payload);
  const data = response?.data ?? response ?? {};
  const atestados = Array.isArray(data?.atestados) ? data.atestados : [];
  return atestados.some((item: any) => (
    normalizeId(item?.id) === atestadoId && normalizeId(item?.militar_id) === militarId
  ));
}

async function validarParJisoAtestado(base44: any, payload: Record<string, unknown>, jisoId: string, atestadoId: string, militarIdInformado = '') {
  const [jiso, atestado] = await Promise.all([
    buscarJiso(base44, jisoId),
    buscarAtestado(base44, atestadoId),
  ]);

  if (!jiso) {
    const erro: any = new Error('JISO não encontrada.');
    erro.status = 404;
    erro.code = 'JISO_NOT_FOUND';
    throw erro;
  }
  if (!atestado) {
    const erro: any = new Error('Atestado não encontrado.');
    erro.status = 404;
    erro.code = 'ATESTADO_NOT_FOUND';
    throw erro;
  }

  const militarJiso = normalizeId(jiso?.militar_id);
  const militarAtestado = normalizeId(atestado?.militar_id);
  const militarPayload = normalizeId(militarIdInformado);

  if (!militarJiso || !militarAtestado) {
    const erro: any = new Error('JISO ou atestado sem militar_id válido.');
    erro.status = 422;
    erro.code = 'MILITAR_ID_INVALIDO';
    throw erro;
  }
  if (militarJiso !== militarAtestado) {
    const erro: any = new Error('A JISO e o atestado pertencem a militares diferentes.');
    erro.status = 409;
    erro.code = 'JISO_ATESTADO_MILITAR_DIVERGENTE';
    throw erro;
  }
  if (militarPayload && militarPayload !== militarJiso) {
    const erro: any = new Error('militar_id informado diverge do militar da JISO e do atestado.');
    erro.status = 409;
    erro.code = 'MILITAR_ID_DIVERGENTE';
    throw erro;
  }

  const noEscopo = await garantirAtestadoNoEscopo(base44, payload, atestadoId, militarJiso);
  if (!noEscopo) {
    const erro: any = new Error('Atestado fora do escopo permitido do usuário.');
    erro.status = 403;
    erro.code = 'ATESTADO_OUT_OF_SCOPE';
    throw erro;
  }

  return { jiso, atestado, militarId: militarJiso };
}

async function garantirSemVinculoAtivoDuplicado(base44: any, jisoId: string, atestadoId: string, ignorarId = '') {
  const existentes = await base44.asServiceRole.entities.JISOAtestado.filter({
    jiso_id: jisoId,
    atestado_id: atestadoId,
    ativo: true,
  }, undefined, 100, 0);

  const duplicado = (existentes || []).find((item: any) => normalizeId(item?.id) !== normalizeId(ignorarId));
  if (duplicado) {
    const erro: any = new Error('Este atestado já possui vínculo ativo com esta JISO.');
    erro.status = 409;
    erro.code = 'JISO_ATESTADO_VINCULO_DUPLICADO';
    throw erro;
  }
}

async function registrarAuditoria(base44: any, params: Record<string, unknown>) {
  const metadata = {
    modulo: 'JISO',
    origem: 'cudJisoAtestado',
    ...params,
    data_hora: new Date().toISOString(),
  };
  await base44.asServiceRole.entities.AssistenteLog.create({
    tipo: 'auditoria_jiso_atestado',
    acao: String(params?.acao || 'alteracao'),
    descricao: JSON.stringify(metadata),
    metadata,
  }).catch((error: any) => {
    console.warn('[cudJisoAtestado] falha ao registrar auditoria', error?.message || error);
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return responseError(401, 'UNAUTHENTICATED', 'Não autenticado.');

    let payload: Record<string, any> = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const operation = String(payload?.operation || '').trim().toLowerCase();
    const registroId = normalizeId(payload?.registroId || payload?.id);
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};

    if (!OPERACOES.has(operation)) {
      return responseError(400, 'OPERATION_INVALID', 'operation deve ser create, update ou delete.');
    }
    if ((operation === 'update' || operation === 'delete') && !registroId) {
      return responseError(400, 'REGISTRO_ID_REQUIRED', 'registroId é obrigatório para update/delete.');
    }

    const { actions, isAdmin } = await resolvePermissions(base44, payload, authUser);
    const podeGerir = isAdmin || actions?.[ACTION_GERIR_JISO] === true;
    const podeRegistrarDecisao = isAdmin || actions?.[ACTION_REGISTRAR_DECISAO] === true;

    if (operation === 'create' || operation === 'delete') {
      if (!podeGerir) {
        return responseError(403, 'FORBIDDEN_PERMISSION', 'Permissão gerir_jiso é obrigatória para vincular ou desvincular atestados da JISO.');
      }
    } else if (!podeRegistrarDecisao) {
      return responseError(403, 'FORBIDDEN_PERMISSION', 'Permissão registrar_decisao_jiso é obrigatória para registrar efeitos da JISO sobre o atestado.');
    }

    const userSnapshot = buildUserSnapshot(authUser);

    if (operation === 'create') {
      const jisoId = normalizeId(data?.jiso_id);
      const atestadoId = normalizeId(data?.atestado_id);
      if (!jisoId) return responseError(400, 'JISO_ID_REQUIRED', 'jiso_id é obrigatório.');
      if (!atestadoId) return responseError(400, 'ATESTADO_ID_REQUIRED', 'atestado_id é obrigatório.');

      const { militarId } = await validarParJisoAtestado(base44, payload, jisoId, atestadoId, data?.militar_id);
      await garantirSemVinculoAtivoDuplicado(base44, jisoId, atestadoId);

      const criado = await base44.asServiceRole.entities.JISOAtestado.create({
        jiso_id: jisoId,
        atestado_id: atestadoId,
        militar_id: militarId,
        tipo_vinculo: data?.tipo_vinculo || 'Homologação',
        origem_vinculo: data?.origem_vinculo || 'manual',
        resultado_atestado: data?.resultado_atestado || '',
        dias_homologados: data?.dias_homologados ?? null,
        data_termino_resultante: data?.data_termino_resultante || '',
        data_retorno_resultante: data?.data_retorno_resultante || '',
        observacoes: data?.observacoes || '',
        ativo: true,
        desvinculado_em: '',
        desvinculado_por: '',
      });

      await registrarAuditoria(base44, {
        acao: 'vincular_atestado_jiso',
        jiso_id: jisoId,
        atestado_id: atestadoId,
        militar_id: militarId,
        vinculo_id: criado?.id || '',
        usuario_id: userSnapshot.id,
        usuario_email: userSnapshot.email,
      });

      return Response.json({ ok: true, operation, data: criado });
    }

    const existente = await buscarVinculo(base44, registroId);
    if (!existente) return responseError(404, 'VINCULO_NOT_FOUND', 'Vínculo JISOAtestado não encontrado.');

    const jisoId = normalizeId(existente?.jiso_id);
    const atestadoId = normalizeId(existente?.atestado_id);
    const militarIdExistente = normalizeId(existente?.militar_id);
    const { militarId } = await validarParJisoAtestado(base44, payload, jisoId, atestadoId, militarIdExistente);

    if (operation === 'delete') {
      if (existente?.ativo === false) {
        return Response.json({ ok: true, operation, data: existente, meta: { already_inactive: true } });
      }

      const atualizado = await base44.asServiceRole.entities.JISOAtestado.update(registroId, {
        ativo: false,
        desvinculado_em: new Date().toISOString(),
        desvinculado_por: userSnapshot.email,
      });

      await registrarAuditoria(base44, {
        acao: 'desvincular_atestado_jiso',
        jiso_id: jisoId,
        atestado_id: atestadoId,
        militar_id: militarId,
        vinculo_id: registroId,
        usuario_id: userSnapshot.id,
        usuario_email: userSnapshot.email,
      });

      return Response.json({ ok: true, operation, data: atualizado });
    }

    const chaves = Object.keys(data || {});
    const tentativaIdentidade = chaves.filter((key) => CAMPOS_IDENTIDADE.has(key));
    if (tentativaIdentidade.length > 0) {
      return responseError(409, 'VINCULO_IDENTITY_IMMUTABLE', 'jiso_id, atestado_id e militar_id são imutáveis. Desvincule e crie um novo vínculo se necessário.', {
        campos: tentativaIdentidade,
      });
    }

    const camposInvalidos = chaves.filter((key) => !CAMPOS_UPDATE_PERMITIDOS.has(key));
    if (camposInvalidos.length > 0) {
      return responseError(400, 'UPDATE_FIELDS_INVALID', 'Há campos não permitidos na atualização do vínculo.', {
        campos: camposInvalidos,
      });
    }

    if (existente?.ativo === false) {
      return responseError(409, 'VINCULO_INATIVO', 'Vínculo inativo não pode receber decisão. Crie um novo vínculo ativo.');
    }

    await garantirSemVinculoAtivoDuplicado(base44, jisoId, atestadoId, registroId);

    const patch: Record<string, unknown> = {};
    for (const key of CAMPOS_UPDATE_PERMITIDOS) {
      if (Object.prototype.hasOwnProperty.call(data, key)) patch[key] = data[key];
    }

    const atualizado = await base44.asServiceRole.entities.JISOAtestado.update(registroId, patch);

    await registrarAuditoria(base44, {
      acao: 'registrar_efeito_jiso_atestado',
      jiso_id: jisoId,
      atestado_id: atestadoId,
      militar_id: militarId,
      vinculo_id: registroId,
      campos_alterados: Object.keys(patch),
      usuario_id: userSnapshot.id,
      usuario_email: userSnapshot.email,
    });

    return Response.json({ ok: true, operation, data: atualizado });
  } catch (error: any) {
    const status = error?.status || error?.response?.status || 500;
    const code = error?.code || 'CUD_JISO_ATESTADO_FAILED';
    console.error('[cudJisoAtestado] erro', { status, code, message: error?.message });
    return responseError(status, code, error?.message || 'Erro ao processar vínculo JISO/Atestado.');
  }
});
