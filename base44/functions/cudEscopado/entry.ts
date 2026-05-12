import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =====================================================================
// cudEscopado — Backend Hardening Lote 1
// ---------------------------------------------------------------------
// Função genérica de Create/Update/Delete com validação de escopo
// militar OBRIGATÓRIA antes de qualquer operação asServiceRole.
//
// Allowlist RÍGIDA de entidades. Qualquer entidade fora da allowlist
// é rejeitada com 400. Operações fora de {create, update, delete}
// também rejeitadas.
//
// Regras:
//   - autentica usuário real;
//   - resolve effectiveEmail (somente admins reais podem impersonar);
//   - resolve permissões e escopo via UsuarioAcesso/PerfilPermissao;
//   - identifica militar_id alvo:
//       * create  -> data.militar_id
//       * update  -> registro existente.militar_id (canônico)
//       * delete  -> registro existente.militar_id
//   - bloqueia 403 se militar_id fora do escopo (não-admin);
//   - update: bloqueia troca de militar_id por usuário restrito;
//   - admin: passa em todos os casos, mantendo regras de negócio existentes.
//
// NÃO altera regra de negócio, templates, cálculos, fluxos ou comportamento.
// É apenas um portão de segurança que executa CUD com service role
// quando — e somente quando — o militar_id alvo está no escopo.
// =====================================================================

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const ENTIDADES_PERMITIDAS = new Set([
  'Ferias',
  'PeriodoAquisitivo',
  'Atestado',
  'RegistroLivro',
  'PublicacaoExOfficio',
  'CreditoExtraFerias',
  'ContratoDesignacaoMilitar',
]);

const OPERACOES_PERMITIDAS = new Set(['create', 'update', 'delete']);

// =====================================================================
// PERMISSIONS_MAP — Validação funcional por entidade × operação
// ---------------------------------------------------------------------
// Chaves extraídas de config/permissionStructure.js (chaves reais já
// existentes no projeto). NÃO inventar permissões novas. CreditoExtra
// Ferias e PeriodoAquisitivo herdam as chaves de Férias por estarem no
// mesmo módulo (acesso_ferias) e não possuírem chaves próprias.
// Admin sempre passa por bypass — esta tabela só é consultada para
// usuários não-admin.
// =====================================================================
const PERMISSIONS_MAP = {
  Ferias: {
    create: 'adicionar_ferias',
    update: 'editar_ferias',
    delete: 'excluir_ferias',
  },
  PeriodoAquisitivo: {
    create: 'adicionar_ferias',
    update: 'editar_ferias',
    delete: 'editar_ferias',
  },
  CreditoExtraFerias: {
    create: 'adicionar_ferias',
    update: 'editar_ferias',
    delete: 'excluir_ferias',
  },
  Atestado: {
    create: 'adicionar_atestados',
    update: 'editar_atestados',
    delete: 'excluir_atestado',
  },
  RegistroLivro: {
    create: 'adicionar_livro',
    update: 'editar_livro',
    delete: 'excluir_livro',
  },
  PublicacaoExOfficio: {
    create: 'adicionar_publicacoes',
    update: 'editar_publicacoes',
    delete: 'excluir_publicacoes',
  },
  ContratoDesignacaoMilitar: {
    create: 'criar_contrato_designacao',
    update: 'editar_metadados_contrato_designacao',
  },
};

// Extrai matriz [SGP_PERMISSIONS_MATRIX]{...}[/SGP_PERMISSIONS_MATRIX]
// do campo descricao de PerfilPermissao (espelha getUserPermissions).
function extrairMatrizPermissoes(descricao) {
  if (typeof descricao !== 'string' || !descricao) return {};
  const start = descricao.indexOf('[SGP_PERMISSIONS_MATRIX]');
  const end = descricao.indexOf('[/SGP_PERMISSIONS_MATRIX]');
  if (start === -1 || end === -1 || end <= start) return {};
  const jsonStr = descricao.slice(start + '[SGP_PERMISSIONS_MATRIX]'.length, end).trim();
  if (!jsonStr) return {};
  try {
    const parsed = JSON.parse(jsonStr);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_e) {
    return {};
  }
}

