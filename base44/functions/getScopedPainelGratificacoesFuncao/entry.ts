import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const LIMIT_USUARIO_ACESSO = 1000;
const PAGE_SIZE = 1000;
const MAX_SCAN_ROWS = 10000;
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;
const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id', 'perfil_id'];
const CAMPOS_MILITAR_ID = ['id'];
const CAMPOS_TIPO = ['id', 'nome', 'sigla', 'codigo', 'descricao', 'nivel', 'ativo'];
const STATUS_ATIVO = 'nomeado_ativo';
const COTA_ATIVA = 'ativa';
const STATUS_SOLICITACOES = new Set(['solicitado_dp', 'aguardando_publicacao_nomeacao']);
const STATUS_DISPENSAS = new Set(['dispensa_solicitada', 'aguardando_publicacao_dispensa']);
const TAB_STATUS = {
  ativos: new Set(['nomeado_ativo']),
  aguardando_publicacao: new Set(['solicitado_dp', 'aguardando_publicacao_nomeacao']),
  dispensa_em_andamento: new Set(['dispensa_solicitada', 'aguardando_publicacao_dispensa']),
  historico: new Set(['dispensado', 'cancelado']),
};
const FILTROS_PERMITIDOS = new Set([
  'tab', 'status', 'tipo_gratificacao_funcao_id', 'tipo_gratificacao', 'funcao_gratificada', 'codigo_funcao', 'unidade_id', 'setor_id', 'cota_gratificacao_funcao_id', 'busca',
  'data_solicitacao_de', 'data_solicitacao_ate', 'data_publicacao_nomeacao_de', 'data_publicacao_nomeacao_ate', 'data_inicio_efeitos_de', 'data_inicio_efeitos_ate',
  'data_solicitacao_dispensa_de', 'data_solicitacao_dispensa_ate', 'data_publicacao_dispensa_de', 'data_publicacao_dispensa_ate', 'data_fim_efeitos_de', 'data_fim_efeitos_ate',
]);
const CAMPOS_BUSCA_GRATIFICACAO = ['nome_completo_snapshot', 'nome_guerra_snapshot', 'matricula_snapshot', 'funcao_gratificada', 'codigo_funcao', 'tipo_gratificacao', 'numero_processo', 'documento_solicitacao', 'doems_nomeacao_numero', 'doems_nomeacao_edicao', 'ato_nomeacao_numero', 'documento_solicitacao_dispensa', 'doems_dispensa_numero', 'doems_dispensa_edicao', 'ato_dispensa_numero'];
const CAMPOS_BUSCA_COTA = ['funcao_gratificada', 'codigo_funcao', 'tipo_gratificacao', 'unidade_nome_snapshot', 'setor_nome_snapshot', 'ato_autorizativo', 'doems_autorizacao_numero', 'doems_autorizacao_edicao'];

const normalizeTipo = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeId = (value: unknown) => String(value || '').trim();
const normalizeStatus = (value: unknown) => String(value || '').trim().toLowerCase();
const toNumber = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const removerAcentosLower = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

async function fetchWithRetry(queryFn: () => Promise<any>, label = 'query') {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt += 1) {
    try { return await queryFn(); } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      if (!RETRY_STATUS.has(status) || attempt === RETRY_MAX_ATTEMPTS) break;
      const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      console.warn(`[gratificacaoFuncaoScoped] retry step=${label} attempt=${attempt} status=${status}`);
    }
  }
  throw lastError;
}

function extrairMatrizPermissoes(descricao: unknown) {
  if (typeof descricao !== 'string' || !descricao) return {};
  const start = descricao.indexOf('[SGP_PERMISSIONS_MATRIX]');
  const end = descricao.indexOf('[/SGP_PERMISSIONS_MATRIX]');
  if (start === -1 || end === -1 || end <= start) return {};
  try {
    const parsed = JSON.parse(descricao.slice(start + '[SGP_PERMISSIONS_MATRIX]'.length, end).trim());
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) { return {}; }
}

