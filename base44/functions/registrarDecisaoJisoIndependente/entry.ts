import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACTION_DECISAO = 'registrar_decisao_jiso';
const MAX_VINCULOS = 50;

function normalizeId(value: unknown) {
  return String(value || '').trim();
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function responseError(status: number, code: string, error: string, meta: Record<string, unknown> = {}) {
  return Response.json({ error, code, meta }, { status });
}

function parsePositiveDays(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || !Number.isInteger(number)) return NaN;
  return number;
}

function addDaysIso(startIso: string, amount: number) {
  const match = String(startIso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function resolvePermissions(base44: any, payload: Record<string, unknown>, authUser: any) {
  const response = await base44.functions.invoke('getUserPermissions', payload);
  const data = response?.data ?? response ?? {};
  return {
    actions: data?.actions && typeof data.actions === 'object' ? data.actions : {},
    isAdmin: Boolean(data?.isAdmin) || String(authUser?.role || '').toLowerCase() === 'admin',
  };
}

async function getScopedMilitar(base44: any, payload: Record<string, unknown>, militarId: string) {
  const response = await base44.functions.invoke('getScopedMilitares', {
    ...payload,
    militarIds: [militarId],
    limit: 10,
    offset: 0,
    includeFoto: false,
  });
  const data = response?.data ?? response ?? {};
  const militares = Array.isArray(data?.militares) ? data.militares : [];
  return militares.find((item: any) => normalizeId(item?.id) === militarId) || null;
}

async function getJiso(base44: any, jisoId: string) {
  const rows = await base44.asServiceRole.entities.JISO.filter({ id: jisoId }, undefined, 1, 0);
  return rows?.[0] || null;
}

async function getActiveLinks(base44: any, jisoId: string) {
  const rows = await base44.asServiceRole.entities.JISOAtestado.filter({
    jiso_id: jisoId,
    ativo: true,
  }, undefined, MAX_VINCULOS + 1, 0);
  return Array.isArray(rows) ? rows : [];
}

async function getAtestadosByIds(base44: any, ids: string[]) {
  if (!ids.length) return [];
  return base44.asServiceRole.entities.Atestado.filter({ id: { $in: ids } }, undefined, Math.max(ids.length, 1), 0);
}

function buildEffectPlan(vinculo: any, atestado: any, effect: any, jisoId: string) {
  const dias = parsePositiveDays(effect?.dias_homologados);
  if (Number.isNaN(dias)) {
    const error: any = new Error('dias_homologados deve ser inteiro positivo ou vazio.');
    error.status = 400;
    error.code = 'DIAS_HOMOLOGADOS_INVALIDOS';
    throw error;
  }

  let dataTermino = normalizeText(effect?.data_termino_resultante);
  let dataRetorno = normalizeText(effect?.data_retorno_resultante);
  if (dias && atestado?.data_inicio) {
    dataTermino = addDaysIso(atestado.data_inicio, dias - 1);
    dataRetorno = addDaysIso(atestado.data_inicio, dias);
  }

  const resultado = normalizeText(effect?.resultado_atestado);
  if (!resultado) {
    const error: any = new Error('resultado_atestado é obrigatório para cada atestado vinculado.');
    error.status = 400;
    error.code = 'RESULTADO_ATESTADO_REQUIRED';
    throw error;
  }

  return {
    vinculo_id: normalizeId(vinculo?.id),
    atestado_id: normalizeId(atestado?.id),
    vinculo_patch: {
      resultado_atestado: resultado,
      dias_homologados: dias,
      data_termino_resultante: dataTermino,
      data_retorno_resultante: dataRetorno,
      observacoes: normalizeText(effect?.observacoes),
    },
    atestado_compat_patch: {
      dias_original: atestado?.dias_original ?? atestado?.dias ?? null,
      dias_jiso: dias,
      data_termino_jiso: dataTermino,
      data_retorno_jiso: dataRetorno,
      jiso_id: jisoId,
      status_jiso: 'Homologado pela JISO',
    },
  };
}

async function audit(base44: any, metadata: Record<string, unknown>) {
  const payload = {
    modulo: 'JISO',
    origem: 'registrarDecisaoJisoIndependente',
    ...metadata,
    data_hora: new Date().toISOString(),
  };
  await base44.asServiceRole.entities.AssistenteLog.create({
    tipo: 'auditoria_decisao_jiso_independente',
    acao: String(metadata?.acao || 'registrar_decisao_jiso'),
    descricao: JSON.stringify(payload),
    metadata: payload,
  }).catch((error: any) => {
    console.warn('[registrarDecisaoJisoIndependente] falha de auditoria', error?.message || error);
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return responseError(401, 'UNAUTHENTICATED', 'Não autenticado.');

    let payload: Record<string, any> = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const jisoId = normalizeId(payload?.jiso_id);
    if (!jisoId) return responseError(400, 'JISO_ID_REQUIRED', 'jiso_id é obrigatório.');

    const permissions = await resolvePermissions(base44, payload, authUser);
    if (!permissions.isAdmin && permissions.actions?.[ACTION_DECISAO] !== true) {
      return responseError(403, 'FORBIDDEN_PERMISSION', 'Permissão registrar_decisao_jiso é obrigatória para registrar a decisão.');
    }

    const jiso = await getJiso(base44, jisoId);
    if (!jiso) return responseError(404, 'JISO_NOT_FOUND', 'JISO não encontrada.');

    const militarId = normalizeId(jiso?.militar_id);
    if (!militarId) return responseError(422, 'JISO_SEM_MILITAR', 'JISO sem militar_id válido.');
    const militar = await getScopedMilitar(base44, payload, militarId);
    if (!militar) return responseError(403, 'JISO_OUT_OF_SCOPE', 'JISO fora do escopo permitido do usuário.');

    const expectedUpdatedDate = normalizeText(payload?.jiso_updated_date_snapshot);
    const currentUpdatedDate = normalizeText(jiso?.updated_date);
    if (expectedUpdatedDate && currentUpdatedDate && expectedUpdatedDate !== currentUpdatedDate) {
      return responseError(409, 'JISO_CONCURRENT_UPDATE', 'A JISO foi alterada após a abertura da tela. Recarregue os dados antes de registrar a decisão.', {
        expected_updated_date: expectedUpdatedDate,
        current_updated_date: currentUpdatedDate,
      });
    }

    const resultadoJiso = normalizeText(payload?.resultado_jiso);
    const parecerJiso = normalizeText(payload?.parecer_jiso);
    if (!resultadoJiso) return responseError(400, 'RESULTADO_JISO_REQUIRED', 'resultado_jiso é obrigatório.');

    const links = await getActiveLinks(base44, jisoId);
    if (links.length > MAX_VINCULOS) {
      return responseError(422, 'JISO_TOO_MANY_LINKS', `A JISO possui mais de ${MAX_VINCULOS} vínculos ativos e requer revisão.`);
    }

    const effects = Array.isArray(payload?.efeitos_atestados) ? payload.efeitos_atestados : [];
    const effectByLink = new Map(effects.map((item: any) => [normalizeId(item?.vinculo_id), item]));
    const linkIds = new Set(links.map((item: any) => normalizeId(item?.id)));

    const unknownEffectLinks = effects
      .map((item: any) => normalizeId(item?.vinculo_id))
      .filter((id: string) => !id || !linkIds.has(id));
    if (unknownEffectLinks.length > 0) {
      return responseError(400, 'EFEITO_VINCULO_INVALIDO', 'Há efeitos informados para vínculo inexistente ou inativo.', {
        vinculos_invalidos: unknownEffectLinks,
      });
    }

    if (links.length !== effects.length || links.some((link: any) => !effectByLink.has(normalizeId(link?.id)))) {
      return responseError(400, 'EFEITOS_INCOMPLETOS', 'Informe um resultado para cada atestado ativo vinculado à JISO.', {
        vinculos_ativos: links.map((item: any) => normalizeId(item?.id)),
        efeitos_recebidos: effects.map((item: any) => normalizeId(item?.vinculo_id)),
      });
    }

    const atestadoIds = Array.from(new Set(links.map((item: any) => normalizeId(item?.atestado_id)).filter(Boolean)));
    const atestados = await getAtestadosByIds(base44, atestadoIds);
    const atestadoById = new Map((atestados || []).map((item: any) => [normalizeId(item?.id), item]));

    const plans = [];
    for (const link of links) {
      const linkId = normalizeId(link?.id);
      const atestadoId = normalizeId(link?.atestado_id);
      if (normalizeId(link?.militar_id) !== militarId) {
        return responseError(409, 'VINCULO_MILITAR_DIVERGENTE', 'Vínculo JISOAtestado pertence a militar diferente da JISO.', { vinculo_id: linkId });
      }
      const atestado = atestadoById.get(atestadoId);
      if (!atestado) return responseError(404, 'ATESTADO_LINK_NOT_FOUND', 'Atestado vinculado não foi encontrado.', { vinculo_id: linkId, atestado_id: atestadoId });
      if (normalizeId(atestado?.militar_id) !== militarId) {
        return responseError(409, 'ATESTADO_MILITAR_DIVERGENTE', 'Atestado vinculado pertence a militar diferente da JISO.', { atestado_id: atestadoId });
      }
      plans.push(buildEffectPlan(link, atestado, effectByLink.get(linkId), jisoId));
    }

    const operationId = crypto.randomUUID();
    const escritos = { vinculos: [] as string[], atestados: [] as string[], jiso: false };

    try {
      // Primeiro persiste os efeitos canônicos por vínculo.
      for (const plan of plans) {
        await base44.asServiceRole.entities.JISOAtestado.update(plan.vinculo_id, plan.vinculo_patch);
        escritos.vinculos.push(plan.vinculo_id);
      }

      // Depois mantém os reflexos legados no Atestado para não quebrar telas antigas.
      // Estes campos deixam de ser a fonte de verdade; JISOAtestado é canônico.
      for (const plan of plans) {
        await base44.asServiceRole.entities.Atestado.update(plan.atestado_id, plan.atestado_compat_patch);
        escritos.atestados.push(plan.atestado_id);
      }

      const jisoPatch: Record<string, unknown> = {
        resultado_jiso: resultadoJiso,
        parecer_jiso: parecerJiso,
        status: 'Realizada',
      };
      if (Object.prototype.hasOwnProperty.call(payload, 'ata_jiso')) jisoPatch.ata_jiso = normalizeText(payload?.ata_jiso);
      if (plans.length === 1) {
        const unico = plans[0];
        jisoPatch.dias_jiso = unico.vinculo_patch.dias_homologados;
        const atestadoUnico = atestadoById.get(unico.atestado_id);
        jisoPatch.dias_original = atestadoUnico?.dias_original ?? atestadoUnico?.dias ?? null;
      }
      await base44.asServiceRole.entities.JISO.update(jisoId, jisoPatch);
      escritos.jiso = true;
    } catch (writeError: any) {
      await audit(base44, {
        acao: 'decisao_jiso_parcial_falha',
        operation_id: operationId,
        jiso_id: jisoId,
        militar_id: militarId,
        executado_por: String(authUser.email || ''),
        escritos,
        erro: writeError?.message || String(writeError),
      });
      return responseError(500, 'DECISAO_JISO_PARTIAL_WRITE', 'Ocorreu falha durante a gravação da decisão. Os registros já escritos foram preservados para reexecução controlada.', {
        operation_id: operationId,
        partial_write: true,
        escritos,
      });
    }

    await audit(base44, {
      acao: 'registrar_decisao_jiso_independente',
      operation_id: operationId,
      jiso_id: jisoId,
      militar_id: militarId,
      executado_por: String(authUser.email || ''),
      resultado_jiso: resultadoJiso,
      vinculos_processados: plans.map((plan) => plan.vinculo_id),
      atestados_processados: plans.map((plan) => plan.atestado_id),
    });

    return Response.json({
      ok: true,
      operation_id: operationId,
      jiso_id: jisoId,
      militar_id: militarId,
      status: 'Realizada',
      quantidade_atestados: plans.length,
      efeitos: plans.map((plan) => ({
        vinculo_id: plan.vinculo_id,
        atestado_id: plan.atestado_id,
        ...plan.vinculo_patch,
      })),
      compatibilidade: {
        atestados_legados_atualizados: plans.length,
        fonte_de_verdade: 'JISOAtestado',
      },
    });
  } catch (error: any) {
    const status = error?.status || error?.response?.status || 500;
    const code = error?.code || 'REGISTRAR_DECISAO_JISO_FAILED';
    console.error('[registrarDecisaoJisoIndependente] erro', { status, code, message: error?.message });
    return responseError(status, code, error?.message || 'Erro ao registrar decisão da JISO.');
  }
});
