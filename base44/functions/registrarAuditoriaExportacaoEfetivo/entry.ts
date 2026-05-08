import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const AUDIT_VERSION = '1F-C';
const CATALOG_VERSION = 'extracao-efetivo-catalogo-v1';
const REQUIRED_ACTION = 'exportar_extracao_efetivo';
const MAX_COLUMNS = 50;
const MAX_JSON_LENGTH = 12000;
const MAX_FILE_NAME_LENGTH = 180;
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const CAMPOS_USUARIO_ACESSO = [
  'id',
  'user_email',
  'ativo',
  'tipo_acesso',
  'grupamento_id',
  'subgrupamento_id',
  'militar_id',
  'perfil_id',
  'perm_exportar_extracao_efetivo',
];

const ALLOWED_COLUMNS = Object.freeze({
  posto_graduacao: 'Posto/graduação',
  nome_guerra: 'Nome de guerra',
  nome_completo: 'Nome completo',
  matricula: 'Matrícula',
  quadro: 'Quadro',
  lotacao_nome: 'Lotação',
  status_cadastro: 'Status',
  situacao_militar: 'Situação militar',
  funcao: 'Função',
  condicao: 'Condição',
});

const FILTER_KEYS = Object.freeze([
  'postoGraduacao',
  'quadro',
  'status',
  'situacaoMilitar',
  'funcao',
  'condicao',
  'lotacao',
]);

function normalizeTipo(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function toSafeInteger(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.floor(numberValue));
}

function toSafeBoolean(value: unknown) {
  return value === true;
}

