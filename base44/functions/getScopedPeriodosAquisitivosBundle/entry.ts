import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const CHUNK_MILITAR_IDS = 200;

const normalizeTipo = (t) => String(t || '').trim().toLowerCase();
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

async function fetchWithRetry(queryFn, label = 'query') {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try { return await queryFn(); } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      if (!RETRY_STATUS.has(status) || attempt === RETRY_MAX_ATTEMPTS) break;
      const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((res) => setTimeout(res, waitMs));
      console.warn(`[getScopedPeriodosAquisitivosBundle] retry step=${label} attempt=${attempt} status=${status}`);
    }
  }
  throw lastError;
}

async function resolverAutorizacaoCanonica(base44, effectiveEmail) {
  const requestPayload = effectiveEmail ? { effectiveEmail } : {};
  const response = await base44.functions.invoke('getUserPermissions', requestPayload);
  return response?.data ?? response ?? {};
}

async function listarMilitarIdsDoEscopo(base44, acessos, criteriosAplicados) {
  const ids = new Set();
  const normalizedAcessos = (acessos || []).map((a) => ({ ...a, tipo: normalizeTipo(a?.tipo_acesso) }));
  if (normalizedAcessos.some((a) => a.tipo === 'admin')) return null;

  const subsetorPromises = [];
  for (const acesso of normalizedAcessos) {
    if (acesso.tipo === 'proprio') {
      if (acesso.militar_id) { ids.add(String(acesso.militar_id)); criteriosAplicados.add('proprio'); }
    } else if (acesso.tipo === 'subsetor' && acesso.subgrupamento_id) {
      subsetorPromises.push(
        fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: acesso.subgrupamento_id }), `subgrupamento.parent:${acesso.subgrupamento_id}`)
          .then((filhos) => ({ acesso, filhos: filhos || [] }))
          .catch(() => ({ acesso, filhos: [] }))
      );
    }
  }

  const subsetorFilhosResult = await Promise.all(subsetorPromises);
  const subsetorMap = new Map(subsetorFilhosResult.map((r) => [r.acesso, r.filhos]));
  const militarFiltros = [];

  for (const acesso of normalizedAcessos) {
    const gId = acesso.grupamento_id || null;
    const sId = acesso.subgrupamento_id || null;

    if (acesso.tipo === 'setor' && gId) {
      militarFiltros.push({ grupamento_raiz_id: gId }, { grupamento_id: gId }, { estrutura_id: gId });
      criteriosAplicados.add('setor');
    } else if (acesso.tipo === 'subsetor' && sId) {
      militarFiltros.push({ estrutura_id: sId }, { subgrupamento_id: sId });
      criteriosAplicados.add('subsetor');
      const filhos = subsetorMap.get(acesso) || [];
      for (const f of filhos) if (f?.id) militarFiltros.push({ estrutura_id: f.id }, { subgrupamento_id: f.id });
    } else if (acesso.tipo === 'unidade' && sId) {
      militarFiltros.push({ estrutura_id: sId }, { subgrupamento_id: sId });
      criteriosAplicados.add('unidade');
    }
  }

  const militarPromises = militarFiltros.map((filtro) =>
    fetchWithRetry(() => base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, ['id']), `militar.escopo:${JSON.stringify(filtro)}`)
      .catch(() => [])
  );

  const militarResults = await Promise.all(militarPromises);
  for (const militares of militarResults) {
    for (const m of (militares || [])) if (m?.id) ids.add(String(m.id));
  }

  return Array.from(ids);
}

async function listarPorEscopoIds(base44, entityName, militarIds, orderBy) {
  const out = []; let partialFailures = 0;
  for (let i = 0; i < militarIds.length; i += CHUNK_MILITAR_IDS) {
    const chunk = militarIds.slice(i, i + CHUNK_MILITAR_IDS);
    try { const rows = await fetchWithRetry(() => base44.asServiceRole.entities[entityName].filter({ militar_id: { $in: chunk } }, orderBy, 1000, 0), `${entityName}.chunk`); out.push(...(rows || [])); }
    catch (_e) { partialFailures += 1; }
  }
  return { rows: out, partialFailures };
}

