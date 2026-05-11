import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const LIMIT_USUARIO_ACESSO = 1000;
const CHUNK_SIZE = 200;
const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id', 'perfil_id'];
const CAMPOS_MILITAR_RESUMO = ['id', 'nome_completo', 'nome_guerra', 'matricula', 'posto_graduacao', 'quadro', 'grupamento_id', 'subgrupamento_id', 'estrutura_id', 'grupamento_raiz_id'];
const CAMPOS_MATRICULA = ['id', 'militar_id', 'matricula', 'matricula_normalizada', 'tipo_matricula', 'situacao', 'is_atual', 'data_inicio', 'data_fim'];
const CAMPOS_PERIODO_LEGADO = ['id', 'militar_id', 'legado_ativa', 'legado_ativa_contrato_designacao_id', 'legado_ativa_em', 'created_date', 'updated_date'];

const normalizeTipo = (t) => String(t || '').trim().toLowerCase();
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
const normalizeStatus = (s) => String(s || 'ativo').trim().toLowerCase();
const hojeUtc = () => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');

async function fetchWithRetry(queryFn, label = 'query') {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt += 1) {
    try { return await queryFn(); } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      if (!RETRY_STATUS.has(status) || attempt === RETRY_MAX_ATTEMPTS) break;
      const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((res) => setTimeout(res, waitMs));
      console.warn(`[getScopedPainelContratosDesignacao] retry step=${label} attempt=${attempt} status=${status}`);
    }
  }
  throw lastError;
}

function extrairMatrizPermissoes(descricao) {
  if (typeof descricao !== 'string' || !descricao) return {};
  const start = descricao.indexOf('[SGP_PERMISSIONS_MATRIX]');
  const end = descricao.indexOf('[/SGP_PERMISSIONS_MATRIX]');
  if (start === -1 || end === -1 || end <= start) return {};
  try {
    const parsed = JSON.parse(descricao.slice(start + '[SGP_PERMISSIONS_MATRIX]'.length, end).trim());
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_e) { return {}; }
}

function consolidarActions(perfis, acessos) {
  const actions = {};
  const aplicarFonte = (fonte) => {
    if (!fonte) return;
    Object.entries(fonte).forEach(([key, val]) => {
      if (typeof val !== 'boolean' || !key.startsWith('perm_')) return;
      const actionKey = key.replace(/^perm_/, '');
      if (val === true) actions[actionKey] = true;
      else if (!(actionKey in actions)) actions[actionKey] = false;
    });
  };
  (perfis || []).forEach((perfil) => { aplicarFonte(perfil); aplicarFonte(extrairMatrizPermissoes(perfil?.descricao)); });
  (acessos || []).forEach(aplicarFonte);
  return actions;
}

async function resolverPermissoes(base44, email) {
  const acessos = await fetchWithRetry(
    () => base44.asServiceRole.entities.UsuarioAcesso.filter({ user_email: email, ativo: true }, undefined, LIMIT_USUARIO_ACESSO, 0, CAMPOS_USUARIO_ACESSO),
    `usuarioAcesso.list:${email}`,
  );
  const perfilIds = Array.from(new Set((acessos || []).map((a) => a?.perfil_id).filter(Boolean)));
  let perfis = [];
  if (perfilIds.length > 0) {
    perfis = await fetchWithRetry(() => base44.asServiceRole.entities.PerfilPermissao.filter({ id: { $in: perfilIds }, ativo: true }), `perfilPermissao.in:${email}`);
  }
  return { acessos: acessos || [], perfis: perfis || [], actions: consolidarActions(perfis || [], acessos || []), isAdminByAccess: (acessos || []).some((a) => normalizeTipo(a.tipo_acesso) === 'admin') };
}

