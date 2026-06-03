import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 400;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const LIMIT_USUARIO_ACESSO = 1000;
const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'perfil_id'];
const REQUIRED_ACTION = 'gerir_cotas_gratificacao_funcao';
const OPERACOES = new Set(['criar_tipo', 'atualizar_tipo', 'criar_cota', 'atualizar_cota']);
const COTA_STATUS = new Set(['ativa', 'suspensa', 'encerrada']);
const TIPO_FIELDS = ['nome', 'sigla', 'codigo', 'nivel', 'descricao', 'ativo', 'observacoes'];
const COTA_FIELDS = [
  'tipo_gratificacao_funcao_id', 'funcao_gratificada', 'codigo_funcao', 'nivel_gratificacao', 'tipo_gratificacao',
  'unidade_id', 'unidade_nome_snapshot', 'setor_id', 'setor_nome_snapshot', 'quantidade_autorizada',
  'data_inicio_vigencia', 'data_fim_vigencia', 'ato_autorizativo', 'doems_autorizacao_numero',
  'doems_autorizacao_edicao', 'doems_autorizacao_link', 'status', 'observacoes',
];
const COTA_ENCERRADA_META_FIELDS = new Set(['observacoes', 'ato_autorizativo', 'doems_autorizacao_numero', 'doems_autorizacao_edicao', 'doems_autorizacao_link']);

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeTipo = (value: unknown) => String(value || '').trim().toLowerCase();
const trimString = (value: unknown) => String(value ?? '').trim();

async function fetchWithRetry(queryFn: () => Promise<any>, label = 'query') {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt += 1) {
    try { return await queryFn(); } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      if (!RETRY_STATUS.has(status) || attempt === RETRY_MAX_ATTEMPTS) break;
      const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      console.warn(`[gerirCadastrosGratificacaoFuncao] retry step=${label} attempt=${attempt} status=${status}`);
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
    actions: consolidarActions(perfis || [], acessos || []),
    isAdminByAccess: (acessos || []).some((a: any) => normalizeTipo(a?.tipo_acesso) === 'admin'),
  };
}

function sanitizeTipo(input: any = {}) {
  const out: Record<string, any> = {};
  for (const field of TIPO_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    out[field] = field === 'ativo' ? input[field] !== false : trimString(input[field]);
  }
  if (!Object.prototype.hasOwnProperty.call(out, 'ativo')) out.ativo = true;
  if (!trimString(out.nome)) {
    const error = new Error('nome do tipo é obrigatório.');
    error['status'] = 400;
    throw error;
  }
  return out;
}

function sanitizeCota(input: any = {}, allowedFields = new Set(COTA_FIELDS)) {
  const out: Record<string, any> = {};
  for (const field of COTA_FIELDS) {
    if (!allowedFields.has(field) || !Object.prototype.hasOwnProperty.call(input, field)) continue;
    if (field === 'quantidade_autorizada') {
      const parsed = Number(input[field]);
      out[field] = Number.isFinite(parsed) ? Math.floor(parsed) : 0;
    } else if (field === 'status') {
      out[field] = normalizeTipo(input[field]);
    } else {
      out[field] = trimString(input[field]);
    }
  }
  const funcao = Object.prototype.hasOwnProperty.call(out, 'funcao_gratificada') ? out.funcao_gratificada : input.funcao_gratificada;
  const status = Object.prototype.hasOwnProperty.call(out, 'status') ? out.status : input.status;
  const quantidade = Object.prototype.hasOwnProperty.call(out, 'quantidade_autorizada') ? out.quantidade_autorizada : input.quantidade_autorizada;
  if (!trimString(funcao)) {
    const error = new Error('funcao_gratificada é obrigatória na cota.');
    error['status'] = 400;
    throw error;
  }
  if (!COTA_STATUS.has(normalizeTipo(status))) {
    const error = new Error('status da cota é obrigatório e deve ser ativa, suspensa ou encerrada.');
    error['status'] = 400;
    throw error;
  }
  if (!(Number(quantidade) > 0)) {
    const error = new Error('quantidade_autorizada deve ser número positivo.');
    error['status'] = 400;
    throw error;
  }
  return out;
}

function sanitizeTipoResponse(tipo: any = {}) {
  return { id: tipo.id, nome: tipo.nome || '', sigla: tipo.sigla || '', codigo: tipo.codigo || '', nivel: tipo.nivel || '', descricao: tipo.descricao || '', ativo: tipo.ativo !== false, observacoes: tipo.observacoes || '', created_date: tipo.created_date || '', updated_date: tipo.updated_date || '' };
}

