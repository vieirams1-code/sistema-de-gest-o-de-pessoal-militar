import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const LIMIT_USUARIO_ACESSO = 1000;
const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id', 'perfil_id'];
const STATUS_FINALIZADOS = ['Gozado', 'Inativo'];
const STATUS_FERIAS_PREVISTA_AUTORIZADA = ['Prevista', 'Autorizada'];
const CONFIRMACAO_TEXTUAL = 'MARCAR LEGADO DA ATIVA';
const RISCOS_BLOQUEANTES = new Set(['ferias_em_curso', 'ferias_prevista_ou_autorizada', 'status_pago_nao_previsto']);

const normalizeTipo = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const getId = (registro: any) => registro?.id ?? registro?._id ?? null;

async function fetchWithRetry(queryFn: () => Promise<any>, label = 'query') {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      if (!RETRY_STATUS.has(status) || attempt === RETRY_MAX_ATTEMPTS) break;
      const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      console.warn(`[aplicarTransicaoLegadoAtiva] retry step=${label} attempt=${attempt} status=${status}`);
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
  (perfis || []).forEach((perfil) => {
    aplicarFonte(perfil);
    aplicarFonte(extrairMatrizPermissoes(perfil?.descricao));
  });
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
    perfis = await fetchWithRetry(
      () => base44.asServiceRole.entities.PerfilPermissao.filter({ id: { $in: perfilIds }, ativo: true }),
      `perfilPermissao.in:${email}`,
    );
  }
  return {
    acessos: acessos || [],
    perfis: perfis || [],
    actions: consolidarActions(perfis || [], acessos || []),
    isAdminByAccess: (acessos || []).some((acesso: any) => normalizeTipo(acesso?.tipo_acesso) === 'admin'),
  };
}

async function listarMilitarIdsDoEscopo(base44: any, acessos: any[], criteriosAplicados: Set<string>) {
  const ids = new Set<string>();
  for (const acesso of acessos || []) {
    const tipo = normalizeTipo(acesso?.tipo_acesso);
    if (tipo === 'admin') return null;
    if (tipo === 'proprio') {
      if (acesso?.militar_id) {
        ids.add(String(acesso.militar_id));
        criteriosAplicados.add('proprio');
      }
      continue;
    }

    const filtros: Record<string, string>[] = [];
    const grupamentoId = acesso?.grupamento_id || null;
    const subgrupamentoId = acesso?.subgrupamento_id || null;
    if (tipo === 'setor' && grupamentoId) {
      filtros.push({ grupamento_id: grupamentoId });
      criteriosAplicados.add('setor');
    } else if ((tipo === 'subsetor' || tipo === 'unidade') && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
      criteriosAplicados.add(tipo);
      if (tipo === 'subsetor') {
        try {
          const filhos = await fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }), `subgrupamento.parent:${subgrupamentoId}`);
          for (const filho of (filhos || [])) {
            if (filho?.id) filtros.push({ estrutura_id: filho.id }, { subgrupamento_id: filho.id });
          }
        } catch (_error) {
          // Mantém escopo principal quando a carga de filhos falhar.
        }
      }
    }

    for (const filtro of filtros) {
      try {
        const militares = await fetchWithRetry(
          () => base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, ['id']),
          `militar.escopo:${JSON.stringify(filtro)}`,
        );
        for (const militar of (militares || [])) if (militar?.id) ids.add(String(militar.id));
      } catch (_error) {
        // Segue com filtros que responderem.
      }
    }
  }
  return Array.from(ids);
}

function normalizarStatusContratoDesignacao(status: unknown) {
  const raw = normalizeTipo(status).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['ativo', 'ativa', 'active'].includes(raw)) return 'ativo';
  if (['encerrado', 'encerrada', 'finalizado', 'finalizada'].includes(raw)) return 'encerrado';
  if (['cancelado', 'cancelada'].includes(raw)) return 'cancelado';
  return raw;
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

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPeriodoRef(periodo: any) {
  return periodo?.periodo_aquisitivo_ref || periodo?.ano_referencia || '';
}

function feriasVinculadaAoPeriodo(ferias: any, periodo: any) {
  const periodoId = getId(periodo);
  const periodoRef = getPeriodoRef(periodo);
  if (periodoId && ferias?.periodo_aquisitivo_id && String(ferias.periodo_aquisitivo_id) === String(periodoId)) return true;
  if (periodoRef && ferias?.periodo_aquisitivo_ref && String(ferias.periodo_aquisitivo_ref) === String(periodoRef)) return true;
  return false;
}