function consolidarActions(perfis: any[], acessos: any[]) {
  const actions: Record<string, boolean> = {};
  const aplicarFonte = (fonte: any) => {
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

async function resolverPermissoes(base44: ReturnType<typeof createClientFromRequest>, email: string) {
  const emailNorm = normalizeEmail(email);
  const acessos = await fetchWithRetry(
    () => base44.asServiceRole.entities.UsuarioAcesso.filter({ user_email: emailNorm, ativo: true }, undefined, LIMIT_USUARIO_ACESSO, 0, CAMPOS_USUARIO_ACESSO),
    `UsuarioAcesso:${emailNorm}`,
  );
  const perfilIds = Array.from(new Set((acessos || []).map((acesso: any) => acesso?.perfil_id).filter(Boolean)));
  let perfis: any[] = [];
  if (perfilIds.length > 0) {
    perfis = await fetchWithRetry(() => base44.asServiceRole.entities.PerfilPermissao.filter({ id: { $in: perfilIds }, ativo: true }), `PerfilPermissao:${emailNorm}`);
  }
  return {
    acessos: acessos || [],
    perfis: perfis || [],
    actions: consolidarActions(perfis || [], acessos || []),
    isAdminByAccess: (acessos || []).some((a: any) => normalizeTipo(a?.tipo_acesso) === 'admin'),
  };
}

function normalizarPaginacao(payload: any = {}) {
  const rawLimit = Number(payload?.limit);
  const rawOffset = Number(payload?.offset);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT);
  const offset = Math.max(Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0, 0);
  return { limit, offset };
}

function normalizarFiltros(payload: any = {}, warnings: string[] = []) {
  const source = payload?.filters && typeof payload.filters === 'object' ? payload.filters : payload;
  const filtros: Record<string, string> = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    if (['limit', 'offset', 'effectiveEmail'].includes(key)) return;
    if (!FILTROS_PERMITIDOS.has(key)) { if (value !== undefined && value !== null && value !== '') warnings.push(`FILTRO_IGNORADO_${key}`); return; }
    const text = String(value ?? '').trim();
    if (!text || text === 'todos') return;
    filtros[key] = key === 'busca' ? removerAcentosLower(text).slice(0, 80) : text.slice(0, 120);
  });
  return filtros;
}

async function listarTodos(base44: ReturnType<typeof createClientFromRequest>, entityName: string, order = '-updated_date', fields?: string[], hardLimit = MAX_SCAN_ROWS) {
  const rows: any[] = [];
  for (let offset = 0; offset < hardLimit; offset += PAGE_SIZE) {
    const limit = Math.min(PAGE_SIZE, hardLimit - offset);
    const lote = await fetchWithRetry(() => base44.asServiceRole.entities[entityName].list(order, limit, offset, fields), `${entityName}.list:${offset}`);
    const arr = Array.isArray(lote) ? lote : [];
    rows.push(...arr);
    if (arr.length < limit) break;
  }
  return rows;
}

