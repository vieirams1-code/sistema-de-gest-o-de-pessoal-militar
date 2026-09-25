import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { filtrarEscopo, listarTodos } from '../../shared/ferias/listarEscalaPlano.ts';
import { calcularResumoPeriodoPlano, periodoMaisAntigoElegivel, textoId } from '../../shared/ferias/resumoPeriodoPlano.ts';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Id',
  'Content-Type': 'application/json',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch (_erroAuth) {
      user = null;
    }
    if (!user) return json({ error: 'Usuário não autenticado.' }, 401);

    const ehAdmin = String(user.role || '').trim().toLowerCase() === 'admin';
    if (!ehAdmin) {
      const authz = (await base44.functions.invoke('getUserPermissions', {}))?.data || {};
      if (authz?.actions?.aprovar_ferias !== true) {
        return json({ error: 'Usuário sem permissão para registrar pendência de resposta.' }, 403);
      }
    }

    const planoId = textoId(payload?.plano_id);
    const campanhaId = textoId(payload?.campanha_id);
    const militarAlvoId = textoId(payload?.militar_alvo_id);
    const previa = payload?.preview === true;
    const justificativa = String(payload?.justificativa || '').trim();
    if (!planoId || !campanhaId || !militarAlvoId) {
      return json({ error: 'Plano, campanha e militar são obrigatórios.' }, 400);
    }
    if (!previa && !justificativa) {
      return json({ error: 'A justificativa administrativa é obrigatória.' }, 400);
    }

    const plano = await base44.asServiceRole.entities.PlanoFeriasInstitucional.get(planoId);
    if (!plano) return json({ error: 'Plano de Férias não encontrado.' }, 404);
    if (String(plano.status || '').toUpperCase() !== 'ATIVO') {
      return json({ error: 'Somente planos ativos aceitam registro de não respondentes.' }, 409);
    }

    const campanha = await base44.asServiceRole.entities.CampanhaPortal.get(campanhaId);
    if (!campanha || campanha.tipo !== 'PLANO_FERIAS' || textoId(campanha.plano_ferias_institucional_id) !== planoId) {
      return json({ error: 'Campanha de férias inválida para este plano.' }, 404);
    }

    const militar = await base44.asServiceRole.entities.Militar.get(militarAlvoId);
    if (!militar) return json({ error: 'Militar não encontrado.' }, 404);
    if (['inativo', 'falecido'].includes(String(militar.status_cadastro || militar.status || '').trim().toLowerCase())) {
      return json({ error: 'Militar inativo não pode receber definição administrativa.' }, 409);
    }
    const permitidos = await filtrarEscopo(base44, user, [militar]);
    if (permitidos.length !== 1) return json({ error: 'Militar fora do seu escopo organizacional.' }, 403);

    const opcoesMilitar = await listarTodos(base44.asServiceRole.entities.OpcaoFeriasMilitar, { militar_id: militarAlvoId });
    const jaRegistrada = opcoesMilitar.find((op: any) => textoId(op?.plano_ferias_institucional_id) === planoId);
    if (jaRegistrada) {
      return json({ error: 'Este militar já possui registro neste plano de férias.', opcao_id: jaRegistrada.id }, 409);
    }

    const ano = Number(plano.ano_referencia || campanha.ano_referencia || new Date().getFullYear() + 1);
    const [periodos, ferias, ajustes] = await Promise.all([
      listarTodos(base44.asServiceRole.entities.PeriodoAquisitivo, { militar_id: militarAlvoId }),
      listarTodos(base44.asServiceRole.entities.Ferias, { militar_id: militarAlvoId }),
      listarTodos(base44.asServiceRole.entities.AjusteSaldoFerias, { militar_id: militarAlvoId }),
    ]);
    // O cálculo canônico considera TODAS as férias com impacto no período, mesmo as
    // que não possuem vínculo com o plano. Pré-filtrar por plano inflava o saldo
    // disponível e fazia o registro apontar para um período já comprometido, o que
    // bloqueava a definição posterior do gestor no painel.
    const elegivel = periodoMaisAntigoElegivel(periodos, ferias, ajustes, ano);
    if (!elegivel) {
      return json({ error: 'O militar não possui período aquisitivo elegível com saldo para este plano.' }, 409);
    }

    const resumoPeriodo = {
      dias_sem_previsao: elegivel.resumo.dias_sem_previsao,
      dias_comprometidos: elegivel.resumo.dias_comprometidos,
      elegivel_plano: elegivel.resumo.elegivel_plano,
      primeira_data_legal_gozo: elegivel.resumo.primeira_data_legal_gozo,
      limite_fruicao: elegivel.resumo.limite_fruicao,
      meses_disponiveis: (elegivel.resumo.meses_elegiveis || [])
        .filter((m: any) => m?.permitido && m?.data_inicio)
        .map((m: any) => ({ mes: m.mes, data_inicio: m.data_inicio })),
    };

    // Modo consulta: devolve a mesma elegibilidade que o registro usaria, para o
    // painel informar o gestor antes de qualquer ação.
    if (previa) {
      return json({
        ok: true,
        preview: true,
        periodo: {
          id: elegivel.periodo.id,
          inicio: elegivel.periodo.inicio_aquisitivo || '',
          fim: elegivel.periodo.fim_aquisitivo || '',
          ano_referencia: elegivel.periodo.ano_referencia || '',
        },
        resumo_periodo: resumoPeriodo,
        dias_liberados: elegivel.resumo.dias_sem_previsao,
      });
    }

    const agora = new Date().toISOString();
    const opcao = await base44.asServiceRole.entities.OpcaoFeriasMilitar.create({
      campanha_id: campanhaId,
      plano_ferias_institucional_id: planoId,
      ano_referencia: ano,
      militar_id: militarAlvoId,
      militar_nome: militar.nome_completo || militar.nome_guerra || '',
      militar_posto: militar.posto_graduacao || '',
      militar_matricula: militar.matricula || '',
      militar_quadro: militar.quadro || '',
      lotacao_id: militar.estrutura_id || militar.subgrupamento_id || militar.lotacao_id || '',
      lotacao_nome: militar.lotacao || militar.estrutura_nome || '',
      periodo_aquisitivo_id: elegivel.periodo.id,
      periodo_inicio: elegivel.periodo.inicio_aquisitivo || '',
      periodo_fim: elegivel.periodo.fim_aquisitivo || '',
      dias_direito: elegivel.resumo.dias_sem_previsao,
      modalidade: 'CUSTOM',
      opcao_1_meses: '',
      opcao_1_detalhes: '[]',
      opcao_2_meses: '',
      opcao_2_detalhes: '[]',
      opcao_3_meses: '',
      opcao_3_detalhes: '[]',
      origem_resposta: 'ADMINISTRATIVA',
      nao_respondeu_no_prazo: true,
      justificativa_administrativa: justificativa,
      registrado_por_email: user.email || '',
      data_registro_administrativo: agora,
      status_camada_1: 'Pendente',
      status_camada_2: 'Pendente',
      gerado_ferias_efetivas: false,
    });

    try {
      await base44.asServiceRole.entities.AuditoriaFerias.create({
        acao: 'NAO_RESPONDENTE_REGISTRADO',
        resultado: 'SUCESSO',
        usuario_id: String(user.id || ''),
        usuario_email: user.email || '',
        usuario_nome: user.full_name || user.email || 'Usuário',
        militar_id: militarAlvoId,
        militar_nome: militar.nome_completo || '',
        militar_matricula: militar.matricula || '',
        plano_id: planoId,
        campanha_id: campanhaId,
        opcao_id: String(opcao.id || ''),
        detalhes: JSON.stringify({
          justificativa,
          periodo_aquisitivo_id: elegivel.periodo.id,
          dias_liberados: elegivel.resumo.dias_sem_previsao,
          prazo_campanha: String(campanha.data_fim_militar || '').slice(0, 10),
        }),
        data_hora: agora,
      });
    } catch (_erroAuditoria) {
      // A auditoria não pode impedir o registro administrativo.
    }

    return json({
      ok: true,
      opcao,
      resumo_periodo: resumoPeriodo,
      message: `Pendência registrada. As férias de ${militar.nome_completo || 'militar'} já podem ser definidas administrativamente (${elegivel.resumo.dias_sem_previsao} dia(s)).`,
    }, 201);
  } catch (error: any) {
    return json({ error: error?.message || 'Falha ao registrar a pendência de resposta.' }, 500);
  }
}