async function listarMilitarIdsDoEscopo(base44, acessos, criteriosAplicados, warnings) {
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
      try {
        const filhos = await fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }), `subgrupamento.parent:${subgrupamentoId}`);
        for (const filho of (filhos || [])) if (filho?.id) filtros.push({ estrutura_id: filho.id }, { subgrupamento_id: filho.id });
      } catch (_e) { warnings.push('FALHA_LISTAR_SUBSETORES_FILHOS'); }
    } else if (tipo === 'unidade' && subgrupamentoId) { filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId }); criteriosAplicados.add('unidade'); }

    for (const filtro of filtros) {
      try {
        const militares = await fetchWithRetry(() => base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, ['id']), `militar.escopo:${JSON.stringify(filtro)}`);
        for (const militar of (militares || [])) if (militar?.id) ids.add(String(militar.id));
      } catch (_e) { warnings.push('FALHA_FILTRO_ESCOPO_MILITARES'); }
    }
  }
  return Array.from(ids);
}

function getModoAcesso(criteriosAplicados) {
  if (criteriosAplicados.size === 1) return Array.from(criteriosAplicados)[0];
  if (criteriosAplicados.size > 1) return 'multiplo';
  return null;
}

async function listarPorIds(base44, entityName, ids, campos, orderBy) {
  const rows = []; let partialFailures = 0;
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    try { rows.push(...((await fetchWithRetry(() => base44.asServiceRole.entities[entityName].filter({ id: { $in: chunk } }, orderBy, 1000, 0, campos), `${entityName}.ids`)) || [])); }
    catch (_e) { partialFailures += 1; }
  }
  return { rows, partialFailures };
}

async function listarPorMilitarIds(base44, entityName, militarIds, campos, orderBy, filtroExtra = {}) {
  const rows = []; let partialFailures = 0;
  for (let i = 0; i < militarIds.length; i += CHUNK_SIZE) {
    const chunk = militarIds.slice(i, i + CHUNK_SIZE);
    try { rows.push(...((await fetchWithRetry(() => base44.asServiceRole.entities[entityName].filter({ ...filtroExtra, militar_id: { $in: chunk } }, orderBy, 1000, 0, campos), `${entityName}.militarIds`)) || [])); }
    catch (_e) { partialFailures += 1; }
  }
  return { rows, partialFailures };
}

function diasParaVencimento(contrato, hoje) {
  const raw = contrato?.data_fim_contrato;
  if (!raw) return null;
  const fim = new Date(String(raw).slice(0, 10) + 'T00:00:00Z');
  if (Number.isNaN(fim.getTime())) return null;
  return Math.ceil((fim.getTime() - hoje.getTime()) / 86400000);
}

function montarLegado(periodos, contratos) {
  const legado = {};
  for (const contrato of contratos || []) if (contrato?.id) legado[String(contrato.id)] = { aplicado: false, totalPeriodos: 0, ultimaAplicacaoEm: null };
  for (const periodo of periodos || []) {
    if (!periodo?.legado_ativa || !periodo?.legado_ativa_contrato_designacao_id) continue;
    const contratoId = String(periodo.legado_ativa_contrato_designacao_id);
    if (!legado[contratoId]) legado[contratoId] = { aplicado: false, totalPeriodos: 0, ultimaAplicacaoEm: null };
    const aplicacao = periodo.legado_ativa_em || periodo.updated_date || periodo.created_date || null;
    legado[contratoId].aplicado = true;
    legado[contratoId].totalPeriodos += 1;
    if (!legado[contratoId].ultimaAplicacaoEm || (aplicacao && aplicacao > legado[contratoId].ultimaAplicacaoEm)) legado[contratoId].ultimaAplicacaoEm = aplicacao;
  }
  return legado;
}