function sanitizerGratificacao(item: any = {}) {
  return {
    id: item.id,
    militar_id: item.militar_id || '',
    nome_completo_snapshot: item.nome_completo_snapshot || item?.militar_snapshot?.nome_completo || '',
    nome_guerra_snapshot: item.nome_guerra_snapshot || item?.militar_snapshot?.nome_guerra || '',
    posto_graduacao_snapshot: item.posto_graduacao_snapshot || item?.militar_snapshot?.posto_graduacao || '',
    quadro_snapshot: item.quadro_snapshot || item?.militar_snapshot?.quadro || '',
    matricula_snapshot: item.matricula_snapshot || item?.militar_snapshot?.matricula || '',
    unidade_id: item.unidade_id || '', unidade_nome_snapshot: item.unidade_nome_snapshot || '', setor_id: item.setor_id || '', setor_nome_snapshot: item.setor_nome_snapshot || '',
    tipo_gratificacao_funcao_id: item.tipo_gratificacao_funcao_id || '', cota_gratificacao_funcao_id: item.cota_gratificacao_funcao_id || '',
    funcao_gratificada: item.funcao_gratificada || '', codigo_funcao: item.codigo_funcao || '', nivel_gratificacao: item.nivel_gratificacao || '', tipo_gratificacao: item.tipo_gratificacao || '',
    status: item.status || '', data_solicitacao: item.data_solicitacao || '', documento_solicitacao: item.documento_solicitacao || '', numero_processo: item.numero_processo || '',
    data_publicacao_nomeacao: item.data_publicacao_nomeacao || '', doems_nomeacao_numero: item.doems_nomeacao_numero || '', doems_nomeacao_edicao: item.doems_nomeacao_edicao || '', ato_nomeacao_numero: item.ato_nomeacao_numero || '',
    data_inicio_efeitos: item.data_inicio_efeitos || '', data_solicitacao_dispensa: item.data_solicitacao_dispensa || '', documento_solicitacao_dispensa: item.documento_solicitacao_dispensa || '',
    data_publicacao_dispensa: item.data_publicacao_dispensa || '', doems_dispensa_numero: item.doems_dispensa_numero || '', doems_dispensa_edicao: item.doems_dispensa_edicao || '', ato_dispensa_numero: item.ato_dispensa_numero || '', data_fim_efeitos: item.data_fim_efeitos || '',
    created_date: item.created_date || '', updated_date: item.updated_date || '',
  };
}

function sanitizerCota(cota: any = {}, ocupadas = 0) {
  const autorizadas = toNumber(cota.quantidade_autorizada);
  return {
    id: cota.id,
    funcao_gratificada: cota.funcao_gratificada || '', codigo_funcao: cota.codigo_funcao || '', nivel_gratificacao: cota.nivel_gratificacao || '', tipo_gratificacao: cota.tipo_gratificacao || '', tipo_gratificacao_funcao_id: cota.tipo_gratificacao_funcao_id || '',
    unidade_id: cota.unidade_id || '', unidade_nome_snapshot: cota.unidade_nome_snapshot || '', setor_id: cota.setor_id || '', setor_nome_snapshot: cota.setor_nome_snapshot || '',
    quantidade_autorizada: autorizadas, ocupadas, disponiveis: Math.max(autorizadas - ocupadas, 0), excedentes: Math.max(ocupadas - autorizadas, 0),
    data_inicio_vigencia: cota.data_inicio_vigencia || '', data_fim_vigencia: cota.data_fim_vigencia || '', ato_autorizativo: cota.ato_autorizativo || '', doems_autorizacao_numero: cota.doems_autorizacao_numero || '', doems_autorizacao_edicao: cota.doems_autorizacao_edicao || '', status: cota.status || '',
    created_date: cota.created_date || '', updated_date: cota.updated_date || '',
  };
}

function sanitizerTipo(tipo: any = {}) {
  return { id: tipo.id, nome: tipo.nome || '', sigla: tipo.sigla || '', codigo: tipo.codigo || '', descricao: tipo.descricao || '', nivel: tipo.nivel || '', ativo: tipo.ativo !== false };
}

