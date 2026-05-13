import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const LIMIT_USUARIO_ACESSO = 1000;
const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id', 'perfil_id'];
const MOTIVO_PADRAO = 'Arquivamento lógico em bloco da cadeia da ativa após contrato de designação com nova data-base de férias.';

const normalizeTipo = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const getId = (registro: any) => registro?.id ?? registro?._id ?? null;

async function fetchWithRetry(queryFn: () => Promise<any>, label = 'query') {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt += 1) {
    try { return await queryFn(); } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      if (!RETRY_STATUS.has(status) || attempt === RETRY_MAX_ATTEMPTS) break;
      const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      console.warn(`[arquivarPeriodosDesignacaoEmBloco] retry step=${label} attempt=${attempt} status=${status}`);
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

async function resolverPermissoes(base44: any, email: string) {
  const acessos = await fetchWithRetry(
    () => base44.asServiceRole.entities.UsuarioAcesso.filter({ user_email: email, ativo: true }, undefined, LIMIT_USUARIO_ACESSO, 0, CAMPOS_USUARIO_ACESSO),
    `usuarioAcesso.list:${email}`,
  );
  const perfilIds = Array.from(new Set((acessos || []).map((acesso: any) => acesso?.perfil_id).filter(Boolean)));
  let perfis: any[] = [];
  if (perfilIds.length > 0) {
    perfis = await fetchWithRetry(() => base44.asServiceRole.entities.PerfilPermissao.filter({ id: { $in: perfilIds }, ativo: true }), `perfilPermissao.in:${email}`);
  }
  return {
    acessos: acessos || [],
    actions: consolidarActions(perfis || [], acessos || []),
    isAdminByAccess: (acessos || []).some((acesso: any) => normalizeTipo(acesso?.tipo_acesso) === 'admin'),
  };
}

function normalizeDateOnly(value: unknown) {
  if (!value) return null;
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const y = iso ? Number(iso[1]) : br ? Number(br[3]) : NaN;
  const m = iso ? Number(iso[2]) : br ? Number(br[2]) : NaN;
  const d = iso ? Number(iso[3]) : br ? Number(br[1]) : NaN;
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function compareDateOnly(a: string, b: string) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function normalizarStatusContratoDesignacao(status: unknown) {
  const raw = normalizeTipo(status).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['ativo', 'ativa', 'active'].includes(raw)) return 'ativo';
  if (['encerrado', 'encerrada', 'finalizado', 'finalizada'].includes(raw)) return 'encerrado';
  if (['cancelado', 'cancelada'].includes(raw)) return 'cancelado';
  return raw;
}

function feriasVinculadaAoPeriodo(ferias: any, periodo: any) {
  const periodoId = getId(periodo);
  const periodoRef = periodo?.periodo_aquisitivo_ref || periodo?.ano_referencia || null;
  if (periodoId && String(ferias?.periodo_aquisitivo_id || '').trim() === String(periodoId).trim()) return true;
  if (periodoRef && String(ferias?.periodo_aquisitivo_ref || '').trim() === String(periodoRef).trim()) return true;
  return false;
}

function isJaProcessado(periodo: any, contratoId: string, dataBase: string) {
  const legadoMesmoContrato = Boolean(periodo?.legado_ativa)
    && String(periodo?.legado_ativa_contrato_designacao_id || '') === String(contratoId)
    && String(normalizeDateOnly(periodo?.legado_ativa_data_base) || '') === String(dataBase);
  const canceladoMesmoContrato = Boolean(periodo?.cancelado_transicao)
    && String(periodo?.cancelado_transicao_contrato_designacao_id || '') === String(contratoId)
    && String(normalizeDateOnly(periodo?.cancelado_transicao_data_base) || '') === String(dataBase);
  return legadoMesmoContrato || canceladoMesmoContrato;
}

function isPeriodoDaNovaRegra(periodo: any, contratoId: string, dataBase: string) {
  if (String(periodo?.origem_periodo || '').toLowerCase() === 'designacao') return true;
  if (String(periodo?.contrato_designacao_id || '') === String(contratoId)) return true;
  if (String(periodo?.transicao_designacao_contrato_id || '') === String(contratoId) && !periodo?.legado_ativa && !periodo?.cancelado_transicao) return true;
  return normalizeDateOnly(periodo?.inicio_aquisitivo) === dataBase;
}

function isFuturoIndevido(periodo: any, contrato: any, dataBase: string) {
  const inicio = normalizeDateOnly(periodo?.inicio_aquisitivo);
  const fim = normalizeDateOnly(periodo?.fim_aquisitivo);
  if (!inicio || !fim) return false;
  if (compareDateOnly(fim, dataBase) === -1) return false;
  if (isPeriodoDaNovaRegra(periodo, String(getId(contrato)), dataBase)) return false;
  return compareDateOnly(inicio, dataBase) >= 0 || compareDateOnly(fim, dataBase) >= 0;
}

function quantidadeFeriasVinculadas(ferias: any[], periodo: any) {
  return (ferias || []).filter((item: any) => feriasVinculadaAoPeriodo(item, periodo)).length;
}

function resumoPeriodo(periodo: any, extra: Record<string, unknown> = {}) {
  return {
    id: getId(periodo),
    ano_referencia: periodo?.ano_referencia || periodo?.periodo_aquisitivo_ref || null,
    inicio_aquisitivo: normalizeDateOnly(periodo?.inicio_aquisitivo) || periodo?.inicio_aquisitivo || null,
    fim_aquisitivo: normalizeDateOnly(periodo?.fim_aquisitivo) || periodo?.fim_aquisitivo || null,
    status: periodo?.status || null,
    inativo: periodo?.inativo === true,
    origem_periodo: periodo?.origem_periodo || null,
    ...extra,
  };
}

function resumoBloqueante(periodo: any, quantidadeFerias: number) {
  return {
    id: getId(periodo),
    periodo: [normalizeDateOnly(periodo?.inicio_aquisitivo) || periodo?.inicio_aquisitivo, normalizeDateOnly(periodo?.fim_aquisitivo) || periodo?.fim_aquisitivo].filter(Boolean).join(' a ') || null,
    referencia: periodo?.periodo_aquisitivo_ref || periodo?.ano_referencia || null,
    status: periodo?.status || null,
    quantidade_ferias: quantidadeFerias,
  };
}

function erro(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, error: message, ...extra, meta: { status, ...(extra.meta as any || {}) } }, { status });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return erro('Não autenticado.', 401);

    let payload: any = {};
    try { payload = await req.json(); } catch (_error) { payload = {}; }

    const militarId = payload?.militar_id ? String(payload.militar_id) : '';
    const contratoDesignacaoId = payload?.contrato_designacao_id ? String(payload.contrato_designacao_id) : '';
    if (!militarId || !contratoDesignacaoId) return erro('Informe militar_id e contrato_designacao_id.', 400);
    if (payload?.confirmar !== true) return erro('Confirmação obrigatória para arquivar períodos em bloco.', 400);

    const authEmail = normalizeEmail(authUser.email);
    const effectiveEmail = normalizeEmail(payload?.effectiveEmail);
    const wantsImpersonation = Boolean(effectiveEmail) && effectiveEmail !== authEmail;
    const authPerms = await resolverPermissoes(base44, authUser.email);
    const authIsAdmin = String(authUser.role || '').toLowerCase() === 'admin' || authPerms.isAdminByAccess;
    if (wantsImpersonation && !authIsAdmin) return erro('Ação não permitida: somente administradores podem usar effectiveEmail.', 403);

    const targetEmail = wantsImpersonation ? effectiveEmail : authUser.email;
    const targetPerms = wantsImpersonation ? await resolverPermissoes(base44, targetEmail) : authPerms;
    const targetIsAdmin = wantsImpersonation ? targetPerms.isAdminByAccess : authIsAdmin;
    if (!targetIsAdmin && targetPerms.actions?.gerir_contratos_designacao !== true) {
      return erro('Acesso negado: permissão funcional insuficiente.', 403, { requiredPermission: 'gerir_contratos_designacao ou admin' });
    }

    const contratos = await fetchWithRetry(() => base44.asServiceRole.entities.ContratoDesignacaoMilitar.filter({ id: contratoDesignacaoId }), `ContratoDesignacaoMilitar:${contratoDesignacaoId}`);
    const contrato = (contratos || [])[0];
    if (!contrato) return erro('Contrato de designação não encontrado.', 404);
    if (String(contrato?.militar_id || '') !== militarId) return erro('Contrato não pertence ao militar informado.', 400);
    if (normalizarStatusContratoDesignacao(contrato?.status_contrato) !== 'ativo') return erro('Contrato de designação precisa estar ativo.', 400);

    const dataBase = normalizeDateOnly(contrato?.data_inclusao_para_ferias);
    if (!dataBase) return erro('Contrato ativo sem data_inclusao_para_ferias válida.', 400);

    const [periodos, ferias] = await Promise.all([
      fetchWithRetry(() => base44.asServiceRole.entities.PeriodoAquisitivo.filter({ militar_id: militarId }, 'inicio_aquisitivo', 1000, 0), `PeriodoAquisitivo:${militarId}`),
      fetchWithRetry(() => base44.asServiceRole.entities.Ferias.filter({ militar_id: militarId }, undefined, 1000, 0), `Ferias:${militarId}`),
    ]);

    const periodosAlvo = (periodos || [])
      .map((periodo: any) => {
        const fim = normalizeDateOnly(periodo?.fim_aquisitivo);
        const anterior = fim ? compareDateOnly(fim, dataBase) === -1 : false;
        const futuroIndevido = isFuturoIndevido(periodo, contrato, dataBase);
        const jaProcessado = isJaProcessado(periodo, contratoDesignacaoId, dataBase);
        return { periodo, fim, anterior, futuroIndevido, jaProcessado };
      })
      .filter((item: any) => (item.anterior || item.futuroIndevido) && !item.jaProcessado);

    const bloqueantes = periodosAlvo
      .map((item: any) => ({ periodo: item.periodo, quantidadeFerias: quantidadeFeriasVinculadas(ferias || [], item.periodo) }))
      .filter((item: any) => item.quantidadeFerias > 0)
      .map((item: any) => resumoBloqueante(item.periodo, item.quantidadeFerias));

    if (bloqueantes.length > 0) {
      const mensagem = 'Existem férias lançadas em períodos que precisam ser ajustados. Exclua ou corrija essas férias antes de arquivar/excluir os períodos.';
      return erro(mensagem, 409, {
        code: 'PERIODOS_COM_FERIAS_VINCULADAS',
        mensagem,
        bloqueantes,
      });
    }

    const nowIso = new Date().toISOString();
    const userEmailEfetivo = normalizeEmail(targetEmail) || authEmail || null;
    const detalhes: any[] = [];
    const resumo = { arquivados: 0, cancelados: 0, ignorados: 0, com_ferias_vinculadas: 0, ja_processados: 0 };

    for (const periodo of (periodos || [])) {
      const periodoId = getId(periodo);
      const fim = normalizeDateOnly(periodo?.fim_aquisitivo);
      const anterior = fim ? compareDateOnly(fim, dataBase) === -1 : false;
      const futuroIndevido = isFuturoIndevido(periodo, contrato, dataBase);

      if (!anterior && !futuroIndevido) {
        resumo.ignorados += 1;
        detalhes.push(resumoPeriodo(periodo, { acao: 'ignorado', motivo: fim ? 'fora_do_escopo_da_data_base' : 'fim_aquisitivo_invalido' }));
        continue;
      }

      if (isJaProcessado(periodo, contratoDesignacaoId, dataBase)) {
        resumo.ja_processados += 1;
        detalhes.push(resumoPeriodo(periodo, { acao: 'ja_processado', motivo: 'mesmo_contrato_e_data_base' }));
        continue;
      }

      if (anterior) {
        const patch: Record<string, unknown> = {
          legado_ativa: true,
          origem_periodo: 'legado_ativa',
          excluido_da_cadeia_designacao: true,
          legado_ativa_contrato_designacao_id: getId(contrato),
          legado_ativa_data_base: dataBase,
          legado_ativa_em: nowIso,
          legado_ativa_por: userEmailEfetivo,
          transicao_designacao_contrato_id: getId(contrato),
          transicao_designacao_em: nowIso,
          transicao_designacao_por: userEmailEfetivo,
          transicao_designacao_motivo: MOTIVO_PADRAO,
          acao_transicao_designacao: 'arquivar_legado_ativa',
        };
        if (periodo?.legado_ativa_status_anterior === undefined) patch.legado_ativa_status_anterior = periodo?.status ?? null;
        if (periodo?.legado_ativa_inativo_anterior === undefined) patch.legado_ativa_inativo_anterior = periodo?.inativo ?? false;
        if (periodo?.legado_ativa_origem_periodo_anterior === undefined) patch.legado_ativa_origem_periodo_anterior = periodo?.origem_periodo || null;
        if (periodo?.legado_ativa_excluido_da_cadeia_designacao_anterior === undefined) patch.legado_ativa_excluido_da_cadeia_designacao_anterior = periodo?.excluido_da_cadeia_designacao ?? false;

        await fetchWithRetry(() => base44.asServiceRole.entities.PeriodoAquisitivo.update(periodoId, patch), `PeriodoAquisitivo.arquivar:${periodoId}`);
        resumo.arquivados += 1;
        detalhes.push(resumoPeriodo(periodo, { acao: 'arquivar_legado_ativa', ferias_vinculadas: 0 }));
        continue;
      }

      const patch = {
        cancelado_transicao: true,
        excluido_da_cadeia_designacao: true,
        cancelado_transicao_contrato_designacao_id: getId(contrato),
        cancelado_transicao_data_base: dataBase,
        cancelado_transicao_em: nowIso,
        cancelado_transicao_por: userEmailEfetivo,
        cancelado_transicao_motivo: MOTIVO_PADRAO,
        transicao_designacao_contrato_id: getId(contrato),
        transicao_designacao_em: nowIso,
        transicao_designacao_por: userEmailEfetivo,
        acao_transicao_designacao: 'cancelar_futuro_indevido',
      };
      await fetchWithRetry(() => base44.asServiceRole.entities.PeriodoAquisitivo.update(periodoId, patch), `PeriodoAquisitivo.cancelar:${periodoId}`);
      resumo.cancelados += 1;
      detalhes.push(resumoPeriodo(periodo, { acao: 'cancelar_futuro_indevido', ferias_vinculadas: 0 }));
    }

    return Response.json({ ok: true, resumo, detalhes, meta: { appliedAt: nowIso, dataBase, contratoDesignacaoId, militarId } });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ ok: false, error: error?.message || 'Erro ao arquivar períodos da ativa em bloco.', meta: { status } }, { status });
  }
});
