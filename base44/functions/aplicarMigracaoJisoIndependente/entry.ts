import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PAGE_SIZE = 500;
const MAX_ROWS = 20000;
const CONFIRMACAO_EXATA = 'APLICAR_MIGRACAO_JISO_INDEPENDENTE_V1';

function normalizeId(value: unknown) {
  return String(value || '').trim();
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function parseAdminFields(observacoes: unknown) {
  const texto = String(observacoes || '');
  if (!texto) return { numero_tars: '', hora_jiso: '', local_jiso: '' };
  const bloco = texto.match(/\[JISO_ADMIN\]\s*([\s\S]*?)\s*\[\/JISO_ADMIN\]/i)?.[1] || texto;
  return {
    numero_tars: (bloco.match(/(?:^|\n)TARS:\s*(.+)/i)?.[1] || '').trim(),
    hora_jiso: (bloco.match(/(?:^|\n)HORA_JISO:\s*(.+)/i)?.[1] || '').trim(),
    local_jiso: (bloco.match(/(?:^|\n)LOCAL_JISO:\s*(.+)/i)?.[1] || '').trim(),
  };
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

function addCopyIfMissing(target: Record<string, unknown>, field: string, currentValue: unknown, legacyValue: unknown) {
  if (!hasValue(currentValue) && hasValue(legacyValue)) target[field] = legacyValue;
}

function buildJisoPatch(jiso: any, atestado: any) {
  const patch: Record<string, unknown> = {};
  addCopyIfMissing(patch, 'data_jiso', jiso?.data_jiso, atestado?.data_jiso_agendada);
  addCopyIfMissing(patch, 'hora_jiso', jiso?.hora_jiso, atestado?.hora_jiso_agendada);

  const legacyWhatsappEnviado = hasValue(atestado?.jiso_whatsapp_enviado_em);
  const currentWhatsappEnviado = hasValue(jiso?.jiso_whatsapp_enviado_em);
  if (!currentWhatsappEnviado && legacyWhatsappEnviado) {
    if (hasValue(atestado?.jiso_whatsapp_status)) patch.jiso_whatsapp_status = atestado.jiso_whatsapp_status;
    addCopyIfMissing(patch, 'jiso_whatsapp_enviado_em', jiso?.jiso_whatsapp_enviado_em, atestado?.jiso_whatsapp_enviado_em);
    addCopyIfMissing(patch, 'jiso_whatsapp_enviado_por', jiso?.jiso_whatsapp_enviado_por, atestado?.jiso_whatsapp_enviado_por);
    addCopyIfMissing(patch, 'jiso_whatsapp_mensagem', jiso?.jiso_whatsapp_mensagem, atestado?.jiso_whatsapp_mensagem);
    addCopyIfMissing(patch, 'jiso_whatsapp_data_agendada_snapshot', jiso?.jiso_whatsapp_data_agendada_snapshot, atestado?.jiso_whatsapp_data_agendada_snapshot);
    addCopyIfMissing(patch, 'jiso_whatsapp_hora_agendada_snapshot', jiso?.jiso_whatsapp_hora_agendada_snapshot, atestado?.jiso_whatsapp_hora_agendada_snapshot);
  } else {
    addCopyIfMissing(patch, 'jiso_whatsapp_status', jiso?.jiso_whatsapp_status, atestado?.jiso_whatsapp_status);
  }

  addCopyIfMissing(patch, 'arquivo_ata_jiso', jiso?.arquivo_ata_jiso, atestado?.arquivo_ata_jiso);
  addCopyIfMissing(patch, 'nota_para_bg', jiso?.nota_para_bg, atestado?.nota_para_bg);
  addCopyIfMissing(patch, 'numero_bg', jiso?.numero_bg, atestado?.numero_bg);
  addCopyIfMissing(patch, 'data_bg', jiso?.data_bg, atestado?.data_bg);
  addCopyIfMissing(patch, 'status_publicacao', jiso?.status_publicacao, atestado?.status_publicacao);
  addCopyIfMissing(patch, 'dias_original', jiso?.dias_original, atestado?.dias_original || atestado?.dias);
  addCopyIfMissing(patch, 'dias_jiso', jiso?.dias_jiso, atestado?.dias_jiso);

  const adminFields = parseAdminFields(jiso?.observacoes);
  addCopyIfMissing(patch, 'numero_tars', jiso?.numero_tars, adminFields.numero_tars);
  addCopyIfMissing(patch, 'hora_jiso', jiso?.hora_jiso, adminFields.hora_jiso);
  addCopyIfMissing(patch, 'local_jiso', jiso?.local_jiso, adminFields.local_jiso);

  return patch;
}

async function audit(base44: any, metadata: Record<string, unknown>) {
  const payload = {
    modulo: 'JISO',
    origem: 'aplicarMigracaoJisoIndependente',
    ...metadata,
    data_hora: new Date().toISOString(),
  };
  await base44.asServiceRole.entities.AssistenteLog.create({
    tipo: 'auditoria_migracao_jiso_independente',
    acao: String(metadata?.acao || 'migracao'),
    descricao: JSON.stringify(payload),
    metadata: payload,
  }).catch((error: any) => {
    console.warn('[aplicarMigracaoJisoIndependente] auditoria falhou', error?.message || error);
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    if (String(authUser.role || '').toLowerCase() !== 'admin') {
      return Response.json({
        error: 'Aplicação da migração JISO é restrita ao administrador da plataforma.',
        code: 'PLATFORM_ADMIN_REQUIRED',
      }, { status: 403 });
    }

    let payload: Record<string, any> = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    if (String(payload?.confirmacao || '') !== CONFIRMACAO_EXATA) {
      return Response.json({
        error: 'Confirmação explícita inválida. A migração não foi executada.',
        code: 'MIGRATION_CONFIRMATION_REQUIRED',
        confirmation_required: CONFIRMACAO_EXATA,
        write_performed: false,
      }, { status: 409 });
    }

    const [jisos, atestados, vinculos] = await Promise.all([
      listAll(base44.asServiceRole.entities.JISO),
      listAll(base44.asServiceRole.entities.Atestado),
      listAll(base44.asServiceRole.entities.JISOAtestado).catch(() => []),
    ]);

    const atestadoById = new Map(atestados.map((item: any) => [normalizeId(item?.id), item]));
    const vinculoAtivoKey = new Set(
      vinculos
        .filter((item: any) => item?.ativo !== false)
        .map((item: any) => `${normalizeId(item?.jiso_id)}|${normalizeId(item?.atestado_id)}`),
    );

    const resultados: any[] = [];
    const inconsistencias: any[] = [];
    let vinculosCriados = 0;
    let jisosAtualizadas = 0;
    let ignoradosIdempotencia = 0;

    for (const jiso of jisos) {
      const jisoId = normalizeId(jiso?.id);
      const atestadoId = normalizeId(jiso?.atestado_id);
      if (!atestadoId) continue;

      const atestado = atestadoById.get(atestadoId);
      if (!atestado) {
        inconsistencias.push({ tipo: 'ATESTADO_LEGADO_NAO_ENCONTRADO', jiso_id: jisoId, atestado_id: atestadoId });
        continue;
      }

      const militarJiso = normalizeId(jiso?.militar_id);
      const militarAtestado = normalizeId(atestado?.militar_id);
      if (!militarJiso || !militarAtestado || militarJiso !== militarAtestado) {
        inconsistencias.push({
          tipo: 'MILITAR_DIVERGENTE',
          jiso_id: jisoId,
          atestado_id: atestadoId,
          militar_jiso: militarJiso,
          militar_atestado: militarAtestado,
        });
        continue;
      }

      const itemResultado: any = {
        jiso_id: jisoId,
        atestado_id: atestadoId,
        militar_id: militarJiso,
        vinculo_criado: false,
        jiso_atualizada: false,
        campos_jiso: [],
      };

      const key = `${jisoId}|${atestadoId}`;
      if (!vinculoAtivoKey.has(key)) {
        try {
          const novoVinculo = await base44.asServiceRole.entities.JISOAtestado.create({
            jiso_id: jisoId,
            atestado_id: atestadoId,
            militar_id: militarJiso,
            tipo_vinculo: 'Homologação',
            origem_vinculo: 'migracao_legado',
            resultado_atestado: '',
            dias_homologados: atestado?.dias_jiso ?? jiso?.dias_jiso ?? null,
            data_termino_resultante: atestado?.data_termino_jiso || '',
            data_retorno_resultante: atestado?.data_retorno_jiso || '',
            observacoes: '',
            ativo: true,
            desvinculado_em: '',
            desvinculado_por: '',
          });
          vinculoAtivoKey.add(key);
          itemResultado.vinculo_criado = true;
          itemResultado.vinculo_id = novoVinculo?.id || '';
          vinculosCriados += 1;
        } catch (error: any) {
          itemResultado.erro_vinculo = error?.message || String(error);
        }
      } else {
        ignoradosIdempotencia += 1;
      }

      const patchJiso = buildJisoPatch(jiso, atestado);
      if (Object.keys(patchJiso).length > 0) {
        try {
          await base44.asServiceRole.entities.JISO.update(jisoId, patchJiso);
          itemResultado.jiso_atualizada = true;
          itemResultado.campos_jiso = Object.keys(patchJiso);
          jisosAtualizadas += 1;
        } catch (error: any) {
          itemResultado.erro_patch_jiso = error?.message || String(error);
        }
      }

      resultados.push(itemResultado);
    }

    const resumo = {
      total_jisos_lidas: jisos.length,
      total_atestados_lidos: atestados.length,
      total_vinculos_preexistentes: vinculos.length,
      vinculos_criados: vinculosCriados,
      jisos_atualizadas: jisosAtualizadas,
      vinculos_ignorados_por_idempotencia: ignoradosIdempotencia,
      inconsistencias: inconsistencias.length,
      atestados_alterados: 0,
      jisos_fundidas: 0,
      jisos_excluidas: 0,
    };

    await audit(base44, {
      acao: 'migracao_jiso_independente_v1',
      executado_por: String(authUser.email || ''),
      resumo,
    });

    return Response.json({
      ok: true,
      migration_version: 'jiso-independent-v1',
      write_performed: true,
      executado_em: new Date().toISOString(),
      resumo,
      resultados,
      inconsistencias,
      garantias: {
        atestados_legados_preservados: true,
        nenhuma_fusao_automatica: true,
        nenhuma_exclusao_jiso: true,
        reexecucao_idempotente_para_vinculos: true,
      },
    });
  } catch (error: any) {
    const status = error?.status || error?.response?.status || 500;
    console.error('[aplicarMigracaoJisoIndependente] erro', { status, message: error?.message });
    return Response.json({
      error: error?.message || 'Erro ao aplicar migração JISO.',
      code: 'APLICAR_MIGRACAO_JISO_FAILED',
    }, { status });
  }
});