function sanitizeCotaResponse(cota: any = {}) {
  return {
    id: cota.id, tipo_gratificacao_funcao_id: cota.tipo_gratificacao_funcao_id || '', funcao_gratificada: cota.funcao_gratificada || '', codigo_funcao: cota.codigo_funcao || '', nivel_gratificacao: cota.nivel_gratificacao || '', tipo_gratificacao: cota.tipo_gratificacao || '',
    unidade_id: cota.unidade_id || '', unidade_nome_snapshot: cota.unidade_nome_snapshot || '', setor_id: cota.setor_id || '', setor_nome_snapshot: cota.setor_nome_snapshot || '', quantidade_autorizada: Number(cota.quantidade_autorizada) || 0,
    data_inicio_vigencia: cota.data_inicio_vigencia || '', data_fim_vigencia: cota.data_fim_vigencia || '', ato_autorizativo: cota.ato_autorizativo || '', doems_autorizacao_numero: cota.doems_autorizacao_numero || '', doems_autorizacao_edicao: cota.doems_autorizacao_edicao || '', doems_autorizacao_link: cota.doems_autorizacao_link || '', status: cota.status || '', observacoes: cota.observacoes || '', created_date: cota.created_date || '', updated_date: cota.updated_date || '',
  };
}


async function validarTipoAtivoParaCota(base44: ReturnType<typeof createClientFromRequest>, tipoId: string) {
  const id = trimString(tipoId);
  if (!id) return;
  const registros = await fetchWithRetry(() => base44.asServiceRole.entities.TipoGratificacaoFuncao.filter({ id }, undefined, 1, 0, ['id', 'ativo']), `TipoGratificacaoFuncao.validarAtivo:${id}`);
  const tipo = (registros || [])[0];
  if (!tipo || tipo.ativo === false) {
    const error = new Error('tipo_gratificacao_funcao_id deve referenciar tipo ativo para cota.');
    error['status'] = 400;
    throw error;
  }
}

async function buscarRegistro(base44: ReturnType<typeof createClientFromRequest>, entityName: string, id: string) {
  if (!id) {
    const error = new Error('id é obrigatório para atualização.');
    error['status'] = 400;
    throw error;
  }
  const registros = await fetchWithRetry(() => base44.asServiceRole.entities[entityName].filter({ id }, undefined, 1, 0), `${entityName}.get:${id}`);
  const registro = (registros || [])[0];
  if (!registro) {
    const error = new Error(`${entityName} não encontrado.`);
    error['status'] = 404;
    throw error;
  }
  return registro;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload: any = {};
    try { payload = await req.json(); } catch (_error) { payload = {}; }
    const operacao = String(payload?.operacao || '').trim();
    if (!OPERACOES.has(operacao)) return Response.json({ error: 'Operação não permitida.' }, { status: 400 });

    const authPerms = await resolverPermissoes(base44, authUser.email);
    const authIsAdmin = String(authUser.role || '').toLowerCase() === 'admin' || authPerms.isAdminByAccess;
    const canManage = authIsAdmin || authPerms.actions?.[REQUIRED_ACTION] === true;
    if (!canManage) return Response.json({ error: 'Acesso negado: requer gerir_cotas_gratificacao_funcao ou admin/ALL.' }, { status: 403 });

    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    let resultado: any;
    let entityName = '';
    if (operacao === 'criar_tipo') {
      entityName = 'TipoGratificacaoFuncao';
      resultado = await fetchWithRetry(() => base44.asServiceRole.entities.TipoGratificacaoFuncao.create(sanitizeTipo(data)), 'TipoGratificacaoFuncao.create');
      return Response.json({ ok: true, operacao, entityName, data: sanitizeTipoResponse(resultado) });
    }
    if (operacao === 'atualizar_tipo') {
      entityName = 'TipoGratificacaoFuncao';
      const id = trimString(payload?.id || data?.id);
      await buscarRegistro(base44, entityName, id);
      resultado = await fetchWithRetry(() => base44.asServiceRole.entities.TipoGratificacaoFuncao.update(id, sanitizeTipo(data)), `TipoGratificacaoFuncao.update:${id}`);
      return Response.json({ ok: true, operacao, entityName, data: sanitizeTipoResponse(resultado) });
    }
    if (operacao === 'criar_cota') {
      entityName = 'CotaGratificacaoFuncao';
      const sanitized = sanitizeCota({ ...data, status: data.status || 'ativa' });
      await validarTipoAtivoParaCota(base44, sanitized.tipo_gratificacao_funcao_id);
      resultado = await fetchWithRetry(() => base44.asServiceRole.entities.CotaGratificacaoFuncao.create(sanitized), 'CotaGratificacaoFuncao.create');
      return Response.json({ ok: true, operacao, entityName, data: sanitizeCotaResponse(resultado) });
    }
    entityName = 'CotaGratificacaoFuncao';
    const id = trimString(payload?.id || data?.id);
    const existente = await buscarRegistro(base44, entityName, id);
    const allowedFields = normalizeTipo(existente?.status) === 'encerrada' ? COTA_ENCERRADA_META_FIELDS : new Set(COTA_FIELDS);
    const sanitized = sanitizeCota({ ...existente, ...data }, allowedFields);
    await validarTipoAtivoParaCota(base44, sanitized.tipo_gratificacao_funcao_id);
    resultado = await fetchWithRetry(() => base44.asServiceRole.entities.CotaGratificacaoFuncao.update(id, sanitized), `CotaGratificacaoFuncao.update:${id}`);
    return Response.json({ ok: true, operacao, entityName, data: sanitizeCotaResponse(resultado) });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao gerir cadastros de Gratificação de Função.', meta: { status } }, { status });
  }
});
