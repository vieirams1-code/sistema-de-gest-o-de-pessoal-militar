import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const OPEN_STATUSES = new Set(['Rascunho', 'Aguardando Agendamento', 'Agendada', 'Realizada', 'Resultado Registrado']);
const JISO_FIELDS = new Set([
  'data_jiso', 'hora_jiso', 'local_jiso', 'secao_jiso', 'finalidade_jiso', 'nup',
  'numero_ata', 'resultado_jiso', 'dias_jiso', 'data_inicio_efeito',
  'data_termino_efeito', 'data_retorno_efeito', 'parecer_jiso', 'status',
  'observacoes', 'arquivo_ata_jiso', 'texto_publicacao'
]);

const asId = (value: unknown) => String(value || '').trim();
const asText = (value: unknown, max = 5000) => String(value || '').trim().slice(0, max);
const unique = <T>(values: T[]) => [...new Set(values.filter(Boolean))];

function error(status: number, code: string, message: string, meta: Record<string, unknown> = {}) {
  return Response.json({ success: false, code, error: message, meta }, { status });
}

function pickJisoData(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of JISO_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) out[key] = input[key];
  }
  return out;
}

function statusFromLegacy(atestado: Record<string, any>) {
  const status = asText(atestado?.status_jiso, 100).toLowerCase();
  if (status.includes('homologado pela jiso')) return 'Concluída';
  if (atestado?.data_jiso_agendada) return 'Agendada';
  return 'Aguardando Agendamento';
}

function hasLegacyJiso(atestado: Record<string, any>) {
  return Boolean(
    atestado?.necessita_jiso ||
    asText(atestado?.fluxo_homologacao, 50).toLowerCase() === 'jiso' ||
    atestado?.data_jiso_agendada ||
    asText(atestado?.status_jiso, 100).toLowerCase().includes('jiso') ||
    atestado?.arquivo_ata_jiso ||
    atestado?.jiso_id
  );
}

async function getAuthz(base44: any, payload: Record<string, unknown>) {
  const response = await base44.functions.invoke('getUserPermissions', payload);
  return response?.data ?? response ?? {};
}

function permissions(authz: any, authUser: any) {
  const isAdmin = authz?.isAdmin === true || String(authUser?.role || '').toLowerCase() === 'admin';
  const actions = authz?.actions || {};
  return {
    isAdmin,
    canView: isAdmin || actions?.gerir_jiso === true || actions?.registrar_decisao_jiso === true,
    canManage: isAdmin || actions?.gerir_jiso === true,
    canDecide: isAdmin || actions?.registrar_decisao_jiso === true,
    canPublish: isAdmin || actions?.publicar_ata_jiso === true,
    canSensitive: isAdmin || actions?.ver_dados_sensiveis_atestado === true,
  };
}

async function scopedAtestados(base44: any, payload: Record<string, unknown>, isAdmin: boolean) {
  if (isAdmin) return await base44.asServiceRole.entities.Atestado.list('-created_date');
  const response = await base44.functions.invoke('getScopedAtestadosBundleV2', payload);
  const data = response?.data ?? response ?? {};
  return Array.isArray(data?.atestados) ? data.atestados : [];
}

