import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PAGE_SIZE = 500;
const MAX_ROWS = 20000;

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

function duplicateKey(jiso: any) {
  const militarId = normalizeId(jiso?.militar_id);
  const data = String(jiso?.data_jiso || '').trim();
  const secao = String(jiso?.secao_jiso || '').trim().toLowerCase();
  if (!militarId || !data) return '';
  return `${militarId}|${data}|${secao}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    if (String(authUser.role || '').toLowerCase() !== 'admin') {
      return Response.json({
        error: 'Preview de migração JISO é restrito ao administrador da plataforma.',
        code: 'PLATFORM_ADMIN_REQUIRED',
      }, { status: 403 });
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

    const planos: any[] = [];
    const inconsistencias: any[] = [];
    let jisosLegadasComAtestado = 0;
    let vinculosACriar = 0;
    let jisosComCamposACopiar = 0;
    let historicosAtestadoParaRevisao = 0;

    for (const jiso of jisos) {
      const jisoId = normalizeId(jiso?.id);
      const militarJiso = normalizeId(jiso?.militar_id);
      const atestadoId = normalizeId(jiso?.atestado_id);
      if (!atestadoId) continue;

      jisosLegadasComAtestado += 1;
      const atestado = atestadoById.get(atestadoId);
      if (!atestado) {
        inconsistencias.push({
          tipo: 'ATESTADO_LEGADO_NAO_ENCONTRADO',
          jiso_id: jisoId,
          atestado_id: atestadoId,
          militar_id: militarJiso,
        });
        continue;
      }

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

      const key = `${jisoId}|${atestadoId}`;
      const criarVinculo = !vinculoAtivoKey.has(key);
      if (criarVinculo) vinculosACriar += 1;

      const patchJiso: Record<string, unknown> = {};
      addCopyIfMissing(patchJiso, 'data_jiso', jiso?.data_jiso, atestado?.data_jiso_agendada);
      addCopyIfMissing(patchJiso, 'hora_jiso', jiso?.hora_jiso, atestado?.hora_jiso_agendada);
      addCopyIfMissing(patchJiso, 'jiso_whatsapp_status', jiso?.jiso_whatsapp_status, atestado?.jiso_whatsapp_status);
      addCopyIfMissing(patchJiso, 'jiso_whatsapp_enviado_em', jiso?.jiso_whatsapp_enviado_em, atestado?.jiso_whatsapp_enviado_em);
      addCopyIfMissing(patchJiso, 'jiso_whatsapp_enviado_por', jiso?.jiso_whatsapp_enviado_por, atestado?.jiso_whatsapp_enviado_por);
      addCopyIfMissing(patchJiso, 'jiso_whatsapp_mensagem', jiso?.jiso_whatsapp_mensagem, atestado?.jiso_whatsapp_mensagem);
      addCopyIfMissing(patchJiso, 'jiso_whatsapp_data_agendada_snapshot', jiso?.jiso_whatsapp_data_agendada_snapshot, atestado?.jiso_whatsapp_data_agendada_snapshot);
      addCopyIfMissing(patchJiso, 'jiso_whatsapp_hora_agendada_snapshot', jiso?.jiso_whatsapp_hora_agendada_snapshot, atestado?.jiso_whatsapp_hora_agendada_snapshot);
      addCopyIfMissing(patchJiso, 'arquivo_ata_jiso', jiso?.arquivo_ata_jiso, atestado?.arquivo_ata_jiso);
      addCopyIfMissing(patchJiso, 'nota_para_bg', jiso?.nota_para_bg, atestado?.nota_para_bg);
      addCopyIfMissing(patchJiso, 'numero_bg', jiso?.numero_bg, atestado?.numero_bg);
      addCopyIfMissing(patchJiso, 'data_bg', jiso?.data_bg, atestado?.data_bg);
      addCopyIfMissing(patchJiso, 'status_publicacao', jiso?.status_publicacao, atestado?.status_publicacao);
      addCopyIfMissing(patchJiso, 'dias_original', jiso?.dias_original, atestado?.dias_original || atestado?.dias);
      addCopyIfMissing(patchJiso, 'dias_jiso', jiso?.dias_jiso, atestado?.dias_jiso);

      const adminFields = parseAdminFields(jiso?.observacoes);
      addCopyIfMissing(patchJiso, 'numero_tars', jiso?.numero_tars, adminFields.numero_tars);
      addCopyIfMissing(patchJiso, 'hora_jiso', jiso?.hora_jiso, adminFields.hora_jiso);
      addCopyIfMissing(patchJiso, 'local_jiso', jiso?.local_jiso, adminFields.local_jiso);

      const historicoCount = Array.isArray(atestado?.historico_jiso) ? atestado.historico_jiso.length : 0;
      if (historicoCount > 0) historicosAtestadoParaRevisao += 1;
      if (Object.keys(patchJiso).length > 0) jisosComCamposACopiar += 1;

      planos.push({
        jiso_id: jisoId,
        atestado_id: atestadoId,
        militar_id: militarJiso,
        criar_vinculo: criarVinculo,
        vinculo_payload: criarVinculo ? {
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
        } : null,
        patch_jiso: patchJiso,
        historico_jiso_atestado_count: historicoCount,
        requer_revisao_historico: historicoCount > 0,
      });
    }

    const gruposDuplicidade = new Map<string, any[]>();
    for (const jiso of jisos) {
      const key = duplicateKey(jiso);
      if (!key) continue;
      if (!gruposDuplicidade.has(key)) gruposDuplicidade.set(key, []);
      gruposDuplicidade.get(key)?.push(jiso);
    }

    const candidatosDuplicidade = Array.from(gruposDuplicidade.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => ({
        chave: key,
        militar_id: normalizeId(items[0]?.militar_id),
        data_jiso: items[0]?.data_jiso || '',
        secao_jiso: items[0]?.secao_jiso || '',
        jiso_ids: items.map((item: any) => normalizeId(item?.id)),
        atestado_ids_legados: items.map((item: any) => normalizeId(item?.atestado_id)).filter(Boolean),
        quantidade: items.length,
        acao: 'REVISAR_MANUALMENTE_NAO_FUNDIR_AUTOMATICAMENTE',
      }));

    return Response.json({
      preview: true,
      write_performed: false,
      gerado_em: new Date().toISOString(),
      resumo: {
        total_jisos: jisos.length,
        total_atestados: atestados.length,
        total_vinculos_existentes: vinculos.length,
        jisos_legadas_com_atestado: jisosLegadasComAtestado,
        vinculos_a_criar: vinculosACriar,
        jisos_com_campos_a_copiar: jisosComCamposACopiar,
        jisos_com_historico_atestado_para_revisao: historicosAtestadoParaRevisao,
        inconsistencias: inconsistencias.length,
        candidatos_duplicidade_mesma_sessao: candidatosDuplicidade.length,
      },
      planos,
      inconsistencias,
      candidatos_duplicidade: candidatosDuplicidade,
      regras: {
        nenhuma_escrita: true,
        nenhuma_fusao_automatica: true,
        campos_legados_atestado_nao_removidos: true,
      },
    });
  } catch (error: any) {
    const status = error?.status || error?.response?.status || 500;
    console.error('[previewMigracaoJisoIndependente] erro', { status, message: error?.message });
    return Response.json({
      error: error?.message || 'Erro ao gerar preview de migração JISO.',
      code: 'PREVIEW_MIGRACAO_JISO_FAILED',
      write_performed: false,
    }, { status });
  }
});
