// Serviços de férias do Portal do Militar.
// Extraído de portal_servicos para manter o endpoint dentro do limite de tamanho
// e concentrar as regras de opção de férias e de não gozo em um único módulo.

import { calcularResumoPeriodoPlano, normalizarPreferenciaMes, textoId } from './resumoPeriodoPlano.ts';
import { extractClientIp, extractUserAgent, registrarAuditoriaPortal } from '../portal/requirePortalSession.ts';

export interface FeriasCtx {
  base44: any;
  req: Request;
  payload: any;
  militar: any;
  militarId: string;
  portalConfig: any;
  campanhasAtivasMilitar: any[];
  carregarMembrosPorGrupo: (base44: any, campanhas: any[]) => Promise<Map<string, Set<string>>>;
  matchMilitarCampanha: (campanha: any, militar: any, membrosPorGrupo: Map<string, Set<string>>) => boolean;
  sessionAuth: any;
  correlationId: string;
  corsHeaders: Record<string, string>;
}

function json(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sincronizarContadoresCampanhas(
  base44: any,
  campanhasElegiveis: any[],
  campanhaAtiva: any,
  planoIdAtivo: string,
  campanhaId: string,
  carregarMembrosPorGrupo: any,
  matchMilitarCampanha: any,
) {
  try {
    const cpsSync = planoIdAtivo
      ? campanhasElegiveis.filter((c: any) => textoId(c.plano_ferias_institucional_id) === planoIdAtivo)
      : [campanhaAtiva];
    const opcsSync = planoIdAtivo
      ? await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({ plano_ferias_institucional_id: planoIdAtivo })
      : await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({ campanha_id: campanhaId });
    const respPlano = new Set((opcsSync || []).map((i: any) => textoId(i.militar_id)).filter(Boolean));
    const todosMSync = await base44.asServiceRole.entities.Militar.list();
    const mbgSync = await carregarMembrosPorGrupo(base44, cpsSync);
    for (const cp of cpsSync) {
      const membrosCp = (todosMSync || []).filter((m: any) => {
        const st = String(m?.status_cadastro || m?.status || '').trim().toLowerCase();
        return st !== 'inativo' && st !== 'falecido' && matchMilitarCampanha(cp, m, mbgSync);
      });
      const r = membrosCp.filter((m: any) => respPlano.has(textoId(m.id))).length;
      await base44.asServiceRole.entities.CampanhaPortal.update(cp.id, {
        total_respondidos: r,
        total_pendentes: Math.max(0, membrosCp.length - r),
        total_publico_alvo: membrosCp.length || Number(cp.total_publico_alvo || 0),
      });
    }
  } catch (_erroContadores) {}
}

export async function feriasGet(ctx: FeriasCtx): Promise<Response> {
  const { base44, payload, militarId, portalConfig, campanhasAtivasMilitar, corsHeaders } = ctx;

  const campanhasFeriasElegiveis = campanhasAtivasMilitar.filter((c: any) => c.tipo === 'PLANO_FERIAS');
  const campanhaSolicitada = payload?.campanha_id
    ? campanhasFeriasElegiveis.find((c: any) => c.id === payload.campanha_id) || null
    : null;
  if (payload?.campanha_id && !campanhaSolicitada) {
    return json({ error: 'A campanha de férias selecionada não está disponível para este militar.' }, 404, corsHeaders);
  }

  let campanhaComResposta: any = null;
  if (!campanhaSolicitada && campanhasFeriasElegiveis.length > 1) {
    try {
      const opcoesExistentes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({ militar_id: militarId });
      const idsElegiveis = new Set(campanhasFeriasElegiveis.map((c: any) => c.id));
      campanhaComResposta = campanhasFeriasElegiveis.find((c: any) =>
        (opcoesExistentes || []).some((opcao: any) => idsElegiveis.has(opcao.campanha_id) && opcao.campanha_id === c.id)
      ) || null;
    } catch (_eOpcoesExistentes) {}
  }

  const campanhaFeriasAtiva = campanhaSolicitada
    || campanhaComResposta
    || (campanhasFeriasElegiveis.length === 1 ? campanhasFeriasElegiveis[0] : null);

  if (!campanhaFeriasAtiva && campanhasFeriasElegiveis.length > 1) {
    return json({
      ok: true,
      ano_referencia: null,
      campanha: null,
      campanhas_ferias_elegiveis: campanhasFeriasElegiveis,
      campanhas_ativas: campanhasAtivasMilitar,
      periodos: [],
      periodo_mais_antigo_id: null,
      nao_gozo_permitido: true,
      motivo_bloqueio_nao_gozo: '',
      opcao_militar_enviada: null,
      bloqueado_por_dependencia: false,
      motivo_bloqueio: '',
      dependencia_tipo: 'ATUALIZACAO_CADASTRAL',
      campanha_cadastral_pendente: null,
      config: {
        ativo: portalConfig?.ferias_ativo !== false,
        modo_selecao: portalConfig?.ferias_modo_selecao_periodo || 'mais_antigo',
        permitir_1_etapa: portalConfig?.ferias_permitir_1_etapa_30d !== false,
        permitir_2_etapas: portalConfig?.ferias_permitir_2_etapas_15d !== false,
        permitir_3_etapas: portalConfig?.ferias_permitir_3_etapas_10d !== false,
        permitir_custom: Boolean(portalConfig?.ferias_permitir_custom),
        exigir_atualizacao_cadastral: false,
        prazo_limite: '',
        instrucoes: '',
      },
    }, 200, corsHeaders);
  }

  const planoIdAtivoFerias = textoId(campanhaFeriasAtiva?.plano_ferias_institucional_id);
  let opcaoPlanoExistente: any = null;
  if (planoIdAtivoFerias) {
    try {
      const ops = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({ militar_id: militarId });
      opcaoPlanoExistente = (ops || []).find((op: any) => textoId(op?.plano_ferias_institucional_id) === planoIdAtivoFerias) || null;
    } catch (_e) {}
    if (
      campanhaSolicitada
      && opcaoPlanoExistente
      && textoId(opcaoPlanoExistente.campanha_id) !== textoId(campanhaSolicitada.id)
      && campanhasFeriasElegiveis.some((c: any) => c.id === opcaoPlanoExistente.campanha_id)
    ) {
      return json({
        ok: true,
        redirecionar_campanha_id: opcaoPlanoExistente.campanha_id,
        mensagem_redirecionamento: 'Você já respondeu a este plano por outra campanha. Redirecionando para a campanha original.',
      }, 200, corsHeaders);
    }
  }

  const anoCampanha = campanhaFeriasAtiva?.ano_referencia || (new Date().getFullYear() + 1);
  let rawPeriodos: any[] = [];
  let feriasMilitarPlano: any[] = [];
  let ajustesMilitarPlano: any[] = [];
  try {
    [rawPeriodos, feriasMilitarPlano, ajustesMilitarPlano] = await Promise.all([
      base44.asServiceRole.entities.PeriodoAquisitivo.filter({ militar_id: militarId }),
      base44.asServiceRole.entities.Ferias.filter({ militar_id: militarId }),
      base44.asServiceRole.entities.AjusteSaldoFerias.filter({ militar_id: militarId }),
    ]);
  } catch (_e) {}

  const periodosOrdenados = (rawPeriodos || []).sort((a: any, b: any) => {
    const dtA = new Date(a.inicio_aquisitivo || a.created_date || '1970-01-01').getTime();
    const dtB = new Date(b.inicio_aquisitivo || b.created_date || '1970-01-01').getTime();
    return dtA - dtB;
  });

  const feriasDoPlanoPortal = feriasMilitarPlano;
  const periodosComResumo = periodosOrdenados.map((p: any) => ({
    ...p,
    ...calcularResumoPeriodoPlano(p, feriasDoPlanoPortal, ajustesMilitarPlano, Number(anoCampanha)),
  }));
  const periodoMaisAntigoElegivel = periodosComResumo.find((p: any) => p.elegivel_plano && p.dias_sem_previsao > 0) || null;
  const maisAntigoId: string | null = periodoMaisAntigoElegivel?.id || null;

  const periodosFormatados = periodosComResumo.map((p: any) => ({
    ...p,
    is_mais_antigo_pendente: p.id === maisAntigoId,
    is_periodo_plano_selecionavel: p.id === maisAntigoId,
  }));

  // Bloqueio total do não gozo: se qualquer período elegível do militar tem o
  // prazo de gozo vencendo dentro do ano do plano, a escolha de meses é obrigatória.
  const periodosElegiveisEmRisco = periodosComResumo.filter((p: any) =>
    p.elegivel_plano && p.dias_sem_previsao > 0 && p.vence_no_plano
  );
  const naoGozoPermitido = periodosElegiveisEmRisco.length === 0;
  const motivoBloqueioNaoGozo = naoGozoPermitido
    ? ''
    : `Você possui período aquisitivo com prazo de gozo até ${periodosElegiveisEmRisco[0].limite_fruicao || 'o encerramento do prazo'}. É obrigatório escolher as opções de meses para não perder o direito.`;

  let opcoesEnviadas: any[] = opcaoPlanoExistente ? [opcaoPlanoExistente] : [];
  if (!opcaoPlanoExistente && campanhaFeriasAtiva?.id && !planoIdAtivoFerias) {
    try {
      opcoesEnviadas = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({ militar_id: militarId, campanha_id: campanhaFeriasAtiva.id });
    } catch (_e) {}
  }

  let regrasCampanha: any = {};
  if (campanhaFeriasAtiva?.config_regras) {
    try {
      regrasCampanha = typeof campanhaFeriasAtiva.config_regras === 'string'
        ? JSON.parse(campanhaFeriasAtiva.config_regras)
        : (campanhaFeriasAtiva.config_regras || {});
    } catch (_errRegras) {}
  }

  const permitir1Etapa = regrasCampanha.permitir_1_etapa_30d !== undefined
    ? Boolean(regrasCampanha.permitir_1_etapa_30d)
    : (portalConfig?.ferias_permitir_1_etapa_30d !== false);

  const permitir2Etapas = regrasCampanha.permitir_2_etapas_15d !== undefined
    ? Boolean(regrasCampanha.permitir_2_etapas_15d)
    : (portalConfig?.ferias_permitir_2_etapas_15d !== false);

  const permitir3Etapas = regrasCampanha.permitir_3_etapas_10d !== undefined
    ? Boolean(regrasCampanha.permitir_3_etapas_10d)
    : (portalConfig?.ferias_permitir_3_etapas_10d !== false);

  const modoSelecao = regrasCampanha.modo_selecao_periodo || portalConfig?.ferias_modo_selecao_periodo || 'mais_antigo';

  // Verificação de Dependência em Cascata (Exigir Atualização Cadastral prévia)
  let bloqueadoPorDependencia = false;
  let motivoBloqueio = '';
  let campanhaCadastralPendente: any = null;

  const exigirAtualizacao = regrasCampanha.exigir_atualizacao_cadastral === true ||
    portalConfig?.ferias_exigir_atualizacao_cadastral === true ||
    Boolean(campanhaFeriasAtiva?.exigir_atualizacao_cadastral);

  if (exigirAtualizacao) {
    const campanhaCadastralAtiva = campanhasAtivasMilitar.find(
      (c: any) => c.tipo === 'ATUALIZACAO_CADASTRAL' || c.tipo === 'CONFERENCIA_GERAL'
    );
    const dataReferenciaInicio = (campanhaCadastralAtiva?.data_inicio || campanhaFeriasAtiva?.data_inicio || `${new Date().getFullYear()}-01-01`).split('T')[0];

    let confirmouExpressamente = false;
    try {
      const logs = await base44.asServiceRole.entities.PortalAuditoria.filter({
        militar_id: militarId,
        acao: 'CONFERENCIA_CADASTRAL_CONFIRMADA',
      });
      confirmouExpressamente = (logs || []).some((l: any) => {
        const dt = (l.created_at || l.created_date || '').split('T')[0];
        return dt >= dataReferenciaInicio;
      });
    } catch (_errAudit) {}

    let temSolicitacaoNaVigencia = false;
    try {
      const solicitacoes = await base44.asServiceRole.entities.SolicitacaoAtualizacao.filter({ militar_id: militarId });
      temSolicitacaoNaVigencia = (solicitacoes || []).some((s: any) => {
        const dt = (s.data_solicitacao || s.created_date || '').split('T')[0];
        return dt >= dataReferenciaInicio;
      });
    } catch (_eSol) {}

    const cadastroConcluido = confirmouExpressamente || temSolicitacaoNaVigencia;
    if (!cadastroConcluido) {
      bloqueadoPorDependencia = true;
      motivoBloqueio = 'Para registrar suas preferências de férias, é obrigatório concluir primeiro a Atualização & Conferência Cadastral.';
      campanhaCadastralPendente = campanhaCadastralAtiva || null;
    }
  }

  return json({
    ok: true,
    ano_referencia: anoCampanha,
    campanha: campanhaFeriasAtiva || null,
    campanhas_ativas: campanhasAtivasMilitar,
    periodos: periodosFormatados,
    periodo_mais_antigo_id: maisAntigoId,
    nao_gozo_permitido: naoGozoPermitido,
    motivo_bloqueio_nao_gozo: motivoBloqueioNaoGozo,
    opcao_militar_enviada: opcoesEnviadas?.[0] || null,
    bloqueado_por_dependencia: bloqueadoPorDependencia,
    motivo_bloqueio: motivoBloqueio,
    dependencia_tipo: 'ATUALIZACAO_CADASTRAL',
    campanha_cadastral_pendente: campanhaCadastralPendente,
    config: {
      ativo: portalConfig?.ferias_ativo !== false,
      modo_selecao: modoSelecao,
      permitir_1_etapa: permitir1Etapa,
      permitir_2_etapas: permitir2Etapas,
      permitir_3_etapas: permitir3Etapas,
      permitir_custom: Boolean(portalConfig?.ferias_permitir_custom),
      exigir_atualizacao_cadastral: exigirAtualizacao,
      prazo_limite: campanhaFeriasAtiva?.data_fim_militar || portalConfig?.ferias_prazo_limite || '',
      instrucoes: campanhaFeriasAtiva?.instrucoes || portalConfig?.ferias_instrucoes || 'Informe suas 3 opções de meses para a escala de férias.',
    },
  }, 200, corsHeaders);
}

export async function feriasSubmeterOpcao(ctx: FeriasCtx): Promise<Response> {
  const {
    base44, req, payload, militar, militarId, portalConfig,
    campanhasAtivasMilitar, carregarMembrosPorGrupo, matchMilitarCampanha,
    sessionAuth, correlationId, corsHeaders,
  } = ctx;

  const { periodo_aquisitivo_id, modalidade, opcao_1, opcao_2, opcao_3 } = payload;
  const naoGozoSolicitado = payload.nao_gozo === true;

  const campanhasFeriasElegiveisSubmissao = campanhasAtivasMilitar.filter((c: any) => c.tipo === 'PLANO_FERIAS');
  const campanhaSolicitada = payload.campanha_id
    ? campanhasFeriasElegiveisSubmissao.find((c: any) => c.id === payload.campanha_id)
    : null;
  if (payload.campanha_id && !campanhaSolicitada) {
    return json({ error: 'A campanha de férias selecionada não está mais disponível para receber respostas.' }, 404, corsHeaders);
  }
  if (!payload.campanha_id && campanhasFeriasElegiveisSubmissao.length > 1) {
    return json({ error: 'Selecione explicitamente a campanha de férias antes de enviar suas opções.' }, 409, corsHeaders);
  }
  const campanhaFeriasAtiva = campanhaSolicitada || campanhasFeriasElegiveisSubmissao[0] || null;
  if (!campanhaFeriasAtiva?.id) {
    return json({ error: 'Não há campanha de férias aberta para receber esta resposta.' }, 409, corsHeaders);
  }
  const campanhaId = campanhaFeriasAtiva.id;
  const planoIdAtivo = textoId(campanhaFeriasAtiva.plano_ferias_institucional_id);
  const anoCampanha = payload.ano_referencia || campanhaFeriasAtiva?.ano_referencia || (new Date().getFullYear() + 1);

  // Guard de Dependência em Cascata
  let regrasCampanhaSubmissao: any = {};
  if (campanhaFeriasAtiva?.config_regras) {
    try {
      regrasCampanhaSubmissao = typeof campanhaFeriasAtiva.config_regras === 'string'
        ? JSON.parse(campanhaFeriasAtiva.config_regras)
        : (campanhaFeriasAtiva.config_regras || {});
    } catch (_e) {}
  }

  const exigirAtualizacaoSubmissao = regrasCampanhaSubmissao.exigir_atualizacao_cadastral === true ||
    portalConfig?.ferias_exigir_atualizacao_cadastral === true ||
    Boolean(campanhaFeriasAtiva?.exigir_atualizacao_cadastral);

  if (exigirAtualizacaoSubmissao) {
    const campanhaCadastralAtiva = campanhasAtivasMilitar.find(
      (c: any) => c.tipo === 'ATUALIZACAO_CADASTRAL' || c.tipo === 'CONFERENCIA_GERAL'
    );
    const dataReferenciaInicio = (campanhaCadastralAtiva?.data_inicio || campanhaFeriasAtiva?.data_inicio || `${new Date().getFullYear()}-01-01`).split('T')[0];

    let confirmouExpressamente = false;
    try {
      const logs = await base44.asServiceRole.entities.PortalAuditoria.filter({
        militar_id: militarId,
        acao: 'CONFERENCIA_CADASTRAL_CONFIRMADA',
      });
      confirmouExpressamente = (logs || []).some((l: any) => {
        const dt = (l.created_at || l.created_date || '').split('T')[0];
        return dt >= dataReferenciaInicio;
      });
    } catch (_errAudit) {}

    let temSolicitacaoNaVigencia = false;
    try {
      const solicitacoes = await base44.asServiceRole.entities.SolicitacaoAtualizacao.filter({ militar_id: militarId });
      temSolicitacaoNaVigencia = (solicitacoes || []).some((s: any) => {
        const dt = (s.data_solicitacao || s.created_date || '').split('T')[0];
        return dt >= dataReferenciaInicio;
      });
    } catch (_eSol) {}

    if (!confirmouExpressamente && !temSolicitacaoNaVigencia) {
      return json({ error: 'É obrigatório concluir a Atualização Cadastral antes de enviar suas preferências de férias.' }, 403, corsHeaders);
    }
  }

  if (!periodo_aquisitivo_id && !naoGozoSolicitado) {
    return json({ error: 'Não foi possível validar as opções de férias. Atualize a página e tente novamente.' }, 400, corsHeaders);
  }

  if (!naoGozoSolicitado && (!opcao_1?.parcelas?.length || !opcao_2?.parcelas?.length || !opcao_3?.parcelas?.length)) {
    return json({ error: 'É obrigatório preencher as 3 opções de preferências de meses.' }, 400, corsHeaders);
  }

  const periodo = periodo_aquisitivo_id
    ? await base44.asServiceRole.entities.PeriodoAquisitivo.get(periodo_aquisitivo_id)
    : null;
  if (periodo_aquisitivo_id && (!periodo || periodo.militar_id !== militarId)) {
    return json({ error: 'Não foi possível validar as opções de férias. Atualize a página e tente novamente.' }, 403, corsHeaders);
  }

  // Revalida no servidor qual é o período mais antigo com dias ainda sem previsão.
  // Isso impede manipulação do payload e impede reaproveitar período já integralmente comprometido.
  const [todosPeriodosSubmissao, feriasMilitarSubmissao, ajustesMilitarSubmissao] = await Promise.all([
    base44.asServiceRole.entities.PeriodoAquisitivo.filter({ militar_id: militarId }),
    base44.asServiceRole.entities.Ferias.filter({ militar_id: militarId }),
    base44.asServiceRole.entities.AjusteSaldoFerias.filter({ militar_id: militarId }),
  ]);
  const ordenadosSubmissao = (todosPeriodosSubmissao || []).sort((a: any, b: any) =>
    String(a.inicio_aquisitivo || '').localeCompare(String(b.inicio_aquisitivo || ''))
  );
  const feriasDoPlanoSubmissao = feriasMilitarSubmissao;
  const resumosSubmissao = ordenadosSubmissao.map((p: any) => ({
    periodo: p,
    resumo: calcularResumoPeriodoPlano(p, feriasDoPlanoSubmissao, ajustesMilitarSubmissao, Number(anoCampanha)),
  }));
  const maisAntigoElegivelSubmissao = resumosSubmissao.find((item: any) => item.resumo.elegivel_plano && item.resumo.dias_sem_previsao > 0);
  if (!naoGozoSolicitado && (!maisAntigoElegivelSubmissao || !periodo || maisAntigoElegivelSubmissao.periodo.id !== periodo.id)) {
    return json({
      error: 'Não foi possível validar as opções de férias. Atualize a página e tente novamente.',
      periodo_correto_id: maisAntigoElegivelSubmissao?.periodo?.id || null,
    }, 409, corsHeaders);
  }

  // ------------------------------------------------------------------
  // OPÇÃO DE NÃO GOZO — situação própria, distinta de "não respondeu".
  // Bloqueio total quando algum período elegível vence dentro do plano.
  // ------------------------------------------------------------------
  if (naoGozoSolicitado) {
    const justificativaNaoGozo = String(payload.justificativa_nao_gozo || '').trim();
    if (!justificativaNaoGozo) {
      return json({ error: 'É obrigatório informar a justificativa para não gozar férias neste plano.' }, 400, corsHeaders);
    }

    const periodoEmRiscoNaoGozo = resumosSubmissao.find((item: any) =>
      item.resumo.elegivel_plano && item.resumo.dias_sem_previsao > 0 && item.resumo.vence_no_plano
    );
    if (periodoEmRiscoNaoGozo) {
      return json({
        error: `Você possui período aquisitivo com prazo de gozo até ${periodoEmRiscoNaoGozo.resumo.limite_fruicao || 'o encerramento do prazo'}. É obrigatório escolher as opções de meses para não perder o direito.`,
        periodo_em_risco_id: periodoEmRiscoNaoGozo.periodo.id,
      }, 409, corsHeaders);
    }

    const periodoNaoGozo = periodo || maisAntigoElegivelSubmissao?.periodo || null;
    const opcoesNaoGozoPeriodo = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({
      militar_id: militarId,
    });
    const existentesNaoGozo = (opcoesNaoGozoPeriodo || []).filter((opcao: any) => {
      const mesmoPlano = planoIdAtivo && textoId(opcao?.plano_ferias_institucional_id) === planoIdAtivo;
      const mesmaCampanhaLegada = !planoIdAtivo && campanhaId && textoId(opcao?.campanha_id) === textoId(campanhaId);
      return Boolean(mesmoPlano || mesmaCampanhaLegada);
    });
    if (existentesNaoGozo?.[0]?.gerado_ferias_efetivas === true) {
      return json({ error: 'As férias deste período já foram geradas e a resposta não pode mais ser substituída.' }, 409, corsHeaders);
    }
    if (planoIdAtivo && existentesNaoGozo?.[0]?.id && textoId(existentesNaoGozo[0].campanha_id) !== textoId(campanhaId)) {
      return json({
        error: 'Você já respondeu a este plano de férias por outra campanha.',
        redirecionar_campanha_id: existentesNaoGozo[0].campanha_id,
      }, 409, corsHeaders);
    }

    const naoGozoPayload = {
      campanha_id: campanhaId,
      plano_ferias_institucional_id: planoIdAtivo,
      ano_referencia: anoCampanha,
      militar_id: militarId,
      militar_nome: militar.nome_completo || militar.nome_guerra || '',
      militar_posto: militar.posto_graduacao || '',
      militar_matricula: militar.matricula || '',
      militar_quadro: militar.quadro || '',
      lotacao_id: militar.lotacao_id || militar.grupamento_id || '',
      lotacao_nome: militar.lotacao || militar.estrutura_nome || '',
      periodo_aquisitivo_id: periodoNaoGozo?.id || '',
      periodo_inicio: periodoNaoGozo?.inicio_aquisitivo || '',
      periodo_fim: periodoNaoGozo?.fim_aquisitivo || '',
      dias_direito: Number(maisAntigoElegivelSubmissao?.resumo?.dias_sem_previsao || 0),
      modalidade: '',
      opcao_1_meses: '',
      opcao_1_detalhes: '[]',
      opcao_2_meses: '',
      opcao_2_detalhes: '[]',
      opcao_3_meses: '',
      opcao_3_detalhes: '[]',
      nao_gozo_no_plano: true,
      justificativa_nao_gozo: justificativaNaoGozo,
      data_nao_gozo: new Date().toISOString(),
      data_envio_militar: new Date().toISOString(),
      status_camada_1: 'Pendente',
      status_camada_2: 'Pendente',
      gerado_ferias_efetivas: false,
    };

    const salvoNaoGozo = existentesNaoGozo?.[0]?.id
      ? await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(existentesNaoGozo[0].id, naoGozoPayload)
      : await base44.asServiceRole.entities.OpcaoFeriasMilitar.create(naoGozoPayload);

    await sincronizarContadoresCampanhas(
      base44, campanhasFeriasElegiveisSubmissao, campanhaFeriasAtiva, planoIdAtivo, campanhaId,
      carregarMembrosPorGrupo, matchMilitarCampanha,
    );

    await registrarAuditoriaPortal(base44, {
      sessao_id: sessionAuth.context.sessao_id,
      militar_id: militarId,
      acao: 'OPCAO_FERIAS_NAO_GOZO_REGISTRADA',
      resultado: true,
      motivo_falha_sanitizado: null,
      ip_origem: extractClientIp(req),
      user_agent: extractUserAgent(req),
      correlation_id: correlationId,
    });

    return json({
      ok: true,
      message: `Registramos que você optou por não gozar férias no plano de ${anoCampanha}. Sua unidade foi informada.`,
      opcao: salvoNaoGozo,
    }, 201, corsHeaders);
  }

  const resumoPeriodoSubmissao = maisAntigoElegivelSubmissao.resumo;
  const diasPlanejar = Number(resumoPeriodoSubmissao.dias_sem_previsao || 0);
  if (diasPlanejar <= 0) {
    return json({ error: 'Não há opções de férias disponíveis para preenchimento neste plano.' }, 409, corsHeaders);
  }

  if (diasPlanejar === 30) {
    const modalidadeSolicitada = modalidade || '2_ETAPAS_15';
    const modalidadesPermitidas: Record<string, boolean> = {
      '1_ETAPA_30': regrasCampanhaSubmissao.permitir_1_etapa_30d !== undefined
        ? Boolean(regrasCampanhaSubmissao.permitir_1_etapa_30d)
        : portalConfig?.ferias_permitir_1_etapa_30d !== false,
      '2_ETAPAS_15': regrasCampanhaSubmissao.permitir_2_etapas_15d !== undefined
        ? Boolean(regrasCampanhaSubmissao.permitir_2_etapas_15d)
        : portalConfig?.ferias_permitir_2_etapas_15d !== false,
      '3_ETAPAS_10': regrasCampanhaSubmissao.permitir_3_etapas_10d !== undefined
        ? Boolean(regrasCampanhaSubmissao.permitir_3_etapas_10d)
        : portalConfig?.ferias_permitir_3_etapas_10d !== false,
      'CUSTOM': regrasCampanhaSubmissao.permitir_custom !== undefined
        ? Boolean(regrasCampanhaSubmissao.permitir_custom)
        : portalConfig?.ferias_permitir_custom === true,
    };
    if (modalidadesPermitidas[modalidadeSolicitada] !== true) {
      return json({ error: 'A modalidade de parcelamento selecionada não está autorizada nas configurações de férias.' }, 400, corsHeaders);
    }
  }

  const preferenciasNormalizadas = [
    normalizarPreferenciaMes(opcao_1, resumoPeriodoSubmissao, diasPlanejar),
    normalizarPreferenciaMes(opcao_2, resumoPeriodoSubmissao, diasPlanejar),
    normalizarPreferenciaMes(opcao_3, resumoPeriodoSubmissao, diasPlanejar),
  ];
  if (preferenciasNormalizadas.some((op: any) => !op)) {
    return json({ error: 'Uma ou mais opções de mês não estão disponíveis para este plano.' }, 400, corsHeaders);
  }
  const mesesPreferidos = preferenciasNormalizadas.map((op: any) => op.parcelas[0].mes);
  if (new Set(mesesPreferidos).size !== 3) {
    return json({ error: 'As 3 opções de meses devem ser diferentes entre si.' }, 400, corsHeaders);
  }

  const modalidadeEfetiva = diasPlanejar === 30 ? (modalidade || '2_ETAPAS_15') : 'CUSTOM';

  const opcoesMesmoMilitarPeriodo = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({
    militar_id: militarId,
    periodo_aquisitivo_id: periodo.id,
  });
  const existentes = (opcoesMesmoMilitarPeriodo || []).filter((opcao: any) => {
    const mesmoPlano = planoIdAtivo && textoId(opcao?.plano_ferias_institucional_id) === planoIdAtivo;
    const mesmaCampanhaLegada = !planoIdAtivo && campanhaId && textoId(opcao?.campanha_id) === textoId(campanhaId);
    return Boolean(mesmoPlano || mesmaCampanhaLegada);
  });

  if (existentes?.[0]?.gerado_ferias_efetivas === true) {
    return json({ error: 'As férias deste período já foram geradas e a resposta não pode mais ser substituída.' }, 409, corsHeaders);
  }
  if (planoIdAtivo && existentes?.[0]?.id && textoId(existentes[0].campanha_id) !== textoId(campanhaId)) {
    return json({
      error: 'Você já respondeu a este plano de férias por outra campanha.',
      redirecionar_campanha_id: existentes[0].campanha_id,
    }, 409, corsHeaders);
  }

  const opcaoPayload = {
    campanha_id: campanhaId,
    plano_ferias_institucional_id: planoIdAtivo,
    ano_referencia: anoCampanha,
    militar_id: militarId,
    militar_nome: militar.nome_completo || militar.nome_guerra || '',
    militar_posto: militar.posto_graduacao || '',
    militar_matricula: militar.matricula || '',
    militar_quadro: militar.quadro || '',
    lotacao_id: militar.lotacao_id || militar.grupamento_id || '',
    lotacao_nome: militar.lotacao || militar.estrutura_nome || '',
    periodo_aquisitivo_id: periodo.id,
    periodo_inicio: periodo.inicio_aquisitivo || '',
    periodo_fim: periodo.fim_aquisitivo || '',
    dias_direito: diasPlanejar,
    modalidade: modalidadeEfetiva,
    opcao_1_meses: preferenciasNormalizadas[0].meses_resumo || '',
    opcao_1_detalhes: JSON.stringify(preferenciasNormalizadas[0].parcelas),
    opcao_2_meses: preferenciasNormalizadas[1].meses_resumo || '',
    opcao_2_detalhes: JSON.stringify(preferenciasNormalizadas[1].parcelas),
    opcao_3_meses: preferenciasNormalizadas[2].meses_resumo || '',
    opcao_3_detalhes: JSON.stringify(preferenciasNormalizadas[2].parcelas),
    nao_gozo_no_plano: false,
    justificativa_nao_gozo: '',
    data_nao_gozo: '',
    data_envio_militar: new Date().toISOString(),
    status_camada_1: 'Pendente',
    status_camada_2: 'Pendente',
    gerado_ferias_efetivas: false,
  };

  const salvoRecord = existentes?.[0]?.id
    ? await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(existentes[0].id, opcaoPayload)
    : await base44.asServiceRole.entities.OpcaoFeriasMilitar.create(opcaoPayload);

  await sincronizarContadoresCampanhas(
    base44, campanhasFeriasElegiveisSubmissao, campanhaFeriasAtiva, planoIdAtivo, campanhaId,
    carregarMembrosPorGrupo, matchMilitarCampanha,
  );

  await registrarAuditoriaPortal(base44, {
    sessao_id: sessionAuth.context.sessao_id,
    militar_id: militarId,
    acao: 'OPCAO_FERIAS_3_PREFERENCIAS_ENVIADA',
    resultado: true,
    motivo_falha_sanitizado: null,
    ip_origem: extractClientIp(req),
    user_agent: extractUserAgent(req),
    correlation_id: correlationId,
  });

  return json({
    ok: true,
    message: `Suas 3 opções de férias para o plano de ${anoCampanha} foram registradas com sucesso!`,
    opcao: salvoRecord,
  }, 201, corsHeaders);
}