async function listarMilitaresPorIds(base44, militarIds) {
  const out = [];
  let partialFailures = 0;
  for (let i = 0; i < militarIds.length; i += CHUNK_MILITAR_IDS) {
    const chunk = militarIds.slice(i, i + CHUNK_MILITAR_IDS);
    try {
      const rows = await fetchWithRetry(
        () => base44.asServiceRole.entities.Militar.filter({ id: { $in: chunk } }, undefined, 1000, 0),
        'Militar.ids'
      );
      out.push(...(rows || []));
    } catch (_e) {
      partialFailures += 1;
    }
  }
  return { rows: out, partialFailures };
}

function projetarCampos(item, campos) {
  if (!item || typeof item !== 'object') return item;
  const out = {};
  for (const campo of campos) if (campo in item) out[campo] = item[campo];
  return out;
}

const CAMPOS_MILITAR_SUPORTE = [
  'id', 'nome', 'nome_completo', 'nome_guerra', 'matricula', 'posto_graduacao', 'quadro',
  'lotacao', 'lotacao_atual', 'estrutura_id', 'estrutura_nome', 'subgrupamento_nome', 'grupamento_nome',
  'data_inclusao', 'status', 'status_cadastro', 'situacao_militar', 'ativo', 'merged_into_id',
];
const CAMPOS_MATRICULA_SUPORTE = ['id', 'militar_id', 'matricula', 'matricula_normalizada', 'data_inicio', 'data_fim', 'is_atual', 'situacao'];
const CAMPOS_FERIAS_SUPORTE = [
  'id', 'militar_id', 'periodo_aquisitivo_id', 'periodo_aquisitivo_ref', 'status', 'dias', 'fracionamento',
  'data_inicio', 'data_fim', 'data_retorno', 'data_termino',
];
const CAMPOS_REGISTRO_LIVRO_SUPORTE = [
  'id', 'militar_id', 'ferias_id', 'periodo_aquisitivo_id', 'periodo_id', 'referencia_id', 'tipo_registro',
  'periodo_aquisitivo_ref', 'ano_referencia', 'data_registro', 'data_inicio', 'created_date', 'numero_bg', 'data_bg',
];
const CAMPOS_PUBLICACAO_SUPORTE = [
  'id', 'militar_id', 'ferias_id', 'ferias_interrompida_id', 'gozo_ferias_id', 'gozo_id', 'registro_livro_id',
  'livro_id', 'referencia_id', 'periodo_aquisitivo_id', 'periodo_id', 'periodo_aquisitivo_ref', 'ano_referencia',
  'tipo_publicacao', 'status', 'numero_bg', 'data_bg',
];
const CAMPOS_CONTRATO_SUPORTE = [
  'id', 'militar_id', 'status_contrato', 'data_inicio_contrato', 'data_fim_contrato', 'data_inclusao_para_ferias',
  'gera_direito_ferias', 'regra_geracao_periodos',
];
const CAMPOS_AJUSTE_SALDO_SUPORTE = [
  'id', 'militar_id', 'periodo_aquisitivo_id', 'periodo_aquisitivo_ref', 'tipo', 'dias', 'status', 'created_date',
];
const CAMPOS_AJUSTE_SALDO_DETALHADO = [
  ...CAMPOS_AJUSTE_SALDO_SUPORTE,
  'militar_nome', 'motivo', 'origem', 'publicacao_id', 'entidade_origem', 'entidade_origem_id',
  'observacoes', 'criado_por_email', 'cancelado_em', 'cancelado_por_email', 'motivo_cancelamento',
];
const CAMPOS_TEXTO_REFERENCIA = [
  'periodo_aquisitivo', 'documento_referencia', 'documento_texto', 'texto_publicacao', 'nota_para_bg',
  'observacoes', 'texto_base', 'texto_complemento',
];