function calcularCounters(contratos, legado) {
  const hoje = hojeUtc();
  const counters = { ativos: 0, vencendo30: 0, vencendo60: 0, vencendo90: 0, vencidos: 0, semDataFim: 0, legadoAtivaAplicada: 0, legadoAtivaPendente: 0, encerrados: 0, cancelados: 0 };
  for (const contrato of contratos || []) {
    const status = normalizeStatus(contrato?.status_contrato);
    if (status === 'encerrado') counters.encerrados += 1;
    if (status === 'cancelado') counters.cancelados += 1;
    if (legado[String(contrato?.id || '')]?.aplicado) counters.legadoAtivaAplicada += 1;
    if (status === 'ativo') {
      counters.ativos += 1;
      if (!legado[String(contrato?.id || '')]?.aplicado) counters.legadoAtivaPendente += 1;
      const dias = diasParaVencimento(contrato, hoje);
      if (dias === null) counters.semDataFim += 1;
      else if (dias < 0) counters.vencidos += 1;
      else {
        if (dias <= 30) counters.vencendo30 += 1;
        if (dias <= 60) counters.vencendo60 += 1;
        if (dias <= 90) counters.vencendo90 += 1;
      }
    }
  }
  return counters;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    let payload = {}; try { payload = await req.json(); } catch (_e) { payload = {}; }

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
    const criteriosAplicados = new Set();
    const warnings = [];
    let partialFailures = 0;
    let totalMilitaresEscopo = null;

    if (!targetIsAdmin && targetPerms.actions?.visualizar_contratos_designacao !== true && targetPerms.actions?.gerir_contratos_designacao !== true) {
      return Response.json({ error: 'Acesso negado: permissão funcional insuficiente.', requiredPermission: 'visualizar_contratos_designacao ou gerir_contratos_designacao' }, { status: 403 });
    }

    let contratos = [];
    let militarIdsEscopo = null;
    if (targetIsAdmin) {
      criteriosAplicados.add('admin');
      contratos = await fetchWithRetry(() => base44.asServiceRole.entities.ContratoDesignacaoMilitar.list('-data_inicio_contrato', 1000, 0), 'ContratoDesignacaoMilitar.list');
    } else {
      militarIdsEscopo = await listarMilitarIdsDoEscopo(base44, targetPerms.acessos, criteriosAplicados, warnings);
      totalMilitaresEscopo = militarIdsEscopo?.length || 0;
      if (!militarIdsEscopo || militarIdsEscopo.length === 0) warnings.push('SEM_ESCOPO');
      const result = militarIdsEscopo?.length ? await listarPorMilitarIds(base44, 'ContratoDesignacaoMilitar', militarIdsEscopo, undefined, '-data_inicio_contrato') : { rows: [], partialFailures: 0 };
      contratos = result.rows; partialFailures += result.partialFailures;
    }

    const militarIdsContratos = Array.from(new Set((contratos || []).map((c) => c?.militar_id).filter(Boolean).map(String)));
    const militaresResult = militarIdsContratos.length ? await listarPorIds(base44, 'Militar', militarIdsContratos, CAMPOS_MILITAR_RESUMO) : { rows: [], partialFailures: 0 };
    const matriculasResult = militarIdsContratos.length ? await listarPorMilitarIds(base44, 'MatriculaMilitar', militarIdsContratos, CAMPOS_MATRICULA, '-is_atual') : { rows: [], partialFailures: 0 };
    const periodosResult = militarIdsContratos.length ? await listarPorMilitarIds(base44, 'PeriodoAquisitivo', militarIdsContratos, CAMPOS_PERIODO_LEGADO, '-legado_ativa_em', { legado_ativa: true }) : { rows: [], partialFailures: 0 };
    partialFailures += militaresResult.partialFailures + matriculasResult.partialFailures + periodosResult.partialFailures;

    const contratoIds = new Set((contratos || []).map((c) => String(c?.id || '')).filter(Boolean));
    const periodosLegado = (periodosResult.rows || []).filter((p) => contratoIds.has(String(p?.legado_ativa_contrato_designacao_id || '')));
    const legadoAtivaPorContrato = montarLegado(periodosLegado, contratos || []);
    const counters = calcularCounters(contratos || [], legadoAtivaPorContrato);

    return Response.json({
      contratos: contratos || [],
      militares: militaresResult.rows || [],
      matriculasMilitar: matriculasResult.rows || [],
      legadoAtivaPorContrato,
      counters,
      meta: { isAdmin: targetIsAdmin, modoAcesso: getModoAcesso(criteriosAplicados), userEmail: authUserEmail || null, effectiveEmail: isImpersonating ? effectiveEmailNorm : null, totalMilitaresEscopo, partialFailures, warnings },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao carregar painel de contratos de designação.', meta: { status } }, { status });
  }
});
