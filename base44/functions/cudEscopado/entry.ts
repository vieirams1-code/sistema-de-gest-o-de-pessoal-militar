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
]);

const OPERACOES_PERMITIDAS = new Set(['create', 'update', 'delete']);

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
  return { acessos: acessos || [], isAdminByAccess };
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

    // ---- Execução com service role ----
    const entity = getEntity(base44, entityName);
    let resultado = null;

    if (operation === 'create') {
      resultado = await fetchWithRetry(
        () => entity.create(data),
        `${entityName}.create`,
      );
    } else if (operation === 'update') {
      // Em update por restrito, garantimos que militar_id permaneça o canônico.
      const dataSegura = !targetIsAdmin && data
        ? { ...data, militar_id: militarAlvoId }
        : data;
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