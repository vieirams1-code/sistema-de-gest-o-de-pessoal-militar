import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const LIMIT_USUARIO_ACESSO = 1000;
const CHUNK_MILITAR_IDS = 200;

const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id', 'perfil_id'];
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

async function resolverPermissoes(base44, email) {
  const acessos = await fetchWithRetry(() => base44.asServiceRole.entities.UsuarioAcesso.filter({ user_email: email, ativo: true }, undefined, LIMIT_USUARIO_ACESSO, 0, CAMPOS_USUARIO_ACESSO), `usuarioAcesso.list:${email}`);
  return { acessos: acessos || [], isAdminByAccess: (acessos || []).some((a) => normalizeTipo(a.tipo_acesso) === 'admin') };
}

async function listarMilitarIdsDoEscopo(base44, acessos, criteriosAplicados) {
  const ids = new Set();
  for (const acesso of acessos || []) {
    const tipo = normalizeTipo(acesso?.tipo_acesso);
    if (tipo === 'admin') return null;
    if (tipo === 'proprio') {
      if (acesso?.militar_id) { ids.add(String(acesso.militar_id)); criteriosAplicados.add('proprio'); }
      continue;
    }
    const grupamentoId = acesso?.grupamento_id || null;
    const subgrupamentoId = acesso?.subgrupamento_id || null;
    const filtros = [];
    if (tipo === 'setor' && grupamentoId) { filtros.push({ grupamento_raiz_id: grupamentoId }, { grupamento_id: grupamentoId }, { estrutura_id: grupamentoId }); criteriosAplicados.add('setor'); }
    else if (tipo === 'subsetor' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId }); criteriosAplicados.add('subsetor');
      try { const filhos = await fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }), `subgrupamento.parent:${subgrupamentoId}`); for (const f of (filhos || [])) if (f?.id) filtros.push({ estrutura_id: f.id }, { subgrupamento_id: f.id }); } catch (_e) {}
    } else if (tipo === 'unidade' && subgrupamentoId) { filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId }); criteriosAplicados.add('unidade'); }
    for (const filtro of filtros) {
      try { const militares = await fetchWithRetry(() => base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, ['id']), `militar.escopo:${JSON.stringify(filtro)}`); for (const m of (militares || [])) if (m?.id) ids.add(String(m.id)); } catch (_e) {}
    }
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
    const authUserEmail = normalizeEmail(authUser.email);
    const effectiveEmailNorm = normalizeEmail(payload?.effectiveEmail);
    const wantsImpersonation = Boolean(effectiveEmailNorm) && effectiveEmailNorm !== authUserEmail;
    const authPerms = await resolverPermissoes(base44, authUser.email);
    const authIsAdmin = String(authUser.role || '').toLowerCase() === 'admin' || authPerms.isAdminByAccess;
    if (wantsImpersonation && !authIsAdmin) return Response.json({ error: 'Ação não permitida: somente administradores podem usar effectiveEmail.' }, { status: 403 });
    const isImpersonating = wantsImpersonation && authIsAdmin;
    const targetEmail = isImpersonating ? effectiveEmailNorm : authUser.email;
    const targetPerms = isImpersonating ? await resolverPermissoes(base44, targetEmail) : authPerms;
    const targetIsAdmin = isImpersonating ? targetPerms.isAdminByAccess : authIsAdmin;
    const criteriosAplicados = new Set(); const warnings = [];
    let periodosAquisitivos = []; let militares = []; let matriculasMilitar = []; let ferias = []; let registrosLivro = []; let publicacoesExOfficio = []; let contratosDesignacaoMilitar = []; let partialFailures = 0; let totalMilitaresEscopo = null;
    if (targetIsAdmin) {
      criteriosAplicados.add('admin');
      const [paRes,mRes,matRes,fRes,rRes,pubRes,cdmRes]=await Promise.allSettled([
        fetchWithRetry(() => base44.asServiceRole.entities.PeriodoAquisitivo.list('-inicio_aquisitivo'),'periodos.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.Militar.list(),'militares.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.MatriculaMilitar.list('-created_date'),'matriculas.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.Ferias.list('-data_inicio'),'ferias.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.RegistroLivro.list(),'registros.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.PublicacaoExOfficio.list('-created_date'),'publicacoesExOfficio.admin'),
        fetchWithRetry(() => base44.asServiceRole.entities.ContratoDesignacaoMilitar.list('-data_inicio_contrato'),'contratosDesignacaoMilitar.admin'),
      ]);
      for (const r of [paRes,mRes,matRes,fRes,rRes,pubRes,cdmRes]) if (r.status === 'rejected') partialFailures += 1;
      periodosAquisitivos = paRes.status === 'fulfilled' ? (paRes.value || []) : [];
      militares = mRes.status === 'fulfilled' ? (mRes.value || []) : [];
      matriculasMilitar = matRes.status === 'fulfilled' ? (matRes.value || []) : [];
      ferias = fRes.status === 'fulfilled' ? (fRes.value || []) : [];
      registrosLivro = rRes.status === 'fulfilled' ? (rRes.value || []) : [];
      publicacoesExOfficio = pubRes.status === 'fulfilled' ? (pubRes.value || []) : [];
      contratosDesignacaoMilitar = cdmRes.status === 'fulfilled' ? (cdmRes.value || []) : [];
    } else {
      const militarIds = await listarMilitarIdsDoEscopo(base44, targetPerms.acessos, criteriosAplicados);
      if (!militarIds || militarIds.length === 0) { warnings.push('SEM_ESCOPO'); totalMilitaresEscopo = 0; }
      else {
        totalMilitaresEscopo = militarIds.length;
        const [paRes,mRes,matRes,fRes,rRes,pubRes,cdmRes]=await Promise.all([
          listarPorEscopoIds(base44,'PeriodoAquisitivo',militarIds,'-inicio_aquisitivo'), listarMilitaresPorIds(base44,militarIds), listarPorEscopoIds(base44,'MatriculaMilitar',militarIds,'-created_date'), listarPorEscopoIds(base44,'Ferias',militarIds,'-data_inicio'), listarPorEscopoIds(base44,'RegistroLivro',militarIds,undefined), listarPorEscopoIds(base44,'PublicacaoExOfficio',militarIds,'-created_date'), listarPorEscopoIds(base44,'ContratoDesignacaoMilitar',militarIds,'-data_inicio_contrato')
        ]);
        periodosAquisitivos=paRes.rows; militares=mRes.rows; matriculasMilitar=matRes.rows; ferias=fRes.rows; registrosLivro=rRes.rows; publicacoesExOfficio=pubRes.rows; contratosDesignacaoMilitar=cdmRes.rows;
        if (militarIds.length > 0 && periodosAquisitivos.length > 0 && militares.length === 0) warnings.push('MILITARES_ESCOPO_NAO_CARREGADOS');
        partialFailures = paRes.partialFailures+mRes.partialFailures+matRes.partialFailures+fRes.partialFailures+rRes.partialFailures+pubRes.partialFailures+cdmRes.partialFailures;
      }
    }
    const militaresIdsSet = new Set((militares||[]).map((m)=>String(m?.id||'')));
    const periodosSemVinculo = (periodosAquisitivos||[]).filter((p)=>!militaresIdsSet.has(String(p?.militar_id||''))).length;
    if (periodosSemVinculo>0) warnings.push(`PERIODOS_SEM_MILITAR:${periodosSemVinculo}`);
    if (partialFailures>0) warnings.push('PARTIAL_FAILURES');
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const counters = (periodosAquisitivos||[]).reduce((acc,periodo)=>{ const r=getPeriodoResumoStatus(periodo,hoje); acc.total+=1; if(r.isDisponivel)acc.disponiveis+=1; if(r.isVencendo)acc.vencendo90d+=1; if(r.isVencido)acc.vencidos+=1; return acc; }, { total:0, disponiveis:0, vencendo90d:0, vencidos:0 });
    return Response.json({ periodosAquisitivos,militares,matriculasMilitar,ferias,registrosLivro,publicacoesExOfficio,contratosDesignacaoMilitar,counters,meta:{ isAdmin: targetIsAdmin, modoAcesso: criteriosAplicados.size===1?Array.from(criteriosAplicados)[0]:(criteriosAplicados.size>1?'multiplo':null), userEmail: authUserEmail||null, effectiveEmail:isImpersonating?effectiveEmailNorm:null, criteriosAplicados:Array.from(criteriosAplicados), totalMilitaresEscopo, partialFailures, warnings }});
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao carregar bundle de períodos aquisitivos.', meta: { status } }, { status });
  }
});