async function resolverEscopo(base44: ReturnType<typeof createClientFromRequest>, acessos: any[], warnings: string[]) {
  const criteriosAplicados = new Set<string>();
  const militarIds = new Set<string>();
  const estruturaIds = new Set<string>();
  let hasOnlyProprio = true;

  for (const acesso of acessos || []) {
    const tipo = normalizeTipo(acesso?.tipo_acesso);
    if (tipo === 'admin') return { isAdminScope: true, criteriosAplicados: new Set(['admin']), militarIds: null, estruturaIds: null, hasOnlyProprio: false };
    if (tipo === 'proprio') {
      if (acesso?.militar_id) { militarIds.add(String(acesso.militar_id)); criteriosAplicados.add('proprio'); }
      continue;
    }
    hasOnlyProprio = false;
    const grupamentoId = normalizeId(acesso?.grupamento_id);
    const subgrupamentoId = normalizeId(acesso?.subgrupamento_id);
    const filtros: any[] = [];
    if (tipo === 'setor' && grupamentoId) {
      criteriosAplicados.add('setor'); estruturaIds.add(grupamentoId);
      filtros.push({ grupamento_raiz_id: grupamentoId }, { grupamento_id: grupamentoId }, { estrutura_id: grupamentoId });
    } else if ((tipo === 'subsetor' || tipo === 'unidade') && subgrupamentoId) {
      criteriosAplicados.add(tipo); estruturaIds.add(subgrupamentoId);
      filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
      if (tipo === 'subsetor') {
        try {
          const filhos = await fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }), `Subgrupamento.parent:${subgrupamentoId}`);
          for (const filho of filhos || []) if (filho?.id) { estruturaIds.add(String(filho.id)); filtros.push({ estrutura_id: filho.id }, { subgrupamento_id: filho.id }); }
        } catch (_error) { warnings.push('FALHA_LISTAR_SUBSETORES_FILHOS'); }
      }
    }
    for (const filtro of filtros) {
      try {
        const militares = await fetchWithRetry(() => base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, CAMPOS_MILITAR_ID), `Militar.escopo:${JSON.stringify(filtro)}`);
        for (const militar of militares || []) if (militar?.id) militarIds.add(String(militar.id));
      } catch (_error) { warnings.push('FALHA_FILTRO_ESCOPO_MILITARES'); }
    }
  }
  if (!criteriosAplicados.size) warnings.push('SEM_ESCOPO');
  return { isAdminScope: false, criteriosAplicados, militarIds, estruturaIds, hasOnlyProprio };
}

function modoAcesso(criteriosAplicados: Set<string>) {
  if (criteriosAplicados.size === 1) return Array.from(criteriosAplicados)[0];
  if (criteriosAplicados.size > 1) return 'misto';
  return 'sem_escopo';
}

function dentroEscopoGratificacao(item: any, escopo: any) {
  if (escopo.isAdminScope) return true;
  if (escopo.hasOnlyProprio) return escopo.militarIds?.has(String(item?.militar_id || ''));
  return escopo.militarIds?.has(String(item?.militar_id || '')) || escopo.estruturaIds?.has(String(item?.unidade_id || '')) || escopo.estruturaIds?.has(String(item?.setor_id || ''));
}

function dentroEscopoCota(item: any, escopo: any) {
  if (escopo.isAdminScope) return true;
  return escopo.estruturaIds?.has(String(item?.unidade_id || '')) || escopo.estruturaIds?.has(String(item?.setor_id || ''));
}

function passaFiltrosGratificacao(item: any, filtros: Record<string, string>) {
  const status = normalizeStatus(item?.status);
  const tab = filtros.tab;
  if (tab && TAB_STATUS[tab] && !TAB_STATUS[tab].has(status)) return false;
  if (filtros.status && status !== filtros.status) return false;
  for (const campo of ['tipo_gratificacao_funcao_id', 'tipo_gratificacao', 'funcao_gratificada', 'codigo_funcao', 'unidade_id', 'setor_id', 'cota_gratificacao_funcao_id']) {
    if (filtros[campo] && removerAcentosLower(item?.[campo]) !== removerAcentosLower(filtros[campo])) return false;
  }
  const ranges = [
    ['data_solicitacao', 'data_solicitacao_de', 'data_solicitacao_ate'], ['data_publicacao_nomeacao', 'data_publicacao_nomeacao_de', 'data_publicacao_nomeacao_ate'], ['data_inicio_efeitos', 'data_inicio_efeitos_de', 'data_inicio_efeitos_ate'],
    ['data_solicitacao_dispensa', 'data_solicitacao_dispensa_de', 'data_solicitacao_dispensa_ate'], ['data_publicacao_dispensa', 'data_publicacao_dispensa_de', 'data_publicacao_dispensa_ate'], ['data_fim_efeitos', 'data_fim_efeitos_de', 'data_fim_efeitos_ate'],
  ];
  for (const [field, de, ate] of ranges) {
    const value = String(item?.[field] || '').slice(0, 10);
    if (filtros[de] && (!value || value < filtros[de])) return false;
    if (filtros[ate] && (!value || value > filtros[ate])) return false;
  }
  if (filtros.busca) return CAMPOS_BUSCA_GRATIFICACAO.some((campo) => removerAcentosLower(item?.[campo]).includes(filtros.busca));
  return true;
}