function trimString(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeStringify(value: unknown, fallback: unknown) {
  const normalized = value ?? fallback;
  const json = JSON.stringify(normalized);
  if (json.length <= MAX_JSON_LENGTH) return json;
  return JSON.stringify({ truncated: true, reason: 'metadata_too_big' });
}

async function fetchWithRetry(queryFn: () => Promise<unknown>, label = 'query') {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      const status = (error as { response?: { status?: number }; status?: number })?.response?.status ||
        (error as { status?: number })?.status ||
        0;
      const isRetryable = RETRY_STATUS.has(status);
      console.warn('[registrarAuditoriaExportacaoEfetivo] retry', { label, attempt, status, isRetryable });
      if (!isRetryable || attempt === RETRY_MAX_ATTEMPTS) break;
      const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

function extrairMatrizPermissoes(descricao: unknown) {
  if (typeof descricao !== 'string' || !descricao) return {};
  const start = descricao.indexOf('[SGP_PERMISSIONS_MATRIX]');
  const end = descricao.indexOf('[/SGP_PERMISSIONS_MATRIX]');
  if (start === -1 || end === -1 || end <= start) return {};
  const jsonStr = descricao.slice(start + '[SGP_PERMISSIONS_MATRIX]'.length, end).trim();
  if (!jsonStr) return {};
  try {
    const parsed = JSON.parse(jsonStr);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function aplicarPermissoes(fonte: Record<string, unknown> | null | undefined, actions: Record<string, boolean>) {
  if (!fonte) return;
  Object.entries(fonte).forEach(([key, value]) => {
    if (typeof value !== 'boolean' || !key.startsWith('perm_')) return;
    const actionKey = key.replace(/^perm_/, '');
    if (value === true) {
      actions[actionKey] = true;
    } else if (!(actionKey in actions)) {
      actions[actionKey] = false;
    }
  });
}

function consolidarActions(perfis: Record<string, unknown>[], acessos: Record<string, unknown>[]) {
  const actions: Record<string, boolean> = {};
  (perfis || []).forEach((perfil) => {
    aplicarPermissoes(perfil, actions);
    aplicarPermissoes(extrairMatrizPermissoes(perfil?.descricao) as Record<string, unknown>, actions);
  });
  (acessos || []).forEach((acesso) => aplicarPermissoes(acesso, actions));
  return actions;
}

function descreverEscopoSeguro(acessos: Record<string, unknown>[], isAdmin: boolean) {
  if (isAdmin) return { tipo: 'admin', total_vinculos: acessos.length };
  const tipos = [...new Set((acessos || []).map((acesso) => normalizeTipo(acesso?.tipo_acesso)).filter(Boolean))];
  return { tipo: tipos[0] || 'vazio', total_vinculos: acessos.length, possui_multiplos_tipos: tipos.length > 1 };
}

function sanitizeColumns(columnsInput: unknown) {
  if (!Array.isArray(columnsInput) || columnsInput.length === 0 || columnsInput.length > MAX_COLUMNS) {
    throw new Error('Colunas exportadas inválidas.');
  }

  const seen = new Set<string>();
  return columnsInput.map((column) => {
    const id = trimString((column as { id?: unknown; key?: unknown })?.id || (column as { key?: unknown })?.key, 80);
    if (!id || seen.has(id) || !(id in ALLOWED_COLUMNS)) {
      throw new Error('Coluna não permitida na exportação.');
    }
    seen.add(id);
    return { id, label: ALLOWED_COLUMNS[id as keyof typeof ALLOWED_COLUMNS] };
  });
}

function sanitizeFilters(filtersInput: Record<string, unknown> | null | undefined) {
  const filters = filtersInput || {};
  const searchLength = toSafeInteger(filters.search_tamanho, 0);
  const tipos_filtros_usados = FILTER_KEYS.filter((key) => Boolean(filters?.[key]));
  const filtros_estruturais = FILTER_KEYS.reduce<Record<string, boolean>>((acc, key) => {
    acc[key] = Boolean(filters?.[key]);
    return acc;
  }, {});

  return {
    search_aplicado: Boolean(filters.search_aplicado),
    ...(searchLength > 0 ? { search_tamanho: searchLength } : {}),
    tipos_filtros_usados,
    filtros_estruturais,
  };
}

function sanitizeMeta(metaInput: Record<string, unknown> | null | undefined, tipoExportacao: string, loaded: number, exported: number) {
  const meta = metaInput || {};
  return {
    hasMore: toSafeBoolean(meta.hasMore),
    limit: toSafeInteger(meta.limit, 0),
    offset: toSafeInteger(meta.offset, 0),
    returned: toSafeInteger(meta.returned, loaded),
    tipo_exportacao: tipoExportacao,
    busca_limitada_por_amostra: toSafeBoolean(meta.busca_limitada_por_amostra || meta.buscaLimitadaPorAmostra),
    quantidade_carregada: loaded,
    quantidade_exportada: exported,
    escopo_resumido: typeof meta.escopo_resumido === 'object' && meta.escopo_resumido !== null ? meta.escopo_resumido : undefined,
  };
}

function sanitizePayload(payload: Record<string, unknown> | null | undefined) {
  const input = payload || {};
  const tipoExportacao = input.tipo_exportacao === 'completo' ? 'completo' : 'parcial';
  const quantidadeCarregada = toSafeInteger(input.quantidade_carregada, 0);
  const quantidadeExportada = toSafeInteger(input.quantidade_exportada, 0);

  if (quantidadeExportada <= 0 || quantidadeCarregada <= 0 || quantidadeExportada > quantidadeCarregada) {
    throw new Error('Quantidades exportadas inválidas.');
  }

  const colunas = sanitizeColumns(input.colunas_exportadas);
  const filtros = sanitizeFilters(input.filtros_sanitizados as Record<string, unknown> | null | undefined);
  const consultaMeta = sanitizeMeta(
    input.consulta_meta as Record<string, unknown> | null | undefined,
    tipoExportacao,
    quantidadeCarregada,
    quantidadeExportada,
  );

  return {
    tipoExportacao,
    quantidadeCarregada,
    quantidadeExportada,
    colunas,
    filtros,
    consultaMeta,
    nomeArquivo: trimString(input.nome_arquivo, MAX_FILE_NAME_LENGTH),
  };
}

async function resolverUsuarioEfetivo(base44: ReturnType<typeof createClientFromRequest>, authUser: Record<string, unknown>, payload: Record<string, unknown>) {
  const authUserEmail = normalizeEmail(authUser.email);
  const effectiveEmailNorm = normalizeEmail(payload?.effectiveEmail);
  const wantsImpersonation = Boolean(effectiveEmailNorm) && effectiveEmailNorm !== authUserEmail;

  const acessosAuth = await fetchWithRetry(
    () => base44.asServiceRole.entities.UsuarioAcesso.filter(
      { user_email: authUser.email, ativo: true },
      undefined,
      100,
      0,
      CAMPOS_USUARIO_ACESSO,
    ),
    'usuarioAcesso.auth',
  ) as Record<string, unknown>[];

  const authIsAdminByRole = String(authUser.role || '').toLowerCase() === 'admin';
  const authIsAdminByAccess = (acessosAuth || []).some((acesso) => normalizeTipo(acesso.tipo_acesso) === 'admin');
  const authIsAdmin = authIsAdminByRole || authIsAdminByAccess;

  if (wantsImpersonation && !authIsAdmin) {
    return { blocked: true, reason: 'IMPERSONATION_FORBIDDEN', authUserEmail, effectiveResolvedEmail: authUserEmail, isImpersonating: false, acessos: [] as Record<string, unknown>[], perfis: [] as Record<string, unknown>[], isAdmin: false };
  }

  const isImpersonating = wantsImpersonation && authIsAdmin;
  const effectiveResolvedEmail = isImpersonating ? effectiveEmailNorm : authUserEmail;
  const acessos = isImpersonating
    ? await fetchWithRetry(
      () => base44.asServiceRole.entities.UsuarioAcesso.filter(
        { user_email: effectiveResolvedEmail, ativo: true },
        undefined,
        100,
        0,
        CAMPOS_USUARIO_ACESSO,
      ),
      'usuarioAcesso.effective',
    ) as Record<string, unknown>[]
    : acessosAuth;

  const perfilIds = Array.from(new Set((acessos || []).map((acesso) => acesso?.perfil_id).filter(Boolean)));
  const perfis = perfilIds.length > 0
    ? await fetchWithRetry(
      () => base44.asServiceRole.entities.PerfilPermissao.filter({ id: { $in: perfilIds }, ativo: true }),
      'perfilPermissao.in',
    ) as Record<string, unknown>[]
    : [];

  const isAdminByRole = isImpersonating ? false : authIsAdminByRole;
  const isAdminByAccess = (acessos || []).some((acesso) => normalizeTipo(acesso.tipo_acesso) === 'admin');
  const isAdmin = isAdminByRole || isAdminByAccess;

  return { blocked: false, reason: null, authUserEmail, effectiveResolvedEmail, isImpersonating, acessos, perfis, isAdmin };
}

async function criarLog(base44: ReturnType<typeof createClientFromRequest>, data: Record<string, unknown>) {
  return await fetchWithRetry(
    () => base44.asServiceRole.entities.ExtracaoEfetivoExportLog.create(data),
    'extracaoEfetivoExportLog.create',
  ) as Record<string, unknown>;
}

Deno.serve(async (req) => {
  let base44: ReturnType<typeof createClientFromRequest> | null = null;

  try {
    base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) {
      return Response.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch (_error) {
      payload = {};
    }

    const usuario = await resolverUsuarioEfetivo(base44, authUser as Record<string, unknown>, payload);
    const sanitized = sanitizePayload(payload);
    const actions = consolidarActions(usuario.perfis, usuario.acessos);
    const hasPermission = usuario.isAdmin || actions[REQUIRED_ACTION] === true;
    const commonLog = {
      acao: REQUIRED_ACTION,
      usuario_real_email: usuario.authUserEmail,
      usuario_efetivo_email: usuario.effectiveResolvedEmail,
      is_impersonating: usuario.isImpersonating,
      data_hora: new Date().toISOString(),
      tipo_exportacao: sanitized.tipoExportacao,
      quantidade_carregada: sanitized.quantidadeCarregada,
      quantidade_exportada: sanitized.quantidadeExportada,
      colunas_exportadas_json: safeStringify(sanitized.colunas, []),
      filtros_sanitizados_json: safeStringify(sanitized.filtros, {}),
      consulta_meta_json: safeStringify({
        ...sanitized.consultaMeta,
        escopo_resumido: descreverEscopoSeguro(usuario.acessos, usuario.isAdmin),
      }, {}),
      nome_arquivo: sanitized.nomeArquivo,
      versao: AUDIT_VERSION,
      catalogo_version: CATALOG_VERSION,
    };

    if (usuario.blocked || !hasPermission) {
      await criarLog(base44, { ...commonLog, status_exportacao: 'bloqueada' });
      return Response.json({ ok: false, error: 'Exportação não autorizada.' }, { status: 403 });
    }

    const auditLog = await criarLog(base44, { ...commonLog, status_exportacao: 'registrada' });
    return Response.json({ ok: true, auditLogId: auditLog?.id || null });
  } catch (error) {
    console.error('[registrarAuditoriaExportacaoEfetivo] erro pre-exportacao', {
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { ok: false, error: 'Exportação bloqueada porque não foi possível registrar auditoria.' },
      { status: 400 },
    );
  }
});