function resumoPeriodo(periodo: any) {
  const fim = normalizeDateOnly(periodo?.fim_aquisitivo);
  return {
    id: getId(periodo),
    ano_referencia: periodo?.ano_referencia || periodo?.periodo_aquisitivo_ref || null,
    inicio_aquisitivo: normalizeDateOnly(periodo?.inicio_aquisitivo) || periodo?.inicio_aquisitivo || null,
    fim_aquisitivo: fim || periodo?.fim_aquisitivo || null,
    status: periodo?.status || null,
    inativo: periodo?.inativo === true,
    dias_saldo: toNumber(periodo?.dias_saldo),
    origem_periodo: periodo?.origem_periodo || null,
    updated_date: periodo?.updated_date || periodo?.updated_at || null,
  };
}

function classificarPrevia({ militarId, dataBase, periodos, ferias }: any) {
  const candidatos: any[] = [];
  const ignorados: any[] = [];
  const jaMarcados: any[] = [];
  const riscos: any[] = [];
  const periodosDoMilitar = (periodos || []).filter((periodo: any) => String(periodo?.militar_id || '') === String(militarId));
  const feriasDoMilitar = (ferias || []).filter((item: any) => String(item?.militar_id || '') === String(militarId));

  periodosDoMilitar.forEach((periodo: any) => {
    const fim = normalizeDateOnly(periodo?.fim_aquisitivo);
    const resumo = resumoPeriodo(periodo);

    if (Boolean(periodo?.legado_ativa)) {
      jaMarcados.push({ ...resumo, motivo: 'ja_marcado_legado_ativa' });
      ignorados.push({ ...resumo, motivo: 'ja_marcado_legado_ativa' });
      return;
    }
    if (!fim) {
      ignorados.push({ ...resumo, motivo: 'fim_aquisitivo_invalido' });
      return;
    }
    if (periodo?.inativo === true) {
      ignorados.push({ ...resumo, motivo: 'periodo_inativo' });
      return;
    }
    if (compareDateOnly(fim, dataBase) !== -1) {
      ignorados.push({ ...resumo, motivo: 'fim_aquisitivo_maior_ou_igual_data_base' });
      return;
    }

    const feriasRelacionadas = feriasDoMilitar.filter((item: any) => feriasVinculadaAoPeriodo(item, periodo));
    const codigosRisco: string[] = [];
    if (resumo.dias_saldo > 0) codigosRisco.push('saldo_aberto');
    if (feriasRelacionadas.length > 0) codigosRisco.push('ferias_vinculadas');
    if (feriasRelacionadas.some((item: any) => item?.status === 'Em Curso')) codigosRisco.push('ferias_em_curso');
    if (feriasRelacionadas.some((item: any) => STATUS_FERIAS_PREVISTA_AUTORIZADA.includes(item?.status))) codigosRisco.push('ferias_prevista_ou_autorizada');
    if (!STATUS_FINALIZADOS.includes(periodo?.status)) codigosRisco.push('status_nao_finalizado');
    if (periodo?.status === 'Pago') codigosRisco.push('status_pago_nao_previsto');

    const feriasHash = feriasRelacionadas.map((item: any) => ({
      id: getId(item),
      status: item?.status || null,
      data_inicio: normalizeDateOnly(item?.data_inicio) || item?.data_inicio || null,
      data_fim: normalizeDateOnly(item?.data_fim) || item?.data_fim || null,
      updated_date: item?.updated_date || item?.updated_at || null,
    })).sort((a: any, b: any) => String(a.id || '').localeCompare(String(b.id || '')));

    candidatos.push({ ...resumo, ferias_vinculadas: feriasRelacionadas.length, ferias_hash: feriasHash, riscos: codigosRisco });
    codigosRisco.forEach((codigo) => {
      riscos.push({
        periodo_id: resumo.id,
        periodo_ref: resumo.ano_referencia,
        codigo,
        bloqueante: RISCOS_BLOQUEANTES.has(codigo),
      });
    });
  });

  return {
    candidatos,
    ignorados,
    jaMarcados,
    riscos,
    totais: {
      periodos_analisados: periodosDoMilitar.length,
      candidatos: candidatos.length,
      ignorados: ignorados.length,
      ja_marcados: jaMarcados.length,
      com_saldo_aberto: candidatos.filter((item) => item.riscos.includes('saldo_aberto')).length,
      com_ferias_vinculadas: candidatos.filter((item) => item.riscos.includes('ferias_vinculadas')).length,
      bloqueantes: riscos.filter((item) => item.bloqueante).length,
    },
  };
}

