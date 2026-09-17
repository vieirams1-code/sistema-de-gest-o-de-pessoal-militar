import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  textoId,
  numeroSeguro,
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

    // Valida permissão via getUserPermissions
    const authzResponse = await base44.functions.invoke('getUserPermissions', {});
    const authz = authzResponse?.data ?? authzResponse ?? {};
    const isAdmin = String(user.role || '').trim().toLowerCase() === 'admin'
      || authz?.isAdmin === true
      || authz?.actions?.admin_campanhas_ferias === true;
    const podeAprovar = isAdmin || authz?.actions?.aprovar_ferias === true;
    if (!podeAprovar) {
      return json({ error: 'Sem permissão para reatribuir períodos de férias.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const opcaoId = textoId(body?.opcao_id);
    const novoPeriodoId = textoId(body?.novo_periodo_aquisitivo_id);

    if (!opcaoId) {
      return json({ error: 'ID da opção de férias é obrigatório.' }, 400);
    }

    const opcao = await base44.asServiceRole.entities.OpcaoFeriasMilitar.get(opcaoId);
    if (!opcao) {
      return json({ error: 'Opção de férias não encontrada.' }, 404);
    }

    if (opcao.gerado_ferias_efetivas) {
      return json({ error: 'As férias desta resposta já foram geradas e o período não pode ser reatribuído.' }, 409);
    }

    if (textoId(opcao.status_camada_1) !== 'Pendente_Reanalise') {
      return json({ error: 'Apenas respostas marcadas para reanálise podem ter o período reatribuído.' }, 409);
    }

    const militarId = textoId(opcao.militar_id);
    if (!militarId) {
      return json({ error: 'Resposta sem militar vinculado.' }, 400);
    }

    const [todosPeriodos, ferias, ajustes] = await Promise.all([
      listarTodos(base44.asServiceRole.entities.PeriodoAquisitivo, { militar_id: militarId }),
      listarTodos(base44.asServiceRole.entities.Ferias, { militar_id: militarId }),
      listarTodos(base44.asServiceRole.entities.AjusteSaldoFerias, { militar_id: militarId }),
    ]);

    const anoCampanha = Number(opcao.ano_referencia || new Date().getFullYear() + 1);
    const ordenados = todosPeriodos
      .slice()
      .sort((a: any, b: any) => String(a?.inicio_aquisitivo || '').localeCompare(String(b?.inicio_aquisitivo || '')));

    // Determina o período-alvo: o explicitamente informado ou o mais antigo elegível.
    let periodoAlvo: any = null;
    if (novoPeriodoId) {
      periodoAlvo = ordenados.find((p: any) => textoId(p?.id) === novoPeriodoId) || null;
      if (!periodoAlvo) {
        return json({ error: 'O período informado não pertence a este militar.' }, 404);
      }
    } else {
      for (const p of ordenados) {
        const r = calcularResumoPeriodoPlano(p, ferias, ajustes, anoCampanha);
        if (r.elegivel_plano && r.dias_sem_previsao > 0) {
          periodoAlvo = p;
          break;
        }
      }
    }

    if (!periodoAlvo) {
      return json({ error: 'Não há período aquisitivo elegível disponível para este militar.' }, 409);
    }

    const resumoAlvo = calcularResumoPeriodoPlano(periodoAlvo, ferias, ajustes, anoCampanha);
    if (resumoAlvo.dias_sem_previsao <= 0) {
      return json({
        error: `O período ${periodoAlvo.ano_referencia || periodoAlvo.periodo_aquisitivo_ref || ''} também está integralmente comprometido. Verifique os períodos do militar.`,
      }, 409);
    }

    const periodoAnteriorId = textoId(opcao.periodo_aquisitivo_id);

    const updated = await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(opcaoId, {
      periodo_aquisitivo_id: periodoAlvo.id,
      periodo_inicio: periodoAlvo.inicio_aquisitivo || '',
      periodo_fim: periodoAlvo.fim_aquisitivo || '',
      dias_direito: Math.max(0, numeroSeguro(resumoAlvo.dias_sem_previsao, 30)),
      status_camada_1: 'Pendente',
      justificativa_ajuste_gestor: `Período reatribuído de ${periodoAnteriorId} para ${periodoAlvo.id} (${periodoAlvo.ano_referencia || periodoAlvo.periodo_aquisitivo_ref || ''}) devido a conflito identificado no saneamento.`,
    });

    try {
      await base44.asServiceRole.entities.AuditoriaFerias.create({
        acao: 'PERIODO_REATRIBUIDO_REANALISE',
        resultado: 'SUCESSO',
        usuario_id: String(user.id || ''),
        usuario_email: user.email || '',
        usuario_nome: user.full_name || user.name || user.email || 'Gestor',
        militar_id: militarId,
        militar_nome: opcao.militar_nome || '',
        militar_matricula: opcao.militar_matricula || '',
        plano_id: String(opcao.plano_ferias_institucional_id || ''),
        campanha_id: String(opcao.campanha_id || ''),
        opcao_id: opcaoId,
        detalhes: JSON.stringify({
          periodo_anterior_id: periodoAnteriorId,
          periodo_novo_id: periodoAlvo.id,
          periodo_novo_ref: periodoAlvo.ano_referencia || periodoAlvo.periodo_aquisitivo_ref || '',
          dias_sem_previsao_novo: resumoAlvo.dias_sem_previsao,
        }),
        data_hora: new Date().toISOString(),
      });
    } catch (_errAudit) {
      // Auditoria não pode impedir a reatribuição.
    }

    return json({
      ok: true,
      opcao: updated,
      message: `Período reatribuído para ${periodoAlvo.ano_referencia || periodoAlvo.periodo_aquisitivo_ref || ''} com ${resumoAlvo.dias_sem_previsao} dia(s) disponível(is).`,
    });
  } catch (error: any) {
    console.error('[reatribuirPeriodoFerias]', error);
    return json({ error: error?.message || 'Falha interna ao reatribuir período.' }, 500);
  }
});