function passaFiltrosCota(item: any, filtros: Record<string, string>) {
  for (const campo of ['tipo_gratificacao_funcao_id', 'tipo_gratificacao', 'funcao_gratificada', 'codigo_funcao', 'unidade_id', 'setor_id']) {
    if (filtros[campo] && removerAcentosLower(item?.[campo]) !== removerAcentosLower(filtros[campo])) return false;
  }
  if (filtros.busca) return CAMPOS_BUSCA_COTA.some((campo) => removerAcentosLower(item?.[campo]).includes(filtros.busca));
  return true;
}

function calcularCounters(gratificacoes: any[], cotas: any[]) {
  const cotasAutorizadas = (cotas || []).filter((cota) => normalizeStatus(cota?.status || COTA_ATIVA) === COTA_ATIVA).reduce((total, cota) => total + toNumber(cota?.quantidade_autorizada), 0);
  const cotasOcupadas = (gratificacoes || []).filter((item) => normalizeStatus(item?.status) === STATUS_ATIVO).length;
  const solicitacoesPendentes = (gratificacoes || []).filter((item) => STATUS_SOLICITACOES.has(normalizeStatus(item?.status))).length;
  const dispensasPendentes = (gratificacoes || []).filter((item) => STATUS_DISPENSAS.has(normalizeStatus(item?.status))).length;
  return { cotasAutorizadas, cotasOcupadas, cotasDisponiveis: Math.max(cotasAutorizadas - cotasOcupadas, 0), cotasExcedentes: Math.max(cotasOcupadas - cotasAutorizadas, 0), solicitacoesPendentes, nomeacoesAtivas: cotasOcupadas, dispensasPendentes };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload: any = {};
    try { payload = await req.json(); } catch (_error) { payload = {}; }
    const warnings: string[] = [];
    const { limit, offset } = normalizarPaginacao(payload);
    const filtros = normalizarFiltros(payload, warnings);

    const authUserEmail = normalizeEmail(authUser.email);
    const effectiveEmailNorm = normalizeEmail(payload?.effectiveEmail);
    const wantsImpersonation = Boolean(effectiveEmailNorm) && effectiveEmailNorm !== authUserEmail;
    const authPerms = await resolverPermissoes(base44, authUser.email);
    const authIsAdmin = String(authUser.role || '').toLowerCase() === 'admin' || authPerms.isAdminByAccess;
    if (wantsImpersonation && !authIsAdmin) {
      return Response.json({ error: 'Ação não permitida: somente administradores podem usar effectiveEmail.' }, { status: 403 });
    }

    const isImpersonating = wantsImpersonation && authIsAdmin;
    const targetEmail = isImpersonating ? effectiveEmailNorm : authUser.email;
    const targetPerms = isImpersonating ? await resolverPermissoes(base44, targetEmail) : authPerms;
    const targetIsAdmin = isImpersonating ? targetPerms.isAdminByAccess : authIsAdmin;
    if (!targetIsAdmin && !(targetPerms.acessos || []).length) {
      return Response.json({ error: 'Acesso negado: usuário sem acesso ativo.' }, { status: 403 });
    }

    const escopo = targetIsAdmin
      ? { isAdminScope: true, criteriosAplicados: new Set<string>(['admin']), militarIds: null, estruturaIds: null, hasOnlyProprio: false }
      : await resolverEscopo(base44, targetPerms.acessos, warnings);

    const [gratificacoesRaw, cotasRaw, tiposRaw] = await Promise.all([
      listarTodos(base44, 'GratificacaoFuncao', '-updated_date'),
      listarTodos(base44, 'CotaGratificacaoFuncao', '-updated_date'),
      listarTodos(base44, 'TipoGratificacaoFuncao', 'nome', CAMPOS_TIPO, 2000),
    ]);

    const gratificacoesEscopo = (gratificacoesRaw || []).filter((item) => dentroEscopoGratificacao(item, escopo));
    const cotasEscopo = escopo.hasOnlyProprio ? [] : (cotasRaw || []).filter((cota) => dentroEscopoCota(cota, escopo));
    if (escopo.hasOnlyProprio) warnings.push('COTAS_ADMINISTRATIVAS_OCULTADAS_PARA_ACESSO_PROPRIO');

    const gratificacoesFiltradas = gratificacoesEscopo.filter((item) => passaFiltrosGratificacao(item, filtros));
    const cotasFiltradas = cotasEscopo.filter((cota) => passaFiltrosCota(cota, filtros));
    const counters = calcularCounters(gratificacoesFiltradas, cotasFiltradas);

    const pagina = gratificacoesFiltradas.slice(offset, offset + limit + 1);
    const hasNext = pagina.length > limit;
    const gratificacoes = (hasNext ? pagina.slice(0, limit) : pagina).map(sanitizerGratificacao);

    const cotasResumo = cotasFiltradas.map((cota) => ({
      id: cota.id,
      funcao_gratificada: cota.funcao_gratificada || '',
      codigo_funcao: cota.codigo_funcao || '',
      tipo_gratificacao_funcao_id: cota.tipo_gratificacao_funcao_id || '',
      tipo_gratificacao: cota.tipo_gratificacao || '',
      unidade_id: cota.unidade_id || '',
      unidade_nome_snapshot: cota.unidade_nome_snapshot || '',
      setor_id: cota.setor_id || '',
      setor_nome_snapshot: cota.setor_nome_snapshot || '',
      quantidade_autorizada: toNumber(cota.quantidade_autorizada),
      status: cota.status || '',
    })).slice(0, 500);

    return Response.json({
      gratificacoes,
      counters,
      tipos: (tiposRaw || []).map(sanitizerTipo),
      cotasResumo,
      facets: {
        funcoes: Array.from(new Set([...(gratificacoesFiltradas || []), ...(cotasFiltradas || [])].map((item) => item?.funcao_gratificada).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR')),
        unidades: Array.from(new Map([...(gratificacoesFiltradas || []), ...(cotasFiltradas || [])].map((item) => [String(item?.unidade_id || item?.setor_id || item?.unidade_nome_snapshot || item?.setor_nome_snapshot || ''), item?.unidade_nome_snapshot || item?.setor_nome_snapshot || '']).filter(([id, label]) => id && label)).entries()).map(([value, label]) => ({ value, label })),
      },
      meta: {
        isAdmin: targetIsAdmin,
        modoAcesso: modoAcesso(escopo.criteriosAplicados),
        scopedFunction: true,
        readOnly: true,
        userEmail: authUserEmail || null,
        effectiveEmail: isImpersonating ? effectiveEmailNorm : null,
        warnings,
        limit,
        offset,
        hasNext,
        returned: gratificacoes.length,
      },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao carregar painel escopado de Gratificação de Função.', meta: { status } }, { status });
  }
});