function ordenarPorId(lista: any[]) {
  return [...(lista || [])].sort((a, b) => String(a?.id || a?.periodo_id || '').localeCompare(String(b?.id || b?.periodo_id || '')));
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function calcularPreviewHash({ militarId, contratoDesignacaoId, dataBase, classificacao }: any) {
  const base = {
    militar_id: militarId,
    contrato_designacao_id: contratoDesignacaoId,
    data_base: dataBase,
    candidatos: ordenarPorId(classificacao.candidatos).map((item: any) => ({
      id: item.id,
      fim_aquisitivo: item.fim_aquisitivo,
      status: item.status,
      inativo: item.inativo,
      dias_saldo: item.dias_saldo,
      origem_periodo: item.origem_periodo,
      updated_date: item.updated_date || null,
      riscos: [...(item.riscos || [])].sort(),
      ferias_hash: item.ferias_hash || [],
    })),
    riscos_bloqueantes: ordenarPorId((classificacao.riscos || []).filter((item: any) => item.bloqueante)).map((item: any) => ({
      periodo_id: item.periodo_id,
      codigo: item.codigo,
    })),
    totais: classificacao.totais || {},
  };
  return sha256Hex(JSON.stringify(base));
}

function erroAplicacao(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, error: message, ...extra, meta: { status, ...(extra.meta as any || {}) } }, { status });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return erroAplicacao('Não autenticado.', 401);

    let payload: any = {};
    try { payload = await req.json(); } catch (_error) { payload = {}; }

    const militarId = payload?.militar_id ? String(payload.militar_id).trim() : '';
    const contratoDesignacaoId = payload?.contrato_designacao_id ? String(payload.contrato_designacao_id).trim() : '';
    const confirmacaoTextual = String(payload?.confirmacao_textual || '');
    const previewHashInformado = payload?.preview_hash ? String(payload.preview_hash).trim() : null;
    if (!militarId) return erroAplicacao('militar_id é obrigatório.', 400);
    if (!contratoDesignacaoId) return erroAplicacao('contrato_designacao_id é obrigatório.', 400);
    if (confirmacaoTextual !== CONFIRMACAO_TEXTUAL) return erroAplicacao(`Confirmação textual inválida. Digite exatamente: ${CONFIRMACAO_TEXTUAL}`, 400);

    const authUserEmail = normalizeEmail(authUser.email);
    const effectiveEmailNorm = normalizeEmail(payload?.effectiveEmail);
    const wantsImpersonation = Boolean(effectiveEmailNorm) && effectiveEmailNorm !== authUserEmail;
    const authPerms = await resolverPermissoes(base44, authUser.email);
    const authIsAdmin = String(authUser.role || '').toLowerCase() === 'admin' || authPerms.isAdminByAccess;
    if (wantsImpersonation && !authIsAdmin) {
      return erroAplicacao('Ação não permitida: somente administradores podem usar effectiveEmail.', 403);
    }

    const isImpersonating = wantsImpersonation && authIsAdmin;
    const targetEmail = isImpersonating ? effectiveEmailNorm : authUser.email;
    const targetPerms = isImpersonating ? await resolverPermissoes(base44, targetEmail) : authPerms;
    const targetIsAdmin = isImpersonating ? targetPerms.isAdminByAccess : authIsAdmin;
    const criteriosAplicados = new Set<string>();
    const warnings: string[] = [];
    const actions = targetPerms.actions || {};
    const hasFallbackPermission = actions.gerir_cadeia_ferias === true && actions.gerir_contratos_designacao === true;
    const hasSensitivePermission = actions.aplicar_transicao_legado_ativa === true || hasFallbackPermission;

    if (!targetIsAdmin && !hasSensitivePermission) {
      return erroAplicacao('Acesso negado: permissão funcional insuficiente.', 403, { requiredPermission: 'aplicar_transicao_legado_ativa ou gerir_cadeia_ferias + gerir_contratos_designacao' });
    }

    if (!targetIsAdmin) {
      const militarIds = await listarMilitarIdsDoEscopo(base44, targetPerms.acessos, criteriosAplicados);
      if (!militarIds || militarIds.length === 0) {
        return erroAplicacao('Acesso negado: usuário sem escopo militar.', 403, { meta: { warnings: ['SEM_ESCOPO'] } });
      }
      if (!new Set(militarIds.map(String)).has(militarId)) {
        return erroAplicacao('Acesso negado: militar fora do seu escopo.', 403);
      }
    } else {
      criteriosAplicados.add('admin');
    }

    const [militares, contratos] = await Promise.all([
      fetchWithRetry(() => base44.asServiceRole.entities.Militar.filter({ id: militarId }, undefined, 1, 0), `Militar.id:${militarId}`),
      fetchWithRetry(() => base44.asServiceRole.entities.ContratoDesignacaoMilitar.filter({ id: contratoDesignacaoId }, undefined, 1, 0), `ContratoDesignacaoMilitar.id:${contratoDesignacaoId}`),
    ]);
    const militar = militares?.[0] || null;
    const contrato = contratos?.[0] || null;
    if (!militar) return erroAplicacao('Militar não encontrado.', 404);
    if (!contrato) return erroAplicacao('Contrato de designação não encontrado.', 404);
    if (String(contrato?.militar_id || '') !== String(militarId)) return erroAplicacao('Contrato de designação não pertence ao militar informado.', 400, { conflitos: [{ codigo: 'contrato_inconsistente', contrato_designacao_id: contratoDesignacaoId }] });
    if (normalizarStatusContratoDesignacao(contrato?.status_contrato) !== 'ativo') return erroAplicacao('Contrato de designação precisa estar ativo para aplicar a transição.', 400, { riscos: [{ codigo: 'contrato_nao_ativo', bloqueante: true }] });

    const dataBase = normalizeDateOnly(contrato?.data_inclusao_para_ferias);
    if (!dataBase) return erroAplicacao('Contrato ativo sem data_inclusao_para_ferias válida.', 400, { riscos: [{ codigo: 'data_base_invalida', bloqueante: true }] });
    const dataInicioContrato = contrato?.data_inicio_contrato ? normalizeDateOnly(contrato.data_inicio_contrato) : null;
    if (contrato?.data_inicio_contrato && !dataInicioContrato) return erroAplicacao('Data de início do contrato de designação inválida.', 400, { riscos: [{ codigo: 'contrato_inconsistente', bloqueante: true }] });
    if (dataInicioContrato && compareDateOnly(dataBase, dataInicioContrato) === -1) return erroAplicacao('Data-base de férias do contrato é anterior à data de início do contrato.', 400, { riscos: [{ codigo: 'contrato_inconsistente', bloqueante: true }] });

    const [periodos, ferias] = await Promise.all([
      fetchWithRetry(() => base44.asServiceRole.entities.PeriodoAquisitivo.filter({ militar_id: militarId }, '-inicio_aquisitivo', 1000, 0), `PeriodoAquisitivo.militar:${militarId}`),
      fetchWithRetry(() => base44.asServiceRole.entities.Ferias.filter({ militar_id: militarId }, '-data_inicio', 1000, 0), `Ferias.militar:${militarId}`),
    ]);

    const classificacao = classificarPrevia({ militarId, dataBase, periodos: periodos || [], ferias: ferias || [] });
    const previewHashRecalculado = await calcularPreviewHash({ militarId, contratoDesignacaoId, dataBase, classificacao });
    if (previewHashInformado && previewHashInformado !== previewHashRecalculado) {
      return erroAplicacao('Prévia divergente. Gere uma nova prévia antes de aplicar a transição.', 409, {
        conflitos: [{ codigo: 'preview_divergente', preview_hash_informado: previewHashInformado, preview_hash_recalculado: previewHashRecalculado }],
      });
    }
    if (!previewHashInformado) warnings.push('PREVIEW_RECALCULADA_SEM_HASH');

    const riscosBloqueantes = (classificacao.riscos || []).filter((risco: any) => risco.bloqueante);
    if (riscosBloqueantes.length > 0) {
      return erroAplicacao('Existem riscos bloqueantes na prévia recalculada. A transição não foi aplicada.', 400, {
        riscos: classificacao.riscos,
        totais: { ...classificacao.totais, aplicados: 0, conflitos: 0, bloqueantes: riscosBloqueantes.length },
      });
    }

    const periodosPorId = new Map((periodos || []).map((periodo: any) => [String(getId(periodo)), periodo]));
    const conflitos: any[] = [];
    const jaMarcados: any[] = [];
    const aplicaveis: any[] = [];

    for (const periodo of periodos || []) {
      if (!periodo?.legado_ativa) continue;
      const fim = normalizeDateOnly(periodo?.fim_aquisitivo);
      if (!fim || periodo?.inativo === true || compareDateOnly(fim, dataBase) !== -1) continue;
      const mesmoContrato = String(periodo?.legado_ativa_contrato_designacao_id || '') === String(contratoDesignacaoId);
      const mesmaDataBase = String(normalizeDateOnly(periodo?.legado_ativa_data_base) || '') === String(dataBase);
      if (mesmoContrato && mesmaDataBase) jaMarcados.push({ ...resumoPeriodo(periodo), motivo: 'ja_marcado_mesmo_contrato_data_base' });
      else conflitos.push({ ...resumoPeriodo(periodo), codigo: 'conflito_legado_outro_contrato_ou_data_base', legado_ativa_contrato_designacao_id: periodo?.legado_ativa_contrato_designacao_id || null, legado_ativa_data_base: periodo?.legado_ativa_data_base || null });
    }

    for (const candidato of classificacao.candidatos || []) {
      const periodo = periodosPorId.get(String(candidato.id));
      if (!periodo) continue;
      if (Boolean(periodo?.legado_ativa)) {
        const mesmoContrato = String(periodo?.legado_ativa_contrato_designacao_id || '') === String(contratoDesignacaoId);
        const mesmaDataBase = String(normalizeDateOnly(periodo?.legado_ativa_data_base) || '') === String(dataBase);
        if (mesmoContrato && mesmaDataBase) jaMarcados.push({ ...resumoPeriodo(periodo), motivo: 'ja_marcado_mesmo_contrato_data_base' });
        else conflitos.push({ ...resumoPeriodo(periodo), codigo: 'conflito_legado_outro_contrato_ou_data_base', legado_ativa_contrato_designacao_id: periodo?.legado_ativa_contrato_designacao_id || null, legado_ativa_data_base: periodo?.legado_ativa_data_base || null });
        continue;
      }
      aplicaveis.push(periodo);
    }

    if (conflitos.length > 0) {
      return erroAplicacao('Conflito de idempotência: há períodos marcados como legado para outro contrato ou data-base.', 409, {
        conflitos,
        riscos: [{ codigo: 'conflito_legado_com_outro_contrato_data_base', bloqueante: true }],
        totais: { ...classificacao.totais, aplicados: 0, conflitos: conflitos.length, bloqueantes: conflitos.length },
      });
    }

    const nowIso = new Date().toISOString();
    const userEmailEfetivo = normalizeEmail(targetEmail) || authUserEmail || null;
    const aplicados: any[] = [];
    for (const periodo of aplicaveis) {
      const statusAnterior = periodo?.status ?? null;
      const observacaoPadronizada = `[CD-6B] Marcado como Legado da Ativa em ${nowIso} por ${userEmailEfetivo}.\nMotivo: transição para contrato de designação ${getId(contrato)}, data-base de férias ${dataBase}.\nStatus anterior: ${statusAnterior ?? '—'}.`;
      const patch = {
        origem_periodo: 'legado_ativa',
        legado_ativa: true,
        legado_ativa_em: nowIso,
        legado_ativa_por: userEmailEfetivo,
        legado_ativa_contrato_designacao_id: getId(contrato),
        legado_ativa_data_base: dataBase,
        legado_ativa_status_anterior: statusAnterior,
        legado_ativa_inativo_anterior: periodo?.inativo ?? false,
        legado_ativa_origem_periodo_anterior: periodo?.origem_periodo || null,
        legado_ativa_excluido_da_cadeia_designacao_anterior: periodo?.excluido_da_cadeia_designacao ?? false,
        legado_ativa_observacao: observacaoPadronizada,
        legado_ativa_preview_hash: previewHashInformado || previewHashRecalculado || null,
        excluido_da_cadeia_designacao: true,
      };
      await fetchWithRetry(() => base44.asServiceRole.entities.PeriodoAquisitivo.update(getId(periodo), patch), `PeriodoAquisitivo.update:${getId(periodo)}`);
      aplicados.push({ ...resumoPeriodo(periodo), legado_ativa_em: nowIso, legado_ativa_por: userEmailEfetivo });
    }

    return Response.json({
      ok: true,
      modo: 'apply',
      aplicados,
      ignorados: classificacao.ignorados || [],
      jaMarcados,
      conflitos: [],
      riscos: classificacao.riscos || [],
      totais: {
        candidatos: classificacao.totais?.candidatos || 0,
        aplicados: aplicados.length,
        ignorados: classificacao.ignorados?.length || 0,
        ja_marcados: jaMarcados.length,
        conflitos: 0,
        bloqueantes: 0,
      },
      meta: {
        userEmail: authUserEmail || null,
        effectiveEmail: isImpersonating ? effectiveEmailNorm : null,
        appliedAt: nowIso,
        warnings,
        previewHash: previewHashRecalculado,
      },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ ok: false, error: error?.message || 'Erro ao aplicar transição legado da ativa.', meta: { status } }, { status });
  }
});