function construirReferenciasPorMilitar(periodos = []) {
  const mapa = new Map();
  for (const periodo of periodos || []) {
    const militarId = String(periodo?.militar_id || '').trim();
    const referencia = String(periodo?.ano_referencia || periodo?.referencia || periodo?.periodo_aquisitivo_ref || '').trim();
    if (!militarId || !referencia) continue;
    if (!mapa.has(militarId)) mapa.set(militarId, new Set());
    mapa.get(militarId).add(referencia);
  }
  return mapa;
}

function detectarReferenciaPeriodo(registro = {}, referenciasPorMilitar = new Map()) {
  const estruturada = String(registro?.periodo_aquisitivo_ref || registro?.ano_referencia || '').trim();
  if (estruturada) return estruturada;
  const militarId = String(registro?.militar_id || '').trim();
  const referencias = referenciasPorMilitar.get(militarId);
  if (!referencias?.size) return '';
  const blob = CAMPOS_TEXTO_REFERENCIA.map((campo) => String(registro?.[campo] || '')).filter(Boolean).join(' ');
  if (!blob) return '';
  for (const referencia of referencias) if (blob.includes(referencia)) return referencia;
  return '';
}

function sanitizarDadosSuporte({ periodosAquisitivos, militares, matriculasMilitar, ferias, registrosLivro, publicacoesExOfficio, contratosDesignacaoMilitar, ajustesSaldoFerias, incluirAjustesDetalhados = false }) {
  const referenciasPorMilitar = construirReferenciasPorMilitar(periodosAquisitivos);
  return {
    militares: (militares || []).map((item) => projetarCampos(item, CAMPOS_MILITAR_SUPORTE)),
    matriculasMilitar: (matriculasMilitar || []).map((item) => projetarCampos(item, CAMPOS_MATRICULA_SUPORTE)),
    ferias: (ferias || []).map((item) => projetarCampos(item, CAMPOS_FERIAS_SUPORTE)),
    registrosLivro: (registrosLivro || []).map((item) => ({
      ...projetarCampos(item, CAMPOS_REGISTRO_LIVRO_SUPORTE),
      periodo_aquisitivo_ref: detectarReferenciaPeriodo(item, referenciasPorMilitar),
    })),
    publicacoesExOfficio: (publicacoesExOfficio || []).map((item) => ({
      ...projetarCampos(item, CAMPOS_PUBLICACAO_SUPORTE),
      periodo_aquisitivo_ref: detectarReferenciaPeriodo(item, referenciasPorMilitar),
    })),
    contratosDesignacaoMilitar: (contratosDesignacaoMilitar || []).map((item) => projetarCampos(item, CAMPOS_CONTRATO_SUPORTE)),
    ajustesSaldoFerias: (ajustesSaldoFerias || []).map((item) => projetarCampos(
      item,
      incluirAjustesDetalhados ? CAMPOS_AJUSTE_SALDO_DETALHADO : CAMPOS_AJUSTE_SALDO_SUPORTE,
    )),
  };
}

