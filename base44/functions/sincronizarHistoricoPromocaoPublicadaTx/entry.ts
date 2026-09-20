import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const texto = (valor: unknown) => String(valor ?? '').trim();
const normalizar = (valor: unknown) => texto(valor)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();
const dataSomente = (valor: unknown) => texto(valor).split('T')[0];

const STATUS_OFICIAL = new Set([
  'publicada', 'publicado', 'consolidada', 'consolidado',
  'ativa', 'ativo', 'historica', 'homologada',
]);

const CAMPOS_PROMOCAO_EDITAVEIS = [
  'posto_graduacao',
  'quadro',
  'data_promocao',
  'data_publicacao',
  'boletim_referencia',
  'ato_referencia',
  'observacoes',
];

async function parsePayload(req: Request) {
  try {
    const payload = await req.json();
    if (payload?.body && typeof payload.body === 'object') return payload.body;
    if (payload?.data && typeof payload.data === 'object' && !payload.promocao_id) return payload.data;
    return payload || {};
  } catch {
    return {};
  }
}

function montarPatchPromocao(payload: any) {
  const origem = payload?.patch_promocao || payload?.patch || {};
  const patch: Record<string, unknown> = {};
  for (const campo of CAMPOS_PROMOCAO_EDITAVEIS) {
    if (Object.prototype.hasOwnProperty.call(origem, campo)) {
      patch[campo] = campo.startsWith('data_') ? dataSomente(origem[campo]) : texto(origem[campo]);
    }
  }
  return patch;
}

function montarPatchHistorico(promocao: any) {
  return {
    posto_graduacao_novo: texto(promocao?.posto_graduacao),
    quadro_novo: texto(promocao?.quadro),
    data_promocao: dataSomente(promocao?.data_promocao),
    data_publicacao: dataSomente(promocao?.data_publicacao) || dataSomente(promocao?.data_promocao),
    boletim_referencia: texto(promocao?.boletim_referencia),
    ato_referencia: texto(promocao?.ato_referencia),
  };
}

function snapshotCampos(registro: any, campos: string[]) {
  return campos.reduce((acc, campo) => {
    acc[campo] = registro?.[campo] ?? '';
    return acc;
  }, {} as Record<string, unknown>);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const authUser = await base44.auth.me();
    if (!authUser) {
      return Response.json({ success: false, etapa: 'autorizacao', motivo: 'nao_autenticado' }, { status: 401 });
    }
    if (normalizar(authUser?.role) !== 'admin') {
      return Response.json({ success: false, etapa: 'autorizacao', motivo: 'requer_administrador_plataforma' }, { status: 403 });
    }

    const payload = await parsePayload(req);
    const promocaoId = texto(payload?.promocao_id || payload?.promocaoId);
    if (!promocaoId) {
      return Response.json({ success: false, etapa: 'validacao', motivo: 'promocao_id_ausente' }, { status: 400 });
    }

    const Promocao = base44.asServiceRole.entities.Promocao;
    const PromocaoMilitar = base44.asServiceRole.entities.PromocaoMilitar;
    const Historico = base44.asServiceRole.entities.HistoricoPromocaoMilitarV2;

    const promocaoAntes = await Promocao.get(promocaoId).catch(() => null);
    if (!promocaoAntes?.id) {
      return Response.json({ success: false, etapa: 'validacao', motivo: 'promocao_nao_encontrada' }, { status: 404 });
    }
    if (!STATUS_OFICIAL.has(normalizar(promocaoAntes?.status))) {
      return Response.json({ success: false, etapa: 'validacao', motivo: 'promocao_nao_publicada' }, { status: 409 });
    }

    const patchPromocao = montarPatchPromocao(payload);
    if (Object.keys(patchPromocao).length === 0) {
      return Response.json({ success: true, atualizados: 0, ignorado: true });
    }

    const [historicosDaPromocao, itensDaPromocao] = await Promise.all([
      Historico.filter({ promocao_id: promocaoId }),
      PromocaoMilitar.filter({ promocao_id: promocaoId }),
    ]);
    const historicosAtivos = (historicosDaPromocao || []).filter(
      (registro: any) => normalizar(registro?.status_registro || 'ativo') === 'ativo',
    );

    const promocaoDepois = { ...promocaoAntes, ...patchPromocao };
    if (!dataSomente(promocaoDepois?.data_promocao) || !texto(promocaoDepois?.posto_graduacao) || !texto(promocaoDepois?.quadro)) {
      return Response.json({ success: false, etapa: 'validacao', motivo: 'campos_obrigatorios_ausentes' }, { status: 400 });
    }

    const patchPai = {
      ...patchPromocao,
      total_militares_vinculados: (itensDaPromocao || []).length,
    };
    const patchHistorico = montarPatchHistorico(promocaoDepois);
    const snapshotPai = snapshotCampos(promocaoAntes, [...CAMPOS_PROMOCAO_EDITAVEIS, 'total_militares_vinculados']);
    const snapshotsHistoricos = new Map(
      historicosAtivos.map((registro: any) => [
        texto(registro.id),
        snapshotCampos(registro, Object.keys(patchHistorico)),
      ]),
    );
    const atualizados: string[] = [];

    try {
      await Promocao.update(promocaoId, patchPai);
      for (const historico of historicosAtivos) {
        await Historico.update(historico.id, patchHistorico);
        atualizados.push(texto(historico.id));
      }
    } catch (error: any) {
      const falhasRollback: any[] = [];
      for (const historicoId of [...atualizados].reverse()) {
        try {
          await Historico.update(historicoId, snapshotsHistoricos.get(historicoId));
        } catch (rollbackError: any) {
          falhasRollback.push({ entidade: 'HistoricoPromocaoMilitarV2', id: historicoId, erro: rollbackError?.message || String(rollbackError) });
        }
      }
      try {
        await Promocao.update(promocaoId, snapshotPai);
      } catch (rollbackError: any) {
        falhasRollback.push({ entidade: 'Promocao', id: promocaoId, erro: rollbackError?.message || String(rollbackError) });
      }
      return Response.json({
        success: false,
        etapa: 'sincronizacao_transacional',
        motivo: error?.message || 'falha_sincronizacao',
        rollback_completo: falhasRollback.length === 0,
        falhas_rollback: falhasRollback,
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      ignorado: false,
      promocao_id: promocaoId,
      atualizados: atualizados.length,
      total_militares_vinculados: (itensDaPromocao || []).length,
    });
  } catch (error: any) {
    return Response.json({
      success: false,
      etapa: 'erro_interno',
      motivo: error?.message || 'erro_interno_sincronizacao',
    }, { status: 500 });
  }
});