// Consolida actions (chaves perm_*) por OR aditivo a partir de perfis
// (campos diretos + matriz embutida) e UsuarioAcesso. Espelha exatamente
// a regra de consolidarModulesActions de getUserPermissions.
function consolidarActions(perfis, acessos) {
  const actions = {};
  const aplicarFonte = (fonte) => {
    if (!fonte) return;
    Object.entries(fonte).forEach(([key, val]) => {
      if (typeof val !== 'boolean') return;
      if (!key.startsWith('perm_')) return;
      const actionKey = key.replace(/^perm_/, '');
      if (val === true) {
        actions[actionKey] = true;
      } else if (!(actionKey in actions)) {
        actions[actionKey] = false;
      }
    });
  };
  (perfis || []).forEach((p) => {
    if (!p) return;
    aplicarFonte(p);
    aplicarFonte(extrairMatrizPermissoes(p.descricao));
  });
  (acessos || []).forEach(aplicarFonte);
  return actions;
}

const CAMPOS_USUARIO_ACESSO = [
  'id',
  'user_email',
  'ativo',
  'tipo_acesso',
  'grupamento_id',
  'subgrupamento_id',
  'militar_id',
  'perfil_id',
];

const normalizeTipo = (t) => String(t || '').trim().toLowerCase();
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

async function fetchWithRetry(queryFn, label = 'query') {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      const isRetryable = RETRY_STATUS.has(status);
      if (!isRetryable || attempt === RETRY_MAX_ATTEMPTS) break;
      const exp = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 200);
      await new Promise((res) => setTimeout(res, exp + jitter));
      console.warn(`[cudEscopado] retry step=${label} attempt=${attempt} status=${status}`);
    }
  }
  throw lastError;
}

async function resolverPermissoes(base44, email) {
  const acessos = await fetchWithRetry(
    () => base44.asServiceRole.entities.UsuarioAcesso.filter(
      { user_email: email, ativo: true },
      undefined,
      100,
      0,
      CAMPOS_USUARIO_ACESSO,
    ),
    `usuarioAcesso.list:${email}`,
  );
  const isAdminByAccess = (acessos || []).some(
    (a) => normalizeTipo(a.tipo_acesso) === 'admin',
  );

  // Carrega perfis ativos para consolidar actions funcionais
  const perfilIds = Array.from(
    new Set((acessos || []).map((a) => a?.perfil_id).filter(Boolean)),
  );
  let perfis = [];
  if (perfilIds.length > 0) {
    perfis = await fetchWithRetry(
      () => base44.asServiceRole.entities.PerfilPermissao.filter({
        id: { $in: perfilIds },
        ativo: true,
      }),
      `perfilPermissao.in:${email}`,
    );
  }

  const actions = consolidarActions(perfis || [], acessos || []);

  return {
    acessos: acessos || [],
    perfis: perfis || [],
    actions,
    isAdminByAccess,
  };
}

// Replicação simplificada de listarMilitarIdsDoEscopo de moverMilitaresLotacao.js.
// Retorna null para admin (sem restrição) ou Array de IDs permitidos.
async function listarMilitarIdsDoEscopo(base44, acessos) {
  const ids = new Set();

  for (const acesso of acessos || []) {
    const tipo = normalizeTipo(acesso?.tipo_acesso);
    if (tipo === 'admin') return null;

    if (tipo === 'proprio') {
      if (acesso?.militar_id) ids.add(String(acesso.militar_id));
      continue;
    }

    const grupamentoId = acesso?.grupamento_id || null;
    const subgrupamentoId = acesso?.subgrupamento_id || null;

    const filtros = [];
    if (tipo === 'setor' && grupamentoId) {
      filtros.push({ grupamento_raiz_id: grupamentoId });
      filtros.push({ grupamento_id: grupamentoId });
      filtros.push({ estrutura_id: grupamentoId });
    } else if (tipo === 'subsetor' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId });
      filtros.push({ subgrupamento_id: subgrupamentoId });
      try {
        const filhos = await fetchWithRetry(
          () => base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }),
          `subgrupamento.parent:${subgrupamentoId}`,
        );
        for (const filho of (filhos || [])) {
          if (filho?.id) {
            filtros.push({ estrutura_id: filho.id });
            filtros.push({ subgrupamento_id: filho.id });
          }
        }
      } catch (_e) {
        // segue com o que conseguiu coletar
      }
    } else if (tipo === 'unidade' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId });
      filtros.push({ subgrupamento_id: subgrupamentoId });
    }

    for (const filtro of filtros) {
      try {
        const militares = await fetchWithRetry(
          () => base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, ['id']),
          `militar.escopo:${JSON.stringify(filtro)}`,
        );
        for (const m of (militares || [])) {
          if (m?.id) ids.add(String(m.id));
        }
      } catch (_e) {
        // mantém o que coletou
      }
    }
  }

  return Array.from(ids);
}


