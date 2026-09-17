import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  textoId,
  calcularResumoPeriodoPlano,
} from '../../shared/ferias/resumoPeriodoPlano.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Id',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function listarTodos(entity: any, query: any = {}): Promise<any[]> {
  const registros: any[] = [];
  for (let skip = 0; ; skip += 500) {
    const pagina = await entity.filter(query, 'id', 500, skip);
    registros.push(...pagina);
    if (pagina.length < 500) return registros;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Usuário não autenticado.' }, 401);
    if (String(user.role || '').trim().toLowerCase() !== 'admin') {
      return json({ error: 'Apenas administradores podem executar o saneamento.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const planoIdFiltro = textoId(body?.plano_id);
    const apenasSimular = Boolean(body?.simular);

    const campanhas = (await listarTodos(base44.asServiceRole.entities.CampanhaPortal, { tipo: 'PLANO_FERIAS' }))
      .filter((c: any) => c.tipo === 'PLANO_FERIAS')
      .filter((c: any) => !planoIdFiltro || textoId(c.plano_ferias_institucional_id) === planoIdFiltro);

    if (!campanhas.length) {
      return json({ ok: true, total_analisadas: 0, total_marcadas: 0, resultados: [], message: 'Nenhuma campanha de férias encontrada para o filtro.' });
    }

    const campanhaIds = new Set(campanhas.map((c: any) => c.id));
    const todasOpcoes = await listarTodos(base44.asServiceRole.entities.OpcaoFeriasMilitar);
    const opcoes = todasOpcoes.filter((op: any) =>
      campanhaIds.has(textoId(op?.campanha_id))
      || (planoIdFiltro && textoId(op?.plano_ferias_institucional_id) === planoIdFiltro)
    );

    const resultados: any[] = [];
    const militarIds = [...new Set(opcoes.map((op: any) => textoId(op?.militar_id)).filter(Boolean))];

    // Pré-carrega periodos, ferias e ajustes por militar para reduzir round-trips.
    for (const militarId of militarIds) {
      const opcoesMilitar = opcoes.filter((op: any) => textoId(op?.militar_id) === militarId);

      const [periodosMilitar, feriasMilitar, ajustesMilitar] = await Promise.all([
        listarTodos(base44.asServiceRole.entities.PeriodoAquisitivo, { militar_id: militarId }),
        listarTodos(base44.asServiceRole.entities.Ferias, { militar_id: militarId }),
        listarTodos(base44.asServiceRole.entities.AjusteSaldoFerias, { militar_id: militarId }),
      ]);

      const periodosOrdenados = periodosMilitar
        .slice()
        .sort((a: any, b: any) => String(a?.inicio_aquisitivo || '').localeCompare(String(b?.inicio_aquisitivo || '')));

      for (const opcao of opcoesMilitar) {
        if (opcao.gerado_ferias_efetivas) continue;
        if (textoId(opcao.status_camada_1) === 'Pendente_Reanalise') continue;

        const periodoId = textoId(opcao.periodo_aquisitivo_id);
        if (!periodoId) continue;

        const periodo = periodosMilitar.find((p: any) => textoId(p?.id) === periodoId);
        if (!periodo) continue;

        const anoCampanha = Number(opcao.ano_referencia || new Date().getFullYear() + 1);
        const resumo = calcularResumoPeriodoPlano(periodo, feriasMilitar, ajustesMilitar, anoCampanha);

        if (resumo.dias_sem_previsao > 0) continue;

        // Período está integralmente comprometido — encontra o próximo elegível.
        let periodoCorreto: any = null;
        for (const p of periodosOrdenados) {
          const r = calcularResumoPeriodoPlano(p, feriasMilitar, ajustesMilitar, anoCampanha);
          if (r.elegivel_plano && r.dias_sem_previsao > 0) {
            periodoCorreto = p;
            break;
          }
        }

        const feriasCompromecedoras = feriasMilitar
          .filter((f: any) => {
            const fPeriodo = textoId(f?.periodo_aquisitivo_id);
            const fRef = textoId(f?.periodo_aquisitivo_ref);
            const pRef = textoId(periodo?.ano_referencia || periodo?.periodo_aquisitivo_ref);
            return fPeriodo === periodoId || (fRef && pRef && fRef === pRef);
          })
          .map((f: any) => ({ status: f.status, dias: f.dias, data_inicio: f.data_inicio, data_fim: f.data_fim }));

        const resultado = {
          opcao_id: opcao.id,
          militar_id: militarId,
          militar_nome: opcao.militar_nome || '',
          militar_matricula: opcao.militar_matricula || '',
          campanha_id: opcao.campanha_id,
          plano_id: opcao.plano_ferias_institucional_id,
          periodo_conflitante_id: periodoId,
          periodo_conflitante_ref: periodo.ano_referencia || periodo.periodo_aquisitivo_ref || '',
          periodo_correto_id: periodoCorreto?.id || null,
          periodo_correto_ref: periodoCorreto?.ano_referencia || periodoCorreto?.periodo_aquisitivo_ref || '',
          ferias_compromecedoras: feriasCompromecedoras,
        };
        resultados.push(resultado);

        if (!apenasSimular) {
          await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(opcao.id, {
            status_camada_1: 'Pendente_Reanalise',
            justificativa_ajuste_gestor: `Período ${periodo.ano_referencia || periodo.periodo_aquisitivo_ref || ''} já comprometido por férias existentes (${feriasCompromecedoras.length} registro(s)) — reanálise necessária.`,
          });

          try {
            await base44.asServiceRole.entities.AuditoriaFerias.create({
              acao: 'RESPOSTA_MARCADA_REANALISE',
              resultado: 'SUCESSO',
              usuario_id: String(user.id || ''),
              usuario_email: user.email || '',
              usuario_nome: user.full_name || user.name || user.email || 'Administrador',
              militar_id: militarId,
              militar_nome: opcao.militar_nome || '',
              militar_matricula: opcao.militar_matricula || '',
              plano_id: String(opcao.plano_ferias_institucional_id || ''),
              campanha_id: String(opcao.campanha_id || ''),
              opcao_id: String(opcao.id || ''),
              detalhes: JSON.stringify({
                periodo_conflitante_id: periodoId,
                periodo_conflitante_ref: periodo.ano_referencia || periodo.periodo_aquisitivo_ref || '',
                periodo_correto_id: periodoCorreto?.id || null,
                periodo_correto_ref: periodoCorreto?.ano_referencia || periodoCorreto?.periodo_aquisitivo_ref || '',
                ferias_compromecedoras: feriasCompromecedoras,
              }),
              data_hora: new Date().toISOString(),
            });
          } catch (_errAudit) {
            // Auditoria não pode impedir o saneamento.
          }
        }
      }
    }

    return json({
      ok: true,
      simular: apenasSimular,
      total_analisadas: opcoes.length,
      total_marcadas: resultados.length,
      resultados,
      message: apenasSimular
        ? `${resultados.length} resposta(s) em conflito identificada(s) em simulação.`
        : `${resultados.length} resposta(s) marcada(s) para reanálise com sucesso.`,
    });
  } catch (error: any) {
    console.error('[saneamentoRespostasFerias]', error);
    return json({ error: error?.message || 'Falha interna no saneamento.' }, 500);
  }
});