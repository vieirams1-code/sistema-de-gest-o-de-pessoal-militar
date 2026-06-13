import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const POSTOS_HIERARQUIA = [
  'Soldado',
  'Cabo',
  '3º Sargento',
  '2º Sargento',
  '1º Sargento',
  'Subtenente',
  'Aspirante a Oficial',
  '2º Tenente',
  '1º Tenente',
  'Capitão',
  'Major',
  'Tenente-Coronel',
  'Coronel',
];

const INDICE_POR_POSTO = new Map(POSTOS_HIERARQUIA.map((posto, indice) => [posto, indice]));

const texto = (valor: unknown) => String(valor ?? '').trim();

const normalizar = (valor: unknown) => {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[°º]/g, 'o')
    .replace(/[•|/]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

const toTime = (value: unknown) => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const ts = new Date(value as string).getTime();
  return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
};

function compararHistoricosDesc(a: any, b: any) {
  const camposData = ['data_promocao', 'data_publicacao', 'created_at'];
  for (const campo of camposData) {
    const delta = toTime(b?.[campo]) - toTime(a?.[campo]);
    if (delta !== 0) return delta;
  }
  return String(b?.id).localeCompare(String(a?.id));
}

function obterPostoCanonico(v: string) {
  const t = normalizar(v);
  // Mapeamento simples para garantir que "Soldado" vs "SD" ou variações batam se necessário.
  // No Historico V2, geralmente já está o nome por extenso, mas o normalizar garante case/acentos.
  for (const p of POSTOS_HIERARQUIA) {
    if (normalizar(p) === t) return p;
  }
  return v;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ success: false, error: 'Não autenticado' }, { status: 401 });

    let payload: any = {};
    try { payload = await req.json(); } catch (_) { }

    const dryRun = payload.dryRun !== false;
    const confirmacao = texto(payload.confirmacao);

    if (!dryRun && confirmacao !== 'SINCRONIZAR') {
      return Response.json({ success: false, error: 'Confirmação textual "SINCRONIZAR" obrigatória para execução.' }, { status: 400 });
    }

    const Militar = base44.asServiceRole.entities.Militar;
    const Historico = base44.asServiceRole.entities.HistoricoPromocaoMilitarV2;
    const AssistenteLog = base44.asServiceRole.entities.AssistenteLog;

    const [militares, historicosTodos] = await Promise.all([
      Militar.list(),
      Historico.list()
    ]);

    // Linking logic: use ID and Matricula
    const historicosPorMilitarId = new Map<string, any[]>();
    const historicosPorMatricula = new Map<string, any[]>();

    for (const h of historicosTodos) {
      // Multiple fields for linking as requested
      const mid = texto(h.militar_id || h.militarId || (typeof h.militar === 'string' ? h.militar : h.militar?.id));
      const mat = texto(h.matricula || (typeof h.militar === 'object' ? h.militar?.matricula : ''));

      if (mid) {
        if (!historicosPorMilitarId.has(mid)) historicosPorMilitarId.set(mid, []);
        historicosPorMilitarId.get(mid)!.push(h);
      }
      if (mat) {
        if (!historicosPorMatricula.has(mat)) historicosPorMatricula.set(mat, []);
        historicosPorMatricula.get(mat)!.push(h);
      }
    }

    const debug = {
      totalMilitares: militares.length,
      totalHistoricos: historicosTodos.length,
      militaresAtivos: 0,
      militaresComHistorico: 0,
      historicosPublicados: 0,
      descartados: {
        inativo: 0,
        semHistorico: 0,
        rebaixamento: 0
      }
    };

    const resumo = {
      analisados: 0,
      atualizados: 0,
      compativeis: 0,
      ignorados: 0,
      divergencias: [] as any[]
    };

    const updates = [];

    for (const militar of militares) {
      const statusMilitar = normalizar(militar.status_cadastro);
      if (statusMilitar !== 'ativo') {
        debug.descartados.inativo++;
        continue;
      }
      debug.militaresAtivos++;

      const mid = texto(militar.id);
      const mat = texto(militar.matricula);

      // Agrupar históricos por ID ou Matrícula, removendo duplicados pelo ID do registro
      const historicosMap = new Map<string, any>();
      (historicosPorMilitarId.get(mid) || []).forEach(h => historicosMap.set(String(h.id), h));
      (historicosPorMatricula.get(mat) || []).forEach(h => historicosMap.set(String(h.id), h));

      const mHistoricosRaw = Array.from(historicosMap.values());

      // Filtro de "publicados"
      const mHistoricos = mHistoricosRaw.filter(h => {
        const statusReg = normalizar(h.status_registro);
        if (['cancelado', 'cancelada', 'retificado', 'retificada'].includes(statusReg)) return false;

        const isPublicado = h.publicado === true || h.publicado === 'true';
        const isConsolidado = h.consolidado === true || h.consolidado === 'true';
        const stPub = normalizar(h.status_publicacao || h.situacao || h.status || h.status_promocao);

        const temDataPublicacao = !!h.data_publicacao || !!h.data_promocao;
        const temReferencia = !!h.boletim_referencia || !!h.ato_referencia || !!h.numero_publicacao;

        // Critério amplo de publicação conforme solicitado
        const publicadoPorStatus = ['publicado', 'publicada', 'consolidado', 'consolidada', 'ativo'].includes(stPub);

        const res = (statusReg === 'ativo') || isPublicado || isConsolidado || publicadoPorStatus || (temDataPublicacao && temReferencia);
        if (res) debug.historicosPublicados++;
        return res;
      });

      if (mHistoricos.length === 0) {
        debug.descartados.semHistorico++;
        resumo.ignorados++;
        continue;
      }

      debug.militaresComHistorico++;
      resumo.analisados++; // Rafael Stort deve cair aqui agora

      const ultimoHistorico = [...mHistoricos].sort(compararHistoricosDesc)[0];

      const postoAtual = normalizar(militar.posto_graduacao);
      const quadroAtual = normalizar(militar.quadro);
      const postoNovo = normalizar(ultimoHistorico.posto_graduacao_novo);
      const quadroNovo = normalizar(ultimoHistorico.quadro_novo);

      const divergePosto = postoAtual !== postoNovo;
      const divergeQuadro = quadroAtual !== quadroNovo;

      if (!divergePosto && !divergeQuadro) {
        resumo.compativeis++;
        continue;
      }

      const idxAtual = INDICE_POR_POSTO.get(obterPostoCanonico(militar.posto_graduacao)) ?? -1;
      const idxNovo = INDICE_POR_POSTO.get(obterPostoCanonico(ultimoHistorico.posto_graduacao_novo)) ?? -1;

      // Regra: Não rebaixar se o cadastro atual for MAIS RECENTE que o histórico.
      // Como estamos pegando o ÚLTIMO histórico, se o cadastro for maior que o histórico,
      // presume-se que o cadastro tem uma informação manual que ainda não está no Histórico V2.
      if (idxNovo < idxAtual && idxNovo !== -1 && idxAtual !== -1) {
          debug.descartados.rebaixamento++;
          resumo.ignorados++;
          continue;
      }

      resumo.divergencias.push({
        militar_id: mid,
        nome: militar.nome_completo || militar.nome_guerra || 'Militar ' + mid,
        matricula: militar.matricula,
        posto_anterior: militar.posto_graduacao,
        quadro_anterior: militar.quadro,
        posto_novo: ultimoHistorico.posto_graduacao_novo,
        quadro_novo: ultimoHistorico.quadro_novo,
        historico_id: ultimoHistorico.id,
        data_promocao: ultimoHistorico.data_promocao,
        tipo: 'atualização automática'
      });

      if (!dryRun) {
        updates.push(async () => {
          await Militar.update(mid, {
            posto_graduacao: ultimoHistorico.posto_graduacao_novo,
            quadro: ultimoHistorico.quadro_novo
          });

          await AssistenteLog.create({
            tipo: 'sincronizacao_promocao',
            acao: 'atualizar_militar_por_sincronizacao_em_lote',
            descricao: `Sincronização administrativa: ${militar.posto_graduacao}/${militar.quadro} -> ${ultimoHistorico.posto_graduacao_novo}/${ultimoHistorico.quadro_novo}`,
            metadata: {
              militar_id: mid,
              nome: militar.nome_completo,
              posto_anterior: militar.posto_graduacao,
              quadro_anterior: militar.quadro,
              posto_novo: ultimoHistorico.posto_graduacao_novo,
              quadro_novo: ultimoHistorico.quadro_novo,
              historico_id: ultimoHistorico.id,
              executado_por: authUser.email,
              origem: 'sincronizacao_automatica_promocoes'
            }
          });
        });
      }
      resumo.atualizados++;
    }

    if (!dryRun && updates.length > 0) {
      for (const updateFn of updates) {
        await updateFn();
      }
    }

    return Response.json({ success: true, dryRun, resumo, debug });

  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