function normalizarTextoContratoDesignacao(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizarStatusContratoDesignacao(status) {
  const normalizado = normalizarTextoContratoDesignacao(status);
  if (['ativo', 'ativa'].includes(normalizado)) return 'ativo';
  if (['encerrado', 'encerrada', 'finalizado', 'finalizada'].includes(normalizado)) return 'encerrado';
  if (['cancelado', 'cancelada'].includes(normalizado)) return 'cancelado';
  return normalizado;
}

function dataTime(valor) {
  if (!valor) return 0;
  const time = new Date(`${String(valor).slice(0, 10)}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : 0;
}

function normalizarTipoPrazoContratoDesignacao(valor) {
  return normalizarTextoContratoDesignacao(valor) === 'determinado' ? 'determinado' : 'indeterminado';
}

function normalizarGeraDireitoFeriasContratoDesignacao(valor) {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === 'boolean') return valor;
  const normalizado = normalizarTextoContratoDesignacao(valor);
  if (['false', 'nao', 'no', '0'].includes(normalizado)) return false;
  if (['true', 'sim', 'yes', '1'].includes(normalizado)) return true;
  return true;
}

function normalizarRegraGeracaoPeriodosContratoDesignacao(valor) {
  const normalizado = normalizarTextoContratoDesignacao(valor);
  if (normalizado === 'bloqueada') return 'bloqueada';
  if (normalizado === 'manual') return 'manual';
  return 'normal';
}

function prepararCamposFeriasContratoDesignacao(data = {}) {
  const tipoPrazoContrato = normalizarTipoPrazoContratoDesignacao(data?.tipo_prazo_contrato);
  const dataBaseFerias = data?.data_inclusao_para_ferias || data?.data_inicio_contrato || '';
  if (tipoPrazoContrato === 'indeterminado') {
    return {
      ...data,
      data_fim_contrato: '',
      data_inclusao_para_ferias: dataBaseFerias,
      tipo_prazo_contrato: 'indeterminado',
      gera_direito_ferias: true,
      regra_geracao_periodos: 'normal',
      motivo_nao_gera_ferias: '',
    };
  }

  const geraDireitoFerias = normalizarGeraDireitoFeriasContratoDesignacao(data?.gera_direito_ferias);
  const regraGeracaoPeriodos = normalizarRegraGeracaoPeriodosContratoDesignacao(data?.regra_geracao_periodos);
  return {
    ...data,
    data_inclusao_para_ferias: dataBaseFerias,
    tipo_prazo_contrato: 'determinado',
    gera_direito_ferias: geraDireitoFerias,
    regra_geracao_periodos: regraGeracaoPeriodos,
    motivo_nao_gera_ferias: geraDireitoFerias ? '' : String(data?.motivo_nao_gera_ferias || '').trim(),
  };
}

function validarCamposFeriasContratoDesignacao(data = {}, erros = []) {
  const tipoPrazoContrato = normalizarTipoPrazoContratoDesignacao(data?.tipo_prazo_contrato);
  const geraDireitoFerias = tipoPrazoContrato === 'indeterminado' ? true : normalizarGeraDireitoFeriasContratoDesignacao(data?.gera_direito_ferias);
  const regraGeracaoPeriodos = normalizarRegraGeracaoPeriodosContratoDesignacao(data?.regra_geracao_periodos);

  if (tipoPrazoContrato === 'indeterminado') {
    if (data?.gera_direito_ferias !== undefined && normalizarGeraDireitoFeriasContratoDesignacao(data.gera_direito_ferias) !== true) {
      erros.push('Contrato indeterminado deve gerar direito a férias.');
    }
    if (data?.regra_geracao_periodos !== undefined && regraGeracaoPeriodos !== 'normal') {
      erros.push('Contrato indeterminado deve usar regra_geracao_periodos normal.');
    }
  }

  if (tipoPrazoContrato === 'determinado') {
    if (regraGeracaoPeriodos === 'normal') erros.push('Contrato determinado deve usar regra_geracao_periodos bloqueada ou manual.');
    if (!geraDireitoFerias && !String(data?.motivo_nao_gera_ferias || '').trim()) {
      erros.push('motivo_nao_gera_ferias é obrigatório quando contrato determinado não gera direito a férias.');
    }
  }
  return erros;
}

function possuiActionContratoDesignacao(actions, ...keys) {
  return keys.some((key) => actions?.[key] === true);
}

function validarMatriculaContratoDesignacao(data) {
  const matriculaMilitarId = String(data?.matricula_militar_id || '').trim();
  if (matriculaMilitarId && matriculaMilitarId.includes(':')) {
    const erro = new Error('matricula_militar_id deve conter somente o ID real da matrícula, sem o formato id:matricula.');
    erro.status = 400;
    throw erro;
  }
  return matriculaMilitarId;
}


async function garantirContratoAtivoUnico(base44, militarId, registroIdIgnorado = null) {
  const ativos = await fetchWithRetry(
    () => base44.asServiceRole.entities.ContratoDesignacaoMilitar.filter({ militar_id: militarId, status_contrato: 'ativo' }, undefined, 1000, 0),
    `ContratoDesignacaoMilitar.ativos:${militarId}`,
  );
  const conflito = (ativos || []).find((contrato) => String(contrato?.id || '') !== String(registroIdIgnorado || ''));
  if (conflito) {
    const erro = new Error('Já existe contrato de designação ativo para este militar.');
    erro.status = 400;
    throw erro;
  }
}

async function prepararContratoDesignacaoMilitar({ base44, operation, registroId, data, registroExistente, militarAlvoId, userEmail }) {
  const dadosRecebidos = data || {};
  data = dadosRecebidos;
  if (operation === 'create') data = prepararCamposFeriasContratoDesignacao(data);
  if (operation === 'delete') {
    const erro = new Error('Delete físico de ContratoDesignacaoMilitar não é permitido. Use cancelamento para preservar histórico.');
    erro.status = 400;
    throw erro;
  }

  const nowUser = userEmail || '';
  const statusPayload = data && Object.prototype.hasOwnProperty.call(data, 'status_contrato')
    ? normalizarStatusContratoDesignacao(data.status_contrato)
    : normalizarStatusContratoDesignacao(registroExistente?.status_contrato);

  if (operation === 'create') {
    const erros = [];
    if (!data?.militar_id) erros.push('militar_id é obrigatório.');
    if (String(data?.matricula_militar_id || '').trim() && String(data.matricula_militar_id).includes(':')) erros.push('matricula_militar_id deve conter somente o ID real da matrícula, sem o formato id:matricula.');
    if (!String(data?.matricula_designacao || '').trim()) erros.push('matricula_designacao é obrigatória.');
    if (!data?.data_inicio_contrato) erros.push('data_inicio_contrato é obrigatória.');
    if (!data?.data_inclusao_para_ferias) erros.push('data_inclusao_para_ferias é obrigatória.');
    if (!String(dadosRecebidos?.tipo_prazo_contrato || '').trim()) erros.push('tipo_prazo_contrato é obrigatório.');
    if (dadosRecebidos?.gera_direito_ferias === undefined || dadosRecebidos?.gera_direito_ferias === null || dadosRecebidos?.gera_direito_ferias === '') erros.push('gera_direito_ferias é obrigatório.');
    if (!String(dadosRecebidos?.regra_geracao_periodos || '').trim()) erros.push('regra_geracao_periodos é obrigatória.');
    validarCamposFeriasContratoDesignacao(data, erros);
    if (data?.data_inicio_contrato && data?.data_fim_contrato && dataTime(data.data_fim_contrato) < dataTime(data.data_inicio_contrato)) erros.push('data_fim_contrato não pode ser anterior à data_inicio_contrato.');
    if (erros.length) {
      const erro = new Error(erros.join(' '));
      erro.status = 400;
      throw erro;
    }
    const matriculaMilitarId = validarMatriculaContratoDesignacao(data);
    if (statusPayload === 'ativo') await garantirContratoAtivoUnico(base44, militarAlvoId);
    return {
      ...data,
      data_inclusao_para_ferias: data.data_inclusao_para_ferias || data.data_inicio_contrato || '',
      data_fim_contrato: normalizarTipoPrazoContratoDesignacao(data.tipo_prazo_contrato) === 'indeterminado' ? '' : data.data_fim_contrato,
      matricula_militar_id: matriculaMilitarId,
      matricula_designacao: String(data.matricula_designacao || ''),
      status_contrato: statusPayload,
      criado_por: data?.criado_por || nowUser,
      atualizado_por: nowUser,
    };
  }

  if (!registroExistente) return data;
  const statusAtual = normalizarStatusContratoDesignacao(registroExistente.status_contrato);
  const payloadFinal = { ...(data || {}) };

  if (statusPayload === 'encerrado' && statusAtual !== 'encerrado') {
    if (statusAtual !== 'ativo') {
      const erro = new Error('Somente contrato ativo pode ser encerrado.');
      erro.status = 400;
      throw erro;
    }
    if (!payloadFinal.data_fim_contrato && !payloadFinal.data_encerramento_operacional) {
      const erro = new Error('Informe data_fim_contrato ou data_encerramento_operacional para encerrar o contrato.');
      erro.status = 400;
      throw erro;
    }
    if (!String(payloadFinal.motivo_encerramento || '').trim()) {
      const erro = new Error('motivo_encerramento é obrigatório para encerrar contrato.');
      erro.status = 400;
      throw erro;
    }
    payloadFinal.status_contrato = 'encerrado';
    payloadFinal.encerrado_por = payloadFinal.encerrado_por || nowUser;
  } else if (statusPayload === 'cancelado' && statusAtual !== 'cancelado') {
    if (!String(payloadFinal.motivo_cancelamento || '').trim()) {
      const erro = new Error('motivo_cancelamento é obrigatório para cancelar contrato.');
      erro.status = 400;
      throw erro;
    }
    payloadFinal.status_contrato = 'cancelado';
    payloadFinal.cancelado_por = payloadFinal.cancelado_por || nowUser;
  } else if (statusPayload === 'ativo') {
    if (!payloadFinal.data_inclusao_para_ferias && !registroExistente.data_inclusao_para_ferias && (payloadFinal.data_inicio_contrato || registroExistente.data_inicio_contrato)) {
      payloadFinal.data_inclusao_para_ferias = payloadFinal.data_inicio_contrato || registroExistente.data_inicio_contrato;
    }
    if (!payloadFinal.data_inclusao_para_ferias && !registroExistente.data_inclusao_para_ferias) {
      const erro = new Error('data_inclusao_para_ferias é obrigatória quando status_contrato = ativo.');
      erro.status = 400;
      throw erro;
    }
    await garantirContratoAtivoUnico(base44, militarAlvoId, registroId);
  }

  if (normalizarTipoPrazoContratoDesignacao(payloadFinal.tipo_prazo_contrato || registroExistente.tipo_prazo_contrato) === 'indeterminado') {
    payloadFinal.data_fim_contrato = '';
  }

  const contratoCombinado = { ...registroExistente, ...payloadFinal };
  const errosFeriasContrato = validarCamposFeriasContratoDesignacao(contratoCombinado, []);
  if (errosFeriasContrato.length) {
    const erro = new Error(errosFeriasContrato.join(' '));
    erro.status = 400;
    throw erro;
  }
  if (contratoCombinado.data_inicio_contrato && contratoCombinado.data_fim_contrato && dataTime(contratoCombinado.data_fim_contrato) < dataTime(contratoCombinado.data_inicio_contrato)) {
    const erro = new Error('data_fim_contrato não pode ser anterior à data_inicio_contrato.');
    erro.status = 400;
    throw erro;
  }

  if (Object.prototype.hasOwnProperty.call(payloadFinal, 'matricula_militar_id')) {
    payloadFinal.matricula_militar_id = validarMatriculaContratoDesignacao(payloadFinal);
  }
  payloadFinal.atualizado_por = nowUser;
  payloadFinal.militar_id = militarAlvoId;
  return payloadFinal;
}

function getEntity(base44, entityName) {
  return base44.asServiceRole.entities[entityName];
}

async function buscarRegistroExistente(base44, entityName, registroId) {
  const entity = getEntity(base44, entityName);
  try {
    return await fetchWithRetry(
      () => entity.get(registroId),
      `${entityName}.get:${registroId}`,
    );
  } catch (e) {
    const status = e?.response?.status || e?.status || 0;
    if (status === 404) {
      // Fallback via filter (algumas entidades respondem melhor)
      const lista = await entity.filter({ id: registroId }, undefined, 1, 0).catch(() => []);
      return lista?.[0] || null;
    }
    throw e;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const authUser = await base44.auth.me();
    if (!authUser) {
      return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    let payload = {};
    try {
      payload = await req.json();
    } catch (_e) {
      payload = {};
    }

    const entityName = String(payload?.entityName || '').trim();
    const operation = String(payload?.operation || '').trim().toLowerCase();
    const registroId = payload?.registroId ? String(payload.registroId) : null;
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    const effectiveEmailRaw = payload?.effectiveEmail;

    // ---- Validação de allowlist ----
    if (!entityName || !ENTIDADES_PERMITIDAS.has(entityName)) {
      return Response.json(
        { error: `Entidade "${entityName}" não é permitida nesta função.` },
        { status: 400 },
      );
    }
    if (!operation || !OPERACOES_PERMITIDAS.has(operation)) {
      return Response.json(
        { error: `Operação "${operation}" inválida. Use create, update ou delete.` },
        { status: 400 },
      );
    }
    if (entityName === 'ContratoDesignacaoMilitar' && operation === 'delete') {
      return Response.json(
        { error: 'Delete físico de ContratoDesignacaoMilitar não é permitido. Use cancelamento para preservar histórico.' },
        { status: 400 },
      );
    }

    if ((operation === 'update' || operation === 'delete') && !registroId) {
      return Response.json(
        { error: `registroId é obrigatório para operação ${operation}.` },
        { status: 400 },
      );
    }

    // ---- Resolução de auth/effective ----
    const authUserEmail = normalizeEmail(authUser.email);
    const effectiveEmailNorm = normalizeEmail(effectiveEmailRaw);
    const wantsImpersonation = Boolean(effectiveEmailNorm) && effectiveEmailNorm !== authUserEmail;

    const authPerms = await resolverPermissoes(base44, authUser.email);
    const authIsAdminByRole = String(authUser.role || '').toLowerCase() === 'admin';
    const authIsAdmin = authIsAdminByRole || authPerms.isAdminByAccess;

    if (wantsImpersonation && !authIsAdmin) {
      return Response.json(
        { error: 'Ação não permitida: somente administradores podem usar effectiveEmail.' },
        { status: 403 },
      );
    }

    const isImpersonating = wantsImpersonation && authIsAdmin;
    const targetEmail = isImpersonating ? effectiveEmailNorm : authUser.email;
    const targetPerms = isImpersonating
      ? await resolverPermissoes(base44, targetEmail)
      : authPerms;
    const targetIsAdmin = isImpersonating ? targetPerms.isAdminByAccess : authIsAdmin;

    // ---- Identificar militar_id alvo ----
    let militarAlvoId = null;
    let registroExistente = null;

    if (operation === 'create') {
      militarAlvoId = data?.militar_id ? String(data.militar_id) : null;
    } else {
      // update / delete: buscar registro existente para obter militar_id canônico
      registroExistente = await buscarRegistroExistente(base44, entityName, registroId);
      if (!registroExistente) {
        return Response.json(
          { error: `${entityName} ${registroId} não encontrado.` },
          { status: 404 },
        );
      }
      militarAlvoId = registroExistente.militar_id ? String(registroExistente.militar_id) : null;
    }

    if (!militarAlvoId) {
      return Response.json(
        { error: 'Não foi possível identificar o militar_id alvo desta operação.' },
        { status: 400 },
      );
    }

    // ---- Bloqueio de troca de militar_id em update por restrito ----
    if (operation === 'update' && !targetIsAdmin) {
      if (data && Object.prototype.hasOwnProperty.call(data, 'militar_id')) {
        const militarIdNoPayload = data.militar_id ? String(data.militar_id) : null;
        if (militarIdNoPayload && militarIdNoPayload !== militarAlvoId) {
          return Response.json(
            { error: 'Acesso negado: você não pode alterar o militar_id de um registro existente.' },
            { status: 403 },
          );
        }
      }
    }

    // ---- Validação de escopo ----
    if (!targetIsAdmin) {
      const idsPermitidos = await listarMilitarIdsDoEscopo(base44, targetPerms.acessos);
      if (idsPermitidos !== null) {
        const setPermitidos = new Set(idsPermitidos.map(String));
        if (!setPermitidos.has(militarAlvoId)) {
          console.warn('[cudEscopado] tentativa fora do escopo', {
            targetEmail,
            entityName,
            operation,
            militarAlvoId,
          });
          return Response.json(
            { error: 'Acesso negado: militar fora do seu escopo.', militarAlvoId },
            { status: 403 },
          );
        }
      }
    }

    // ---- Validação de permissão funcional (PERMISSIONS_MAP) ----
    // Admin: bypass. Não-admin: precisa ter a action mapeada.
    if (!targetIsAdmin) {
      if (entityName === 'ContratoDesignacaoMilitar') {
        const statusContratoPayload = normalizarStatusContratoDesignacao(data?.status_contrato);
        let allowed = false;
        let requiredPermission = null;
        if (operation === 'create') {
          requiredPermission = 'criar_contrato_designacao ou gerir_contratos_designacao';
          allowed = possuiActionContratoDesignacao(targetPerms.actions, 'criar_contrato_designacao', 'gerir_contratos_designacao');
        } else if (operation === 'update' && statusContratoPayload === 'encerrado') {
          requiredPermission = 'encerrar_contrato_designacao ou gerir_contratos_designacao';
          allowed = possuiActionContratoDesignacao(targetPerms.actions, 'encerrar_contrato_designacao', 'gerir_contratos_designacao');
        } else if (operation === 'update' && statusContratoPayload === 'cancelado') {
          requiredPermission = 'cancelar_contrato_designacao ou gerir_contratos_designacao';
          allowed = possuiActionContratoDesignacao(targetPerms.actions, 'cancelar_contrato_designacao', 'gerir_contratos_designacao');
        } else if (operation === 'update') {
          requiredPermission = 'editar_metadados_contrato_designacao ou gerir_contratos_designacao';
          allowed = possuiActionContratoDesignacao(targetPerms.actions, 'editar_metadados_contrato_designacao', 'gerir_contratos_designacao');
        }
        if (!allowed) {
          return Response.json(
            { error: 'Acesso negado: permissão funcional insuficiente.', requiredPermission },
            { status: 403 },
          );
        }
      } else {
      const mapaEntidade = PERMISSIONS_MAP[entityName];
      const requiredPermission = mapaEntidade ? mapaEntidade[operation] : null;
      if (!requiredPermission) {
        console.warn('[cudEscopado] operação não mapeada', { entityName, operation });
        return Response.json(
          { error: 'Acesso negado: operação não mapeada para esta entidade.' },
          { status: 403 },
        );
      }
      const possui = targetPerms.actions?.[requiredPermission] === true;
      if (!possui) {
        console.warn('[cudEscopado] permissão funcional insuficiente', {
          targetEmail,
          entityName,
          operation,
          requiredPermission,
        });
        return Response.json(
          { error: 'Acesso negado: permissão funcional insuficiente.', requiredPermission },
          { status: 403 },
        );
      }
      }
    }

    let dataValidada = data;
    if (entityName === 'ContratoDesignacaoMilitar') {
      dataValidada = await prepararContratoDesignacaoMilitar({
        base44,
        operation,
        registroId,
        data,
        registroExistente,
        militarAlvoId,
        userEmail: targetEmail,
      });
    }

    // ---- Execução com service role ----
    const entity = getEntity(base44, entityName);
    let resultado = null;

    if (operation === 'create') {
      resultado = await fetchWithRetry(
        () => entity.create(dataValidada),
        `${entityName}.create`,
      );
    } else if (operation === 'update') {
      // Em update por restrito, garantimos que militar_id permaneça o canônico.
      const dataSegura = !targetIsAdmin && dataValidada
        ? { ...dataValidada, militar_id: militarAlvoId }
        : dataValidada;
      resultado = await fetchWithRetry(
        () => entity.update(registroId, dataSegura),
        `${entityName}.update:${registroId}`,
      );
    } else if (operation === 'delete') {
      resultado = await fetchWithRetry(
        () => entity.delete(registroId),
        `${entityName}.delete:${registroId}`,
      );
    }

    return Response.json({
      ok: true,
      entityName,
      operation,
      registroId: registroId || resultado?.id || null,
      data: resultado || null,
      meta: {
        authUserEmail: authUser.email,
        effectiveUserEmail: targetEmail,
        isImpersonating,
        targetIsAdmin,
        militarAlvoId,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    console.error('[cudEscopado] erro fatal', {
      message: error?.message,
      status,
    });
    return Response.json(
      { error: error?.message || 'Erro interno em cudEscopado.' },
      { status },
    );
  }
});