async function findOne(base44: any, entity: string, query: Record<string, unknown>) {
  const rows = await base44.asServiceRole.entities[entity].filter(query, '-created_date', 1, 0);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function activeLinksForJiso(base44: any, jisoId: string) {
  return await base44.asServiceRole.entities.JISOAtestado.filter({ jiso_id: jisoId, status: 'Ativo' }, 'ordem');
}

async function assertJisoScope(base44: any, jiso: any, allowedMilitarIds: Set<string>, isAdmin: boolean) {
  if (!jiso) throw Object.assign(new Error('JISO não encontrada.'), { status: 404, code: 'JISO_NOT_FOUND' });
  if (!isAdmin && !allowedMilitarIds.has(asId(jiso.militar_id))) {
    throw Object.assign(new Error('JISO fora do escopo permitido.'), { status: 403, code: 'JISO_OUT_OF_SCOPE' });
  }
}

async function audit(base44: any, authUser: any, action: string, jisoId: string, metadata: Record<string, unknown> = {}) {
  try {
    await base44.asServiceRole.entities.AssistenteLog.create({
      tipo: 'auditoria_jiso',
      acao: action,
      descricao: JSON.stringify({ jiso_id: jisoId, usuario: authUser?.email || '', ...metadata }),
      metadata: {
        modulo: 'JISO',
        jiso_id: jisoId,
        usuario_id: authUser?.id || '',
        usuario_email: authUser?.email || '',
        data_hora: new Date().toISOString(),
        ...metadata,
      },
    });
  } catch (auditError) {
    console.warn('[jisoGateway] auditoria não persistida', auditError);
  }
}

async function buildDetail(base44: any, jiso: any, canSensitive: boolean) {
  const links = await activeLinksForJiso(base44, jiso.id);
  const atestadoIds = unique(links.map((link: any) => asId(link.atestado_id)));
  let atestados: any[] = [];
  if (atestadoIds.length) {
    atestados = await base44.asServiceRole.entities.Atestado.filter({ id: { $in: atestadoIds } }, '-data_inicio', 500, 0);
  }
  if (!canSensitive) {
    atestados = atestados.map((item: any) => ({
      id: item.id,
      militar_id: item.militar_id,
      militar_nome: item.militar_nome,
      militar_posto: item.militar_posto,
      militar_matricula: item.militar_matricula,
      tipo_afastamento: item.tipo_afastamento,
      data_inicio: item.data_inicio,
      dias: item.dias,
      data_termino: item.data_termino,
      data_retorno: item.data_retorno,
      status: item.status,
    }));
  }
  const notificacoes = await base44.asServiceRole.entities.JISONotificacao.filter({ jiso_id: jiso.id }, '-created_date', 200, 0);
  return { ...jiso, vinculos: links, atestados, notificacoes };
}

async function validateSelectedAtestados(
  base44: any,
  ids: string[],
  allowedAtestadoIds: Set<string>,
  isAdmin: boolean,
  expectedMilitarId = '',
) {
  if (!ids.length) throw Object.assign(new Error('Selecione pelo menos um atestado.'), { status: 400, code: 'ATESTADOS_REQUIRED' });
  if (!isAdmin && ids.some((id) => !allowedAtestadoIds.has(id))) {
    throw Object.assign(new Error('Um ou mais atestados estão fora do seu escopo.'), { status: 403, code: 'ATESTADO_OUT_OF_SCOPE' });
  }
  const atestados = await base44.asServiceRole.entities.Atestado.filter({ id: { $in: ids } }, '-data_inicio', 500, 0);
  if (atestados.length !== ids.length) {
    throw Object.assign(new Error('Um ou mais atestados não foram encontrados.'), { status: 404, code: 'ATESTADO_NOT_FOUND' });
  }
  const militarIds = unique(atestados.map((item: any) => asId(item.militar_id)));
  if (militarIds.length !== 1) {
    throw Object.assign(new Error('Todos os atestados da JISO devem pertencer ao mesmo militar.'), { status: 422, code: 'MULTIPLE_MILITARES' });
  }
  if (expectedMilitarId && militarIds[0] !== expectedMilitarId) {
    throw Object.assign(new Error('O atestado pertence a outro militar.'), { status: 422, code: 'MILITAR_MISMATCH' });
  }
  return atestados;
}

async function createLinks(base44: any, jiso: any, atestados: any[], authUser: any) {
  const now = new Date().toISOString();
  const existingLinks = await base44.asServiceRole.entities.JISOAtestado.filter({
    atestado_id: { $in: atestados.map((item: any) => item.id) },
    status: 'Ativo',
  }, '-created_date', 500, 0);

  for (const link of existingLinks) {
    if (asId(link.jiso_id) === asId(jiso.id)) continue;
    const parent = await findOne(base44, 'JISO', { id: link.jiso_id });
    if (parent && OPEN_STATUSES.has(parent.status)) {
      throw Object.assign(new Error('Um dos atestados já está vinculado a outra JISO em andamento.'), {
        status: 409,
        code: 'ATESTADO_JA_VINCULADO',
        meta: { atestado_id: link.atestado_id, jiso_id: link.jiso_id },
      });
    }
  }

  const current = await activeLinksForJiso(base44, jiso.id);
  const currentIds = new Set(current.map((item: any) => asId(item.atestado_id)));
  let ordem = current.length;
  const created: any[] = [];
  for (const atestado of atestados) {
    if (currentIds.has(atestado.id)) continue;
    ordem += 1;
    created.push(await base44.asServiceRole.entities.JISOAtestado.create({
      jiso_id: jiso.id,
      atestado_id: atestado.id,
      militar_id: atestado.militar_id,
      tipo_vinculo: ordem === 1 ? 'Principal' : 'Complementar',
      ordem,
      status: 'Ativo',
      incluido_em: now,
      incluido_por: authUser?.email || '',
      atestado_data_inicio_snapshot: atestado.data_inicio || '',
      atestado_dias_snapshot: Number(atestado.dias || 0),
      atestado_data_termino_snapshot: atestado.data_termino || '',
    }));
  }
  return created;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return error(401, 'UNAUTHENTICATED', 'Não autenticado.');

    let payload: Record<string, any> = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }
    const action = asText(payload?.acao || payload?.action, 80).toUpperCase();
    const authz = await getAuthz(base44, payload);
    const perm = permissions(authz, authUser);
    if (!perm.canView) return error(403, 'FORBIDDEN', 'Acesso à gestão de JISO não autorizado.');

    const atestadosEscopo = await scopedAtestados(base44, payload, perm.isAdmin);
    const allowedAtestadoIds = new Set(atestadosEscopo.map((item: any) => asId(item.id)));
    const allowedMilitarIds = new Set(atestadosEscopo.map((item: any) => asId(item.militar_id)));

    if (action === 'LISTAR') {
      const rows = await base44.asServiceRole.entities.JISO.list('-created_date');
      const scoped = perm.isAdmin ? rows : rows.filter((item: any) => allowedMilitarIds.has(asId(item.militar_id)));
      const links = scoped.length
        ? await base44.asServiceRole.entities.JISOAtestado.filter({ jiso_id: { $in: scoped.map((item: any) => item.id) }, status: 'Ativo' }, 'ordem', 1000, 0)
        : [];
      const counts = links.reduce((acc: Record<string, number>, link: any) => {
        acc[link.jiso_id] = (acc[link.jiso_id] || 0) + 1;
        return acc;
      }, {});
      return Response.json({ success: true, jisos: scoped.map((item: any) => ({ ...item, total_atestados: counts[item.id] || 0 })) });
    }

    if (action === 'DETALHAR') {
      const jiso = await findOne(base44, 'JISO', { id: asId(payload.jiso_id) });
      await assertJisoScope(base44, jiso, allowedMilitarIds, perm.isAdmin);
      return Response.json({ success: true, jiso: await buildDetail(base44, jiso, perm.canSensitive) });
    }

    if (action === 'CRIAR') {
      if (!perm.canManage) return error(403, 'FORBIDDEN_MANAGE', 'Permissão gerir_jiso é obrigatória.');
      const ids = unique((Array.isArray(payload.atestado_ids) ? payload.atestado_ids : []).map(asId));
      const atestados = await validateSelectedAtestados(base44, ids, allowedAtestadoIds, perm.isAdmin);
      const principal = atestados[0];
      const input = pickJisoData(payload.jiso || payload);
      const jiso = await base44.asServiceRole.entities.JISO.create({
        ...input,
        militar_id: principal.militar_id,
        militar_nome: principal.militar_nome || '',
        militar_posto: principal.militar_posto || '',
        militar_matricula: principal.militar_matricula || '',
        status: input.status || (input.data_jiso ? 'Agendada' : 'Aguardando Agendamento'),
        origem: 'NATIVA',
        versao: 1,
      });
      const codigo = `JISO-${new Date().getFullYear()}-${String(jiso.id || '').slice(-6).toUpperCase()}`;
      const updated = await base44.asServiceRole.entities.JISO.update(jiso.id, { codigo });
      await createLinks(base44, { ...jiso, ...updated }, atestados, authUser);
      await audit(base44, authUser, 'CRIAR', jiso.id, { atestado_ids: ids });
      return Response.json({ success: true, jiso: await buildDetail(base44, { ...jiso, ...updated, codigo }, perm.canSensitive) });
    }

    const jisoId = asId(payload.jiso_id);
    const jiso = await findOne(base44, 'JISO', { id: jisoId });
    await assertJisoScope(base44, jiso, allowedMilitarIds, perm.isAdmin);

    if (action === 'VINCULAR_ATESTADOS') {
      if (!perm.canManage) return error(403, 'FORBIDDEN_MANAGE', 'Permissão gerir_jiso é obrigatória.');
      const ids = unique((Array.isArray(payload.atestado_ids) ? payload.atestado_ids : []).map(asId));
      const atestados = await validateSelectedAtestados(base44, ids, allowedAtestadoIds, perm.isAdmin, asId(jiso.militar_id));
      await createLinks(base44, jiso, atestados, authUser);
      await audit(base44, authUser, 'VINCULAR_ATESTADOS', jisoId, { atestado_ids: ids });
      return Response.json({ success: true, jiso: await buildDetail(base44, jiso, perm.canSensitive) });
    }

    if (action === 'REMOVER_VINCULO') {
      if (!perm.canManage) return error(403, 'FORBIDDEN_MANAGE', 'Permissão gerir_jiso é obrigatória.');
      const atestadoId = asId(payload.atestado_id);
      const link = await findOne(base44, 'JISOAtestado', { jiso_id: jisoId, atestado_id: atestadoId, status: 'Ativo' });
      if (!link) return error(404, 'VINCULO_NOT_FOUND', 'Vínculo ativo não encontrado.');
      const linksAtivos = await activeLinksForJiso(base44, jisoId);
      if (linksAtivos.length <= 1) return error(409, 'ULTIMO_ATESTADO', 'A JISO deve manter pelo menos um atestado. Cancele a JISO se necessário.');
      await base44.asServiceRole.entities.JISOAtestado.update(link.id, {
        status: 'Removido',
        removido_em: new Date().toISOString(),
        removido_por: authUser.email || '',
        motivo_remocao: asText(payload.motivo, 500),
      });
      await audit(base44, authUser, 'REMOVER_VINCULO', jisoId, { atestado_id: atestadoId });
      return Response.json({ success: true, jiso: await buildDetail(base44, jiso, perm.canSensitive) });
    }

    if (action === 'ATUALIZAR') {
      if (!perm.canManage && !perm.canDecide) return error(403, 'FORBIDDEN_UPDATE', 'Permissão de gestão ou decisão JISO é obrigatória.');
      const patch = pickJisoData(payload.jiso || payload);
      if (!perm.canDecide) {
        for (const key of ['resultado_jiso', 'dias_jiso', 'data_inicio_efeito', 'data_termino_efeito', 'data_retorno_efeito', 'parecer_jiso']) delete patch[key];
      }
      const scheduleChanged = (
        (patch.data_jiso !== undefined && patch.data_jiso !== jiso.data_jiso) ||
        (patch.hora_jiso !== undefined && patch.hora_jiso !== jiso.hora_jiso)
      );
      if (scheduleChanged) patch.whatsapp_status = 'pendente';
      patch.versao = Number(jiso.versao || 0) + 1;
      const updated = await base44.asServiceRole.entities.JISO.update(jisoId, patch);
      await audit(base44, authUser, 'ATUALIZAR', jisoId, { campos: Object.keys(patch) });
      return Response.json({ success: true, jiso: await buildDetail(base44, { ...jiso, ...updated, ...patch }, perm.canSensitive) });
    }

    if (action === 'CANCELAR') {
      if (!perm.canManage) return error(403, 'FORBIDDEN_MANAGE', 'Permissão gerir_jiso é obrigatória.');
      const motivo = asText(payload.motivo, 1000);
      if (!motivo) return error(400, 'MOTIVO_REQUIRED', 'Informe o motivo do cancelamento.');
      const patch = { status: 'Cancelada', cancelada_em: new Date().toISOString(), motivo_cancelamento: motivo, versao: Number(jiso.versao || 0) + 1 };
      const updated = await base44.asServiceRole.entities.JISO.update(jisoId, patch);
      await audit(base44, authUser, 'CANCELAR', jisoId, { motivo });
      return Response.json({ success: true, jiso: { ...jiso, ...updated, ...patch } });
    }

    if (action === 'PUBLICAR_ATA') {
      if (!perm.canPublish) return error(403, 'FORBIDDEN_PUBLISH', 'Permissão publicar_ata_jiso é obrigatória.');
      const links = await activeLinksForJiso(base44, jisoId);
      const atestadoIds = unique(links.map((link: any) => asId(link.atestado_id)));
      if (!atestadoIds.length) return error(422, 'JISO_SEM_ATESTADOS', 'A JISO não possui atestados vinculados.');
      const existing = await base44.asServiceRole.entities.PublicacaoExOfficio.filter({ jiso_id: jisoId, tipo: 'Ata JISO' }, '-created_date', 20, 0);
      const active = existing.find((item: any) => !item.tornada_sem_efeito_por_id && item.status !== 'Excluída');
      if (active) return error(409, 'PUBLICACAO_EXISTENTE', 'Já existe publicação ativa para esta JISO.', { publicacao_id: active.id });
      const input = payload.publicacao || {};
      const publicacao = await base44.asServiceRole.entities.PublicacaoExOfficio.create({
        tipo: 'Ata JISO',
        jiso_id: jisoId,
        militar_id: jiso.militar_id,
        militar_nome: jiso.militar_nome || '',
        militar_posto: jiso.militar_posto || '',
        militar_matricula: jiso.militar_matricula_atual || jiso.militar_matricula || '',
        data_publicacao: input.data_publicacao || new Date().toISOString().slice(0, 10),
        atestados_jiso_ids: atestadoIds,
        finalidade_jiso: jiso.finalidade_jiso || '',
        secao_jiso: jiso.secao_jiso || '',
        data_ata: jiso.data_jiso || '',
        nup: jiso.nup || '',
        parecer_jiso: jiso.parecer_jiso || '',
        texto_publicacao: input.texto_publicacao || jiso.texto_publicacao || '',
        nota_para_bg: input.nota_para_bg || '',
        numero_bg: input.numero_bg || '',
        data_bg: input.data_bg || '',
        status: input.status || 'Aguardando Nota',
        render_metadata: input.render_metadata || jiso.render_metadata || null,
      });
      const patch = { publicacao_id: publicacao.id, status_publicacao: publicacao.status, status: 'Concluída', concluida_em: new Date().toISOString(), versao: Number(jiso.versao || 0) + 1 };
      await base44.asServiceRole.entities.JISO.update(jisoId, patch);
      await audit(base44, authUser, 'PUBLICAR_ATA', jisoId, { publicacao_id: publicacao.id, atestado_ids: atestadoIds });
      return Response.json({ success: true, publicacao, jiso: { ...jiso, ...patch } });
    }

    if (action === 'MIGRACAO_DRY_RUN' || action === 'MIGRACAO_APLICAR') {
      if (!perm.isAdmin) return error(403, 'ADMIN_REQUIRED', 'A migração exige administrador.');
      const apply = action === 'MIGRACAO_APLICAR';
      const allAtestados = await base44.asServiceRole.entities.Atestado.list('-created_date');
      const candidates = allAtestados.filter(hasLegacyJiso);
      const allJisos = await base44.asServiceRole.entities.JISO.list('-created_date');
      const allLinks = await base44.asServiceRole.entities.JISOAtestado.list('-created_date');
      const activeByAtestado = new Map(allLinks.filter((link: any) => link.status === 'Ativo').map((link: any) => [asId(link.atestado_id), link]));
      const existingByLegacyAtestado = new Map(allJisos.filter((item: any) => item.atestado_id).map((item: any) => [asId(item.atestado_id), item]));
      const report: any[] = [];

      for (const atestado of candidates) {
        if (activeByAtestado.has(atestado.id)) {
          report.push({ atestado_id: atestado.id, acao: 'IGNORAR', motivo: 'JA_VINCULADO' });
          continue;
        }
        let parent = asId(atestado.jiso_id) ? allJisos.find((item: any) => item.id === atestado.jiso_id) : null;
        parent = parent || existingByLegacyAtestado.get(atestado.id) || null;
        const proposed = {
          militar_id: atestado.militar_id,
          militar_nome: atestado.militar_nome || '',
          militar_posto: atestado.militar_posto || '',
          militar_matricula: atestado.militar_matricula || '',
          data_jiso: atestado.data_jiso_agendada || '',
          hora_jiso: atestado.hora_jiso_agendada || '',
          status: statusFromLegacy(atestado),
          arquivo_ata_jiso: atestado.arquivo_ata_jiso || '',
          status_publicacao: atestado.status_publicacao || 'Aguardando Nota',
          whatsapp_status: atestado.jiso_whatsapp_status || 'legado',
          whatsapp_enviado_em: atestado.jiso_whatsapp_enviado_em || '',
          whatsapp_enviado_por: atestado.jiso_whatsapp_enviado_por || '',
          whatsapp_mensagem: atestado.jiso_whatsapp_mensagem || '',
          whatsapp_data_agendada_snapshot: atestado.jiso_whatsapp_data_agendada_snapshot || '',
          whatsapp_hora_agendada_snapshot: atestado.jiso_whatsapp_hora_agendada_snapshot || '',
          origem: 'MIGRACAO_LEGADO',
          versao: 1,
        };
        report.push({ atestado_id: atestado.id, acao: parent ? 'VINCULAR_EXISTENTE' : 'CRIAR_JISO', jiso_id: parent?.id || null, proposed });
        if (!apply) continue;

        if (!parent) {
          parent = await base44.asServiceRole.entities.JISO.create(proposed);
          const codigo = `JISO-LEGADO-${String(parent.id || '').slice(-6).toUpperCase()}`;
          await base44.asServiceRole.entities.JISO.update(parent.id, { codigo });
          parent = { ...parent, codigo };
        } else {
          await base44.asServiceRole.entities.JISO.update(parent.id, { ...proposed, atestado_id: parent.atestado_id || atestado.id });
        }
        await createLinks(base44, parent, [atestado], authUser);
        if (atestado.jiso_whatsapp_enviado_em || atestado.jiso_whatsapp_status === 'legado') {
          await base44.asServiceRole.entities.JISONotificacao.create({
            jiso_id: parent.id,
            militar_id: atestado.militar_id,
            tipo: 'Agendamento',
            canal: 'WhatsApp',
            status: atestado.jiso_whatsapp_enviado_em ? 'Enviada' : 'Legado',
            mensagem: atestado.jiso_whatsapp_mensagem || '',
            data_jiso_snapshot: atestado.jiso_whatsapp_data_agendada_snapshot || atestado.data_jiso_agendada || '',
            hora_jiso_snapshot: atestado.jiso_whatsapp_hora_agendada_snapshot || atestado.hora_jiso_agendada || '',
            enviado_em: atestado.jiso_whatsapp_enviado_em || '',
            enviado_por: atestado.jiso_whatsapp_enviado_por || '',
          });
        }
      }
      await audit(base44, authUser, action, '', { total: report.length });
      return Response.json({ success: true, apply, total: report.length, report });
    }

    return error(400, 'ACTION_INVALID', 'Ação inválida.');
  } catch (caught: any) {
    console.error('[jisoGateway]', caught);
    return error(Number(caught?.status || 500), caught?.code || 'JISO_GATEWAY_FAILED', caught?.message || 'Erro ao processar JISO.', caught?.meta || {});
  }
});