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

function normalizarPosto(v: string) {
  return texto(v).replace(/°/g, 'º');
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

    const [militares, historicos] = await Promise.all([
      Militar.list(),
      Historico.filter({ status_registro: 'ativo' })
    ]);

    const historicosPorMilitar = new Map<string, any[]>();
    for (const h of historicos) {
      const mid = texto(h.militar_id);
      if (!mid) continue;
      if (!historicosPorMilitar.has(mid)) historicosPorMilitar.set(mid, []);
      historicosPorMilitar.get(mid)!.push(h);
    }

    const resumo = {
      analisados: 0,
      atualizados: 0,
      compativeis: 0,
      ignorados: 0,
      divergencias: [] as any[]
    };

    const updates = [];

    for (const militar of militares) {
      if (texto(militar.status_cadastro) !== 'ativo') continue;

      resumo.analisados++;
      const mid = texto(militar.id);
      const mHistoricos = historicosPorMilitar.get(mid) || [];

      if (mHistoricos.length === 0) {
        resumo.ignorados++;
        continue;
      }

      const ultimoHistorico = [...mHistoricos].sort(compararHistoricosDesc)[0];

      const postoAtual = normalizarPosto(militar.posto_graduacao);
      const quadroAtual = texto(militar.quadro);
      const postoNovo = normalizarPosto(ultimoHistorico.posto_graduacao_novo);
      const quadroNovo = texto(ultimoHistorico.quadro_novo);

      const divergePosto = postoAtual !== postoNovo;
      const divergeQuadro = quadroAtual !== quadroNovo;

      if (!divergePosto && !divergeQuadro) {
        resumo.compativeis++;
        continue;
      }

      const idxAtual = INDICE_POR_POSTO.get(postoAtual) ?? -1;
      const idxNovo = INDICE_POR_POSTO.get(postoNovo) ?? -1;

      // Regra: Não rebaixar se o cadastro atual for MAIS RECENTE que o histórico.
      // Como estamos pegando o ÚLTIMO histórico, se o cadastro for maior que o histórico,
      // presume-se que o cadastro tem uma informação manual que ainda não está no Histórico V2.
      if (idxNovo < idxAtual && idxNovo !== -1 && idxAtual !== -1) {
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
        data_promocao: ultimoHistorico.data_promocao
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

    return Response.json({ success: true, dryRun, resumo });

  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