function getPeriodoResumoStatus(periodo, hoje) {
  const isDisponivel = periodo?.status === 'Disponível';
  let isVencendo = false; let isVencido = false;
  if (periodo?.data_limite_gozo) {
    const limite = new Date(`${periodo.data_limite_gozo}T00:00:00`);
    if (!Number.isNaN(limite.getTime())) { const diffDias = Math.floor((limite.getTime() - hoje.getTime()) / 86400000); isVencido = diffDias < 0; isVencendo = !isVencido && diffDias <= 90; }
  }
  return { isDisponivel, isVencendo, isVencido };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    let payload = {}; try { payload = await req.json(); } catch (_e) {}
    const authz = await resolverAutorizacaoCanonica(base44, payload?.effectiveEmail);
    if (authz?.error) return Response.json({ error: authz.error }, { status: 403 });
    const incluirAjustesDetalhadosSolicitado = payload?.includeAjustesDetalhados === true;
    const acoesLeituraSuporte = [
      'visualizar_periodos_aquisitivos', 'visualizar_ferias', 'visualizar_creditos_ferias',
      'criar_ferias', 'editar_ferias', 'gerar_periodos_aquisitivos',
      'criar_credito_extra_ferias', 'cancelar_credito_extra_ferias',
    ];
    const canReadPeriodoSupport = authz?.isAdmin === true || (
      authz?.modules?.ferias === true && acoesLeituraSuporte.some((acao) => authz?.actions?.[acao] === true)
    );
    if (!canReadPeriodoSupport) {
      return Response.json({
        error: 'Acesso negado: permissão funcional de Férias insuficiente para consultar períodos aquisitivos.',
        requiredModule: 'ferias',
        requiredAnyPermission: acoesLeituraSuporte,
      }, { status: 403 });
    }
    const podeVerAjustesDetalhados = authz?.isAdmin === true || (
      authz?.modules?.ferias === true && authz?.actions?.visualizar_creditos_ferias === true
    );
    if (incluirAjustesDetalhadosSolicitado && !podeVerAjustesDetalhados) {
      return Response.json({
        error: 'Acesso negado: detalhes de ajustes de saldo exigem visualizar créditos de férias.',
        requiredModule: 'ferias',
        requiredPermission: 'visualizar_creditos_ferias',
      }, { status: 403 });
    }
    const authUserEmail = normalizeEmail(authz?.authUserEmail || authUser.email);
    const effectiveEmailNorm = normalizeEmail(authz?.effectiveUserEmail || authUser.email);
    const isImpersonating = authz?.isImpersonating === true;
    const targetIsAdmin = authz?.isAdmin === true;
    const targetHasGlobalScope = authz?.hasGlobalScope === true;
    const targetAcessos = Array.isArray(authz?.acessos) ? authz.acessos : [];
    const criteriosAplicados = new Set(); const warnings = [];
    let periodosAquisitivos = []; let militares = []; let matriculasMilitar = []; let ferias = []; let registrosLivro = []; let publicacoesExOfficio = []; let contratosDesignacaoMilitar = []; let ajustesSaldoFerias = []; let partialFailures = 0; let totalMilitaresEscopo = null;
    if (targetHasGlobalScope) {
      criteriosAplicados.add('global');
      const [paRes,mRes,matRes,fRes,rRes,pubRes,cdmRes,ajRes]=await Promise.allSettled([
        fetchWithRetry(() => base44.asServiceRole.entities.PeriodoAquisitivo.list('-inicio_aquisitivo'),'periodos.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.Militar.list(),'militares.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.MatriculaMilitar.list('-created_date'),'matriculas.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.Ferias.list('-data_inicio'),'ferias.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.RegistroLivro.list(),'registros.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.PublicacaoExOfficio.list('-created_date'),'publicacoesExOfficio.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.ContratoDesignacaoMilitar.list('-data_inicio_contrato'),'contratosDesignacaoMilitar.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.AjusteSaldoFerias.list('-created_date'),'ajustesSaldoFerias.admin'),
      ]);
      for (const r of [paRes,mRes,matRes,fRes,rRes,pubRes,cdmRes,ajRes]) if (r.status === 'rejected') partialFailures += 1;
      periodosAquisitivos = paRes.status === 'fulfilled' ? (paRes.value || []) : [];
      militares = mRes.status === 'fulfilled' ? (mRes.value || []) : [];
      matriculasMilitar = matRes.status === 'fulfilled' ? (matRes.value || []) : [];
      ferias = fRes.status === 'fulfilled' ? (fRes.value || []) : [];
      registrosLivro = rRes.status === 'fulfilled' ? (rRes.value || []) : [];
      publicacoesExOfficio = pubRes.status === 'fulfilled' ? (pubRes.value || []) : [];
      contratosDesignacaoMilitar = cdmRes.status === 'fulfilled' ? (cdmRes.value || []) : [];
      ajustesSaldoFerias = ajRes.status === 'fulfilled' ? (ajRes.value || []) : [];
    } else {
      const militarIds = await listarMilitarIdsDoEscopo(base44, targetAcessos, criteriosAplicados);
      if (!militarIds || militarIds.length === 0) { warnings.push('SEM_ESCOPO'); totalMilitaresEscopo = 0; }
      else {
        totalMilitaresEscopo = militarIds.length;
        const [paRes,mRes,matRes,fRes,rRes,pubRes,cdmRes,ajRes]=await Promise.all([
          listarPorEscopoIds(base44,'PeriodoAquisitivo',militarIds,'-inicio_aquisitivo'), listarMilitaresPorIds(base44,militarIds), listarPorEscopoIds(base44,'MatriculaMilitar',militarIds,'-created_date'), listarPorEscopoIds(base44,'Ferias',militarIds,'-data_inicio'), listarPorEscopoIds(base44,'RegistroLivro',militarIds,undefined), listarPorEscopoIds(base44,'PublicacaoExOfficio',militarIds,'-created_date'), listarPorEscopoIds(base44,'ContratoDesignacaoMilitar',militarIds,'-data_inicio_contrato'), listarPorEscopoIds(base44,'AjusteSaldoFerias',militarIds,'-created_date')
        ]);
        periodosAquisitivos=paRes.rows; militares=mRes.rows; matriculasMilitar=matRes.rows; ferias=fRes.rows; registrosLivro=rRes.rows; publicacoesExOfficio=pubRes.rows; contratosDesignacaoMilitar=cdmRes.rows; ajustesSaldoFerias=ajRes.rows;
        if (militarIds.length > 0 && periodosAquisitivos.length > 0 && militares.length === 0) warnings.push('MILITARES_ESCOPO_NAO_CARREGADOS');
        partialFailures = paRes.partialFailures+mRes.partialFailures+matRes.partialFailures+fRes.partialFailures+rRes.partialFailures+pubRes.partialFailures+cdmRes.partialFailures+ajRes.partialFailures;
      }
    }
    const militaresIdsSet = new Set((militares||[]).map((m)=>String(m?.id||'')));
    const periodosSemVinculo = (periodosAquisitivos||[]).filter((p)=>!militaresIdsSet.has(String(p?.militar_id||''))).length;
    if (periodosSemVinculo>0) warnings.push(`PERIODOS_SEM_MILITAR:${periodosSemVinculo}`);
    if (partialFailures>0) warnings.push('PARTIAL_FAILURES');
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const counters = (periodosAquisitivos||[]).reduce((acc,periodo)=>{ const r=getPeriodoResumoStatus(periodo,hoje); acc.total+=1; if(r.isDisponivel)acc.disponiveis+=1; if(r.isVencendo)acc.vencendo90d+=1; if(r.isVencido)acc.vencidos+=1; return acc; }, { total:0, disponiveis:0, vencendo90d:0, vencidos:0 });
    const suporte = sanitizarDadosSuporte({
      periodosAquisitivos,
      militares,
      matriculasMilitar,
      ferias,
      registrosLivro,
      publicacoesExOfficio,
      contratosDesignacaoMilitar,
      ajustesSaldoFerias,
      incluirAjustesDetalhados: incluirAjustesDetalhadosSolicitado && podeVerAjustesDetalhados,
    });
    return Response.json({ periodosAquisitivos,...suporte,counters,meta:{ isAdmin: targetIsAdmin, hasGlobalScope: targetHasGlobalScope, modoAcesso: criteriosAplicados.size===1?Array.from(criteriosAplicados)[0]:(criteriosAplicados.size>1?'multiplo':null), userEmail: authUserEmail||null, effectiveEmail:isImpersonating?effectiveEmailNorm:null, criteriosAplicados:Array.from(criteriosAplicados), totalMilitaresEscopo, partialFailures, warnings, supportingDataSanitized:true }});
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao carregar bundle de períodos aquisitivos.', meta: { status } }, { status });
  }
});
