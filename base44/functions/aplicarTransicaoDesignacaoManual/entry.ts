import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const LIMIT_USUARIO_ACESSO = 1000;
const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id', 'perfil_id'];
const CONFIRMACAO_TEXTUAL = 'APLICAR TRANSICAO POR PERIODO';
const STATUS_FINALIZADOS = ['Gozado', 'Inativo'];
const STATUS_FERIAS_PREVISTA_AUTORIZADA = ['Prevista', 'Autorizada'];
const ACOES = {
  MANTER: 'manter',
  MARCAR_LEGADO_ATIVA: 'marcar_legado_ativa',
  MARCAR_INDENIZADO: 'marcar_indenizado',
  EXCLUIR_CADEIA_OPERACIONAL: 'excluir_cadeia_operacional',
  CANCELAR_PERIODO_FUTURO_INDEVIDO: 'cancelar_periodo_futuro_indevido',
};
const ACOES_VALIDAS = new Set(Object.values(ACOES));
const RISCOS = {
  SALDO_ABERTO: 'saldo_aberto',
  FERIAS_VINCULADAS: 'ferias_vinculadas',
  FERIAS_EM_CURSO: 'ferias_em_curso',
  FERIAS_PREVISTA_OU_AUTORIZADA: 'ferias_prevista_ou_autorizada',
  STATUS_NAO_FINALIZADO: 'status_nao_finalizado',
  STATUS_PAGO_NAO_PREVISTO: 'status_pago_nao_previsto',
  PERIODO_SEM_FIM_AQUISITIVO: 'periodo_sem_fim_aquisitivo',
  JA_LEGADO_OUTRO_CONTRATO: 'ja_legado_outro_contrato',
  FUTURO_INDEVIDO: 'futuro_indevido',
};
const RISCOS_BLOQUEANTES = [
  RISCOS.FERIAS_EM_CURSO,
  RISCOS.FERIAS_PREVISTA_OU_AUTORIZADA,
  RISCOS.STATUS_PAGO_NAO_PREVISTO,
  RISCOS.PERIODO_SEM_FIM_AQUISITIVO,
  RISCOS.JA_LEGADO_OUTRO_CONTRATO,
];

const normalizeTipo = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const getId = (registro: any) => registro?.id ?? registro?._id ?? null;
const toNumber = (value: unknown) => { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; };
const json = (value: unknown) => JSON.stringify(value ?? null);

async function fetchWithRetry(queryFn: () => Promise<any>, label = 'query') {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt += 1) {
    try { return await queryFn(); } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      if (!RETRY_STATUS.has(status) || attempt === RETRY_MAX_ATTEMPTS) break;
      const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      console.warn(`[aplicarTransicaoDesignacaoManual] retry step=${label} attempt=${attempt} status=${status}`);
    }
  }
  throw lastError;
}

function erro(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, error: message, ...extra, meta: { status, ...(extra.meta as any || {}) } }, { status });
}

function extrairMatrizPermissoes(descricao: unknown) {
  if (typeof descricao !== 'string' || !descricao) return {};
  const start = descricao.indexOf('[SGP_PERMISSIONS_MATRIX]');
  const end = descricao.indexOf('[/SGP_PERMISSIONS_MATRIX]');
  if (start === -1 || end === -1 || end <= start) return {};
  try { return JSON.parse(descricao.slice(start + '[SGP_PERMISSIONS_MATRIX]'.length, end).trim()) || {}; } catch (_error) { return {}; }
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
  const acessos = await fetchWithRetry(() => base44.asServiceRole.entities.UsuarioAcesso.filter({ user_email: email, ativo: true }, undefined, LIMIT_USUARIO_ACESSO, 0, CAMPOS_USUARIO_ACESSO), `UsuarioAcesso:${email}`);
  const perfilIds = Array.from(new Set((acessos || []).map((acesso: any) => acesso?.perfil_id).filter(Boolean)));
  const perfis = perfilIds.length > 0 ? await fetchWithRetry(() => base44.asServiceRole.entities.PerfilPermissao.filter({ id: { $in: perfilIds }, ativo: true }), `PerfilPermissao:${email}`) : [];
  return { acessos: acessos || [], perfis: perfis || [], actions: consolidarActions(perfis || [], acessos || []), isAdminByAccess: (acessos || []).some((acesso: any) => normalizeTipo(acesso?.tipo_acesso) === 'admin') };
}

async function listarMilitarIdsDoEscopo(base44: any, acessos: any[], criteriosAplicados: Set<string>) {
  const ids = new Set<string>();
  for (const acesso of acessos || []) {
    const tipo = normalizeTipo(acesso?.tipo_acesso);
    if (tipo === 'admin') return null;
    if (tipo === 'proprio') { if (acesso?.militar_id) { ids.add(String(acesso.militar_id)); criteriosAplicados.add('proprio'); } continue; }
    const filtros: Record<string, string>[] = [];
    const grupamentoId = acesso?.grupamento_id || null;
    const subgrupamentoId = acesso?.subgrupamento_id || null;
    if (tipo === 'setor' && grupamentoId) { filtros.push({ grupamento_id: grupamentoId }); criteriosAplicados.add('setor'); }
    else if ((tipo === 'subsetor' || tipo === 'unidade') && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId }); criteriosAplicados.add(tipo);
      if (tipo === 'subsetor') {
        try {
          const filhos = await fetchWithRetry(() => base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }), `Subgrupamento:${subgrupamentoId}`);
          for (const filho of (filhos || [])) if (filho?.id) filtros.push({ estrutura_id: filho.id }, { subgrupamento_id: filho.id });
        } catch (_error) { /* escopo principal preservado */ }
      }
    }
    for (const filtro of filtros) {
      try {
        const militares = await fetchWithRetry(() => base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, ['id']), `Militar.escopo:${JSON.stringify(filtro)}`);
        for (const militar of (militares || [])) if (militar?.id) ids.add(String(militar.id));
      } catch (_error) { /* segue com filtros que responderem */ }
    }
  }
  return Array.from(ids);
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
const compareDateOnly = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function normalizarStatusContratoDesignacao(status: unknown) {
  const raw = normalizeTipo(status).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['ativo', 'ativa', 'active'].includes(raw)) return 'ativo';
  return raw;
}

function getPeriodoRef(periodo: any) { return periodo?.periodo_aquisitivo_ref || periodo?.ano_referencia || ''; }
function feriasVinculadaAoPeriodo(ferias: any, periodo: any) {
  const periodoId = getId(periodo); const periodoRef = getPeriodoRef(periodo);
  if (periodoId && ferias?.periodo_aquisitivo_id && String(ferias.periodo_aquisitivo_id) === String(periodoId)) return true;
  if (periodoRef && ferias?.periodo_aquisitivo_ref && String(ferias.periodo_aquisitivo_ref) === String(periodoRef)) return true;
  return false;
}
function unique(values: any[]) { return Array.from(new Set((values || []).filter(Boolean))); }
function sortPrimitiveArray(values: any[]) { return unique(values).sort((a, b) => String(a).localeCompare(String(b))); }
function resumoPeriodo(periodo: any) {
  return {
    id: getId(periodo), militar_id: periodo?.militar_id ?? null, contrato_designacao_id: periodo?.contrato_designacao_id ?? periodo?.contrato_id ?? null,
    ano_referencia: periodo?.ano_referencia || periodo?.periodo_aquisitivo_ref || null, periodo_aquisitivo_ref: periodo?.periodo_aquisitivo_ref || periodo?.ano_referencia || null,
    inicio_aquisitivo: normalizeDateOnly(periodo?.inicio_aquisitivo) || periodo?.inicio_aquisitivo || null, fim_aquisitivo: normalizeDateOnly(periodo?.fim_aquisitivo) || periodo?.fim_aquisitivo || null,
    ['status']: periodo?.status || null, inativo: periodo?.inativo === true, dias_saldo: toNumber(periodo?.dias_saldo), origem_periodo: periodo?.origem_periodo || null,
    legado_ativa: periodo?.legado_ativa === true, excluido_da_cadeia_designacao: periodo?.excluido_da_cadeia_designacao === true, updated_date: periodo?.updated_date || periodo?.updated_at || null,
  };
}
function resumoFerias(ferias: any) { return { id: getId(ferias), ['status']: ferias?.status || null, periodo_aquisitivo_id: ferias?.periodo_aquisitivo_id || null, periodo_aquisitivo_ref: ferias?.periodo_aquisitivo_ref || null, updated_date: ferias?.updated_date || ferias?.updated_at || null }; }
function resolverAcoesPermitidas(situacaoAtual: string, bloqueantes: string[]) {
  if (bloqueantes.length > 0) return [ACOES.MANTER];
  if (situacaoAtual === 'ja_legado' || situacaoAtual === 'inativo') return [ACOES.MANTER];
  if (situacaoAtual === 'futuro_pos_data_base') return [ACOES.MANTER, ACOES.CANCELAR_PERIODO_FUTURO_INDEVIDO, ACOES.EXCLUIR_CADEIA_OPERACIONAL];
  if (situacaoAtual === 'anterior_data_base') return [ACOES.MANTER, ACOES.MARCAR_LEGADO_ATIVA, ACOES.MARCAR_INDENIZADO, ACOES.EXCLUIR_CADEIA_OPERACIONAL];
  return [ACOES.MANTER, ACOES.EXCLUIR_CADEIA_OPERACIONAL];
}
function analisarPeriodo({ periodo, feriasDoMilitar, contrato, dataBase }: any) {
  const fim = normalizeDateOnly(periodo?.fim_aquisitivo);
  const feriasRelacionadas = (feriasDoMilitar || []).filter((item: any) => feriasVinculadaAoPeriodo(item, periodo));
  const riscos: string[] = []; const alertas: any[] = []; const conflitos: any[] = []; const motivosSugestao: string[] = [];
  if (toNumber(periodo?.dias_saldo) > 0) riscos.push(RISCOS.SALDO_ABERTO);
  if (feriasRelacionadas.length > 0) riscos.push(RISCOS.FERIAS_VINCULADAS);
  if (feriasRelacionadas.some((item: any) => item?.status === 'Em Curso')) riscos.push(RISCOS.FERIAS_EM_CURSO);
  if (feriasRelacionadas.some((item: any) => STATUS_FERIAS_PREVISTA_AUTORIZADA.includes(item?.status))) riscos.push(RISCOS.FERIAS_PREVISTA_OU_AUTORIZADA);
  if (periodo?.status && !STATUS_FINALIZADOS.includes(periodo.status)) riscos.push(RISCOS.STATUS_NAO_FINALIZADO);
  if (periodo?.status === 'Pago') riscos.push(RISCOS.STATUS_PAGO_NAO_PREVISTO);
  let situacaoAtual = 'operacional'; let acaoSugerida = ACOES.MANTER;
  if (periodo?.legado_ativa === true) { situacaoAtual = 'ja_legado'; motivosSugestao.push('periodo_ja_marcado_como_legado_ativa'); }
  else if (!fim) { situacaoAtual = 'sem_fim_aquisitivo'; riscos.push(RISCOS.PERIODO_SEM_FIM_AQUISITIVO); motivosSugestao.push('fim_aquisitivo_invalido_ou_ausente'); }
  else if (periodo?.inativo === true) { situacaoAtual = 'inativo'; motivosSugestao.push('periodo_inativo_nao_deve_ser_alterado'); }
  else if (riscos.includes(RISCOS.FERIAS_EM_CURSO)) { situacaoAtual = 'com_ferias_em_curso'; motivosSugestao.push('ferias_em_curso_impede_sugestao_operacional'); }
  else if (riscos.includes(RISCOS.FERIAS_PREVISTA_OU_AUTORIZADA)) { situacaoAtual = 'com_ferias_prevista_ou_autorizada'; motivosSugestao.push('ferias_prevista_ou_autorizada_impede_sugestao_operacional'); }
  else if (dataBase && compareDateOnly(fim, dataBase) === -1) { situacaoAtual = 'anterior_data_base'; acaoSugerida = ACOES.MARCAR_LEGADO_ATIVA; motivosSugestao.push('fim_aquisitivo_anterior_a_data_base'); }
  else if (dataBase && compareDateOnly(fim, dataBase) >= 0) { situacaoAtual = 'futuro_pos_data_base'; acaoSugerida = ACOES.CANCELAR_PERIODO_FUTURO_INDEVIDO; riscos.push(RISCOS.FUTURO_INDEVIDO); motivosSugestao.push('fim_aquisitivo_maior_ou_igual_a_data_base'); }
  const contratoIdPeriodo = periodo?.contrato_designacao_id || periodo?.contrato_id || null;
  const contratoIdAtual = getId(contrato);
  if (periodo?.legado_ativa === true && contratoIdPeriodo && contratoIdAtual && String(contratoIdPeriodo) !== String(contratoIdAtual)) { riscos.push(RISCOS.JA_LEGADO_OUTRO_CONTRATO); conflitos.push({ codigo: RISCOS.JA_LEGADO_OUTRO_CONTRATO }); situacaoAtual = 'conflito'; }
  const riscosUnicos = sortPrimitiveArray(riscos);
  const bloqueantes = riscosUnicos.filter((codigo) => RISCOS_BLOQUEANTES.includes(codigo));
  bloqueantes.forEach((codigo) => alertas.push({ codigo }));
  if (riscosUnicos.includes(RISCOS.SALDO_ABERTO)) alertas.push({ codigo: RISCOS.SALDO_ABERTO });
  const acoesPermitidas = resolverAcoesPermitidas(situacaoAtual, bloqueantes);
  if (!acoesPermitidas.includes(acaoSugerida)) acaoSugerida = ACOES.MANTER;
  return { periodoId: getId(periodo), periodo: resumoPeriodo(periodo), feriasVinculadas: feriasRelacionadas.map(resumoFerias), situacaoAtual, acaoSugerida, acoesPermitidas, riscos: riscosUnicos, alertas, conflitos, bloqueantes, motivosSugestao };
}
function stableValue(value: any): any { if (Array.isArray(value)) return value.map(stableValue); if (!value || typeof value !== 'object') return value; return Object.keys(value).sort().reduce((acc: any, key) => { acc[key] = stableValue(value[key]); return acc; }, {}); }
function fnv1aHash(input: string) { let hash = 0x811c9dc5; for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; } return hash.toString(16).padStart(8, '0'); }
function analisarManual({ militar, contrato, periodos, ferias, dataBase }: any) {
  const militarId = getId(militar) || contrato?.militar_id || null;
  const periodosDoMilitar = (periodos || []).filter((periodo: any) => !militarId || String(periodo?.militar_id || militarId) === String(militarId));
  const feriasDoMilitar = (ferias || []).filter((item: any) => !militarId || String(item?.militar_id || militarId) === String(militarId));
  const analise = periodosDoMilitar.map((periodo: any) => analisarPeriodo({ periodo, feriasDoMilitar, contrato, dataBase })).sort((a: any, b: any) => String(a.periodo?.inicio_aquisitivo || a.periodoId || '').localeCompare(String(b.periodo?.inicio_aquisitivo || b.periodoId || '')));
  const riscos = analise.flatMap((item: any) => item.riscos.map((codigo: string) => ({ periodo_id: item.periodoId, periodo_ref: item.periodo?.periodo_aquisitivo_ref, codigo, bloqueante: item.bloqueantes.includes(codigo) })));
  const alertas = analise.flatMap((item: any) => item.alertas.map((alerta: any) => ({ periodo_id: item.periodoId, ...alerta })));
  const conflitos = analise.flatMap((item: any) => item.conflitos.map((conflito: any) => ({ periodo_id: item.periodoId, ...conflito })));
  const bloqueantes = analise.flatMap((item: any) => item.bloqueantes.map((codigo: string) => ({ periodo_id: item.periodoId, periodo_ref: item.periodo?.periodo_aquisitivo_ref, codigo })));
  const totais = { periodos_analisados: analise.length, acoes_sugeridas: analise.reduce((acc: any, item: any) => ({ ...acc, [item.acaoSugerida]: (acc[item.acaoSugerida] || 0) + 1 }), {}), riscos: riscos.length, alertas: alertas.length, conflitos: conflitos.length, bloqueantes: bloqueantes.length, com_saldo_aberto: analise.filter((item: any) => item.riscos.includes(RISCOS.SALDO_ABERTO)).length, com_ferias_vinculadas: analise.filter((item: any) => item.riscos.includes(RISCOS.FERIAS_VINCULADAS)).length };
  const canonical = stableValue({ militar_id: getId(militar) || null, contrato_designacao_id: getId(contrato) || null, data_base: dataBase, periodos: analise.map((item: any) => ({ periodo_id: item.periodoId, inicio_aquisitivo: item.periodo?.inicio_aquisitivo || null, fim_aquisitivo: item.periodo?.fim_aquisitivo || null, status: item.periodo?.status || null, inativo: item.periodo?.inativo === true, dias_saldo: toNumber(item.periodo?.dias_saldo), origem_periodo: item.periodo?.origem_periodo || null, legado_ativa: item.periodo?.legado_ativa === true, excluido_da_cadeia_designacao: item.periodo?.excluido_da_cadeia_designacao === true, updated_date: item.periodo?.updated_date || null, ferias_vinculadas: (item.feriasVinculadas || []).map((f: any) => ({ id: getId(f), status: f?.status || null, periodo_aquisitivo_id: f?.periodo_aquisitivo_id || null, periodo_aquisitivo_ref: f?.periodo_aquisitivo_ref || null, updated_date: f?.updated_date || null })).sort((a: any, b: any) => String(a.id || a.periodo_aquisitivo_ref || '').localeCompare(String(b.id || b.periodo_aquisitivo_ref || ''))), acao_sugerida: item.acaoSugerida || null, riscos: sortPrimitiveArray(item.riscos), bloqueantes: sortPrimitiveArray(item.bloqueantes) })).sort((a: any, b: any) => String(a.periodo_id || a.fim_aquisitivo || '').localeCompare(String(b.periodo_id || b.fim_aquisitivo || ''))), totais });
  return { periodos: analise, riscos, alertas, conflitos, bloqueantes, totais, previewHash: `fnv1a:${fnv1aHash(JSON.stringify(canonical))}` };
}
async function sha256Hex(value: string) { const bytes = new TextEncoder().encode(value); const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
function canonicalizarAcoes(acoes: any[]) { return [...acoes].map((acao) => ({ periodo_id: String(acao?.periodo_id || '').trim(), acao: String(acao?.acao || ACOES.MANTER).trim(), motivo: String(acao?.motivo || '').trim(), observacao: String(acao?.observacao || '').trim(), documento: acao?.documento ?? null, dias_indenizados: toNumber(acao?.dias_indenizados), override_sugestao: acao?.override_sugestao === true, sugestao_original: acao?.sugestao_original || null })).sort((a, b) => String(a.periodo_id).localeCompare(String(b.periodo_id))); }
async function calcularRequestHash(payload: any) { return `sha256:${await sha256Hex(JSON.stringify(stableValue({ militar_id: payload.militar_id, contrato_designacao_id: payload.contrato_designacao_id, preview_hash: payload.preview_hash, confirmacao_textual: payload.confirmacao_textual, acoes: canonicalizarAcoes(payload.acoes || []) })))}`; }
function documentoValido(documento: any) { if (typeof documento === 'string') return documento.trim().length > 0; if (documento && typeof documento === 'object') return Object.values(documento).some((value) => String(value || '').trim().length > 0); return false; }
function comporEstadoPosterior(periodo: any, patch: any) { return { ...periodo, ...patch }; }
function basePatch({ acao, loteId, nowIso, userEmail, motivo, contratoId, previewHash }: any) { return { acao_transicao_designacao: acao, transicao_designacao_lote_id: loteId, transicao_designacao_em: nowIso, transicao_designacao_por: userEmail, transicao_designacao_motivo: motivo || null, transicao_designacao_contrato_id: contratoId, transicao_designacao_preview_hash: previewHash }; }
function patchParaAcao({ acao, periodo, loteId, nowIso, userEmail, motivo, observacao, documento, diasIndenizados, contrato, dataBase, previewHash }: any) {
  const comum = basePatch({ acao, loteId, nowIso, userEmail, motivo, contratoId: getId(contrato), previewHash });
  if (acao === ACOES.MARCAR_LEGADO_ATIVA) return { ...comum, origem_periodo: 'legado_ativa', legado_ativa: true, excluido_da_cadeia_designacao: true, legado_ativa_em: nowIso, legado_ativa_por: userEmail, legado_ativa_contrato_designacao_id: getId(contrato), legado_ativa_data_base: dataBase, legado_ativa_status_anterior: periodo?.status ?? null, legado_ativa_inativo_anterior: periodo?.inativo ?? false, legado_ativa_origem_periodo_anterior: periodo?.origem_periodo || null, legado_ativa_excluido_da_cadeia_designacao_anterior: periodo?.excluido_da_cadeia_designacao ?? false, legado_ativa_observacao: observacao || null, legado_ativa_preview_hash: previewHash };
  if (acao === ACOES.MARCAR_INDENIZADO) return { ...comum, indenizado_transicao: true, indenizado_transicao_em: nowIso, indenizado_transicao_por: userEmail, indenizado_transicao_motivo: motivo, indenizado_transicao_documento: typeof documento === 'string' ? documento : json(documento), indenizado_transicao_dias: diasIndenizados, indenizado_transicao_observacao: observacao || null, excluido_da_cadeia_designacao: true };
  if (acao === ACOES.EXCLUIR_CADEIA_OPERACIONAL) return { ...comum, excluido_da_cadeia_designacao: true };
  if (acao === ACOES.CANCELAR_PERIODO_FUTURO_INDEVIDO) return { ...comum, cancelado_transicao: true, cancelado_transicao_em: nowIso, cancelado_transicao_por: userEmail, cancelado_transicao_motivo: motivo, cancelado_transicao_contrato_designacao_id: getId(contrato), cancelado_transicao_data_base: dataBase, excluido_da_cadeia_designacao: true };
  return {};
}
async function carregarOperacoes(base44: any, loteId: string) { return fetchWithRetry(() => base44.asServiceRole.entities.TransicaoDesignacaoOperacao.filter({ lote_id: loteId }, undefined, 1000, 0), `Operacao.lote:${loteId}`); }
async function atualizarLote(base44: any, lote: any, patch: any) { return fetchWithRetry(() => base44.asServiceRole.entities.TransicaoDesignacaoLote.update(getId(lote), patch), `Lote.update:${getId(lote)}`); }
async function retornoDeLote(base44: any, lote: any, metaExtra: any = {}) {
  const operacoes = await carregarOperacoes(base44, getId(lote));
  let totais: any = {}; try { totais = lote?.totais_json ? JSON.parse(lote.totais_json) : {}; } catch (_error) { totais = {}; }
  return Response.json({ ok: lote?.status === 'aplicado', modo: 'apply_manual', lote: { id: getId(lote), status: lote?.status, preview_hash: lote?.preview_hash, idempotency_key: lote?.idempotency_key }, operacoes: operacoes || [], totais, meta: { previewHash: lote?.preview_hash || null, warnings: [], ...metaExtra } }, { status: lote?.status === 'aplicado' ? 200 : 409 });
}

Deno.serve(async (req) => {
  let loteAtual: any = null;
  let aplicacoesExecutadas = 0;
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return erro('Não autenticado.', 401);
    let payload: any = {}; try { payload = await req.json(); } catch (_error) { payload = {}; }
    const militarId = payload?.militar_id ? String(payload.militar_id).trim() : '';
    const contratoDesignacaoId = payload?.contrato_designacao_id ? String(payload.contrato_designacao_id).trim() : '';
    const previewHash = payload?.preview_hash ? String(payload.preview_hash).trim() : '';
    const idempotencyKey = payload?.idempotency_key ? String(payload.idempotency_key).trim() : '';
    const confirmacaoTextual = String(payload?.confirmacao_textual || '');
    const acoesInput = payload?.acoes;
    if (!militarId) return erro('militar_id é obrigatório.', 400);
    if (!contratoDesignacaoId) return erro('contrato_designacao_id é obrigatório.', 400);
    if (!previewHash) return erro('preview_hash_obrigatorio', 400, { codigo: 'preview_hash_obrigatorio' });
    if (!idempotencyKey) return erro('idempotency_key_obrigatorio', 400, { codigo: 'idempotency_key_obrigatorio' });
    if (confirmacaoTextual !== CONFIRMACAO_TEXTUAL) return erro(`Confirmação textual inválida. Digite exatamente: ${CONFIRMACAO_TEXTUAL}`, 400, { codigo: 'confirmacao_textual_invalida' });
    if (!Array.isArray(acoesInput)) return erro('acoes deve ser array.', 400, { codigo: 'acoes_invalidas' });
    const acoes = canonicalizarAcoes(acoesInput);
    const duplicados = acoes.map((a) => a.periodo_id).filter((id, index, arr) => !id || arr.indexOf(id) !== index);
    if (duplicados.length > 0) return erro('Não é permitido informar ação duplicada para o mesmo periodo_id.', 400, { codigo: 'acao_duplicada', duplicados: unique(duplicados) });
    const requestHash = await calcularRequestHash({ militar_id: militarId, contrato_designacao_id: contratoDesignacaoId, preview_hash: previewHash, confirmacao_textual: confirmacaoTextual, acoes });

    const lotesExistentes = await fetchWithRetry(() => base44.asServiceRole.entities.TransicaoDesignacaoLote.filter({ idempotency_key: idempotencyKey }, '-criado_em', 1, 0), `Lote.idempotency:${idempotencyKey}`);
    const loteExistente = lotesExistentes?.[0] || null;
    if (loteExistente) {
      if (loteExistente.request_hash && loteExistente.request_hash !== requestHash) return erro('idempotency_payload_divergente', 409, { codigo: 'idempotency_payload_divergente', lote_id: getId(loteExistente) });
      if (loteExistente.status === 'aplicado' || loteExistente.status === 'falhou_validacao') return retornoDeLote(base44, loteExistente, { idempotentReplay: true });
      if (loteExistente.status === 'validando' || loteExistente.status === 'aplicando') return erro('Operação em andamento para a idempotency_key informada.', 423, { codigo: 'operacao_em_andamento', lote_id: getId(loteExistente) });
      return retornoDeLote(base44, loteExistente, { idempotentReplay: true });
    }

    const authUserEmail = normalizeEmail(authUser.email);
    const effectiveEmailNorm = normalizeEmail(payload?.effectiveEmail);
    const wantsImpersonation = Boolean(effectiveEmailNorm) && effectiveEmailNorm !== authUserEmail;
    const authPerms = await resolverPermissoes(base44, authUser.email);
    const authIsAdmin = String(authUser.role || '').toLowerCase() === 'admin' || authPerms.isAdminByAccess;
    if (wantsImpersonation && !authIsAdmin) return erro('Ação não permitida: somente administradores podem usar effectiveEmail.', 403);
    const isImpersonating = wantsImpersonation && authIsAdmin;
    const targetEmail = isImpersonating ? effectiveEmailNorm : authUser.email;
    const targetPerms = isImpersonating ? await resolverPermissoes(base44, targetEmail) : authPerms;
    const targetIsAdmin = isImpersonating ? targetPerms.isAdminByAccess : authIsAdmin;
    const actions = targetPerms.actions || {};
    const hasFallbackDuplo = actions.gerir_cadeia_ferias === true && actions.gerir_contratos_designacao === true;
    const hasSensitivePermission = actions.aplicar_transicao_designacao_manual === true || actions.aplicar_transicao_legado_ativa === true || hasFallbackDuplo;
    if (!targetIsAdmin && !hasSensitivePermission) return erro('Acesso negado: permissão funcional insuficiente.', 403, { requiredPermission: 'aplicar_transicao_designacao_manual, aplicar_transicao_legado_ativa ou gerir_cadeia_ferias + gerir_contratos_designacao' });
    const criteriosAplicados = new Set<string>();
    if (!targetIsAdmin) {
      const militarIds = await listarMilitarIdsDoEscopo(base44, targetPerms.acessos, criteriosAplicados);
      if (!militarIds || militarIds.length === 0) return erro('Acesso negado: usuário sem escopo militar.', 403, { meta: { warnings: ['SEM_ESCOPO'] } });
      if (!new Set(militarIds.map(String)).has(militarId)) return erro('Acesso negado: militar fora do seu escopo.', 403);
    } else criteriosAplicados.add('admin');

    const nowCriacao = new Date().toISOString();
    const userEmailEfetivo = normalizeEmail(targetEmail) || authUserEmail || null;
    loteAtual = await fetchWithRetry(() => base44.asServiceRole.entities.TransicaoDesignacaoLote.create({ militar_id: militarId, contrato_designacao_id: contratoDesignacaoId, preview_hash: previewHash, idempotency_key: idempotencyKey, request_hash: requestHash, status: 'validando', criado_por: userEmailEfetivo, criado_em: nowCriacao, confirmacao_textual: confirmacaoTextual, meta_json: json({ modo: 'apply_manual', userEmail: authUserEmail, effectiveEmail: isImpersonating ? effectiveEmailNorm : null, criteriosAplicados: Array.from(criteriosAplicados) }) }), 'Lote.create');

    const [militares, contratos] = await Promise.all([
      fetchWithRetry(() => base44.asServiceRole.entities.Militar.filter({ id: militarId }, undefined, 1, 0), `Militar:${militarId}`),
      fetchWithRetry(() => base44.asServiceRole.entities.ContratoDesignacaoMilitar.filter({ id: contratoDesignacaoId }, undefined, 1, 0), `Contrato:${contratoDesignacaoId}`),
    ]);
    const militar = militares?.[0] || null; const contrato = contratos?.[0] || null;
    if (!militar) throw Object.assign(new Error('Militar não encontrado.'), { status: 404, codigo: 'militar_nao_encontrado' });
    if (!contrato) throw Object.assign(new Error('Contrato de designação não encontrado.'), { status: 404, codigo: 'contrato_nao_encontrado' });
    if (String(contrato?.militar_id || '') !== String(militarId)) throw Object.assign(new Error('Contrato de designação não pertence ao militar informado.'), { status: 400, codigo: 'contrato_militar_divergente' });
    if (normalizarStatusContratoDesignacao(contrato?.status_contrato) !== 'ativo') throw Object.assign(new Error('Contrato de designação precisa estar ativo.'), { status: 400, codigo: 'contrato_inativo' });
    const dataBase = normalizeDateOnly(contrato?.data_inclusao_para_ferias);
    if (!dataBase) throw Object.assign(new Error('Contrato ativo sem data_inclusao_para_ferias válida.'), { status: 400, codigo: 'data_base_invalida' });
    const dataInicioContrato = contrato?.data_inicio_contrato ? normalizeDateOnly(contrato.data_inicio_contrato) : null;
    if (contrato?.data_inicio_contrato && !dataInicioContrato) throw Object.assign(new Error('Data de início do contrato de designação inválida.'), { status: 400, codigo: 'data_inicio_invalida' });
    if (dataInicioContrato && compareDateOnly(dataBase, dataInicioContrato) === -1) throw Object.assign(new Error('Data-base de férias do contrato é anterior à data de início do contrato.'), { status: 400, codigo: 'data_base_anterior_inicio' });

    const [periodos, ferias] = await Promise.all([
      fetchWithRetry(() => base44.asServiceRole.entities.PeriodoAquisitivo.filter({ militar_id: militarId }, '-inicio_aquisitivo', 1000, 0), `Periodo.militar:${militarId}`),
      fetchWithRetry(() => base44.asServiceRole.entities.Ferias.filter({ militar_id: militarId }, '-data_inicio', 1000, 0), `Ferias.militar:${militarId}`),
    ]);
    const previa = analisarManual({ militar, contrato, periodos: periodos || [], ferias: ferias || [], dataBase });
    if (previewHash !== previa.previewHash) throw Object.assign(new Error('preview_divergente'), { status: 409, codigo: 'preview_divergente', detalhes: { preview_hash_informado: previewHash, preview_hash_recalculado: previa.previewHash } });
    const periodoPorId = new Map((periodos || []).map((periodo: any) => [String(getId(periodo)), periodo]));
    const analisePorId = new Map((previa.periodos || []).map((item: any) => [String(item.periodoId), item]));
    const conflitosValidacao: any[] = [];
    for (const item of acoes) {
      const periodo = periodoPorId.get(String(item.periodo_id));
      const analise = analisePorId.get(String(item.periodo_id));
      if (!periodo || !analise) { conflitosValidacao.push({ periodo_id: item.periodo_id, codigo: 'periodo_nao_encontrado' }); continue; }
      if (!ACOES_VALIDAS.has(item.acao)) conflitosValidacao.push({ periodo_id: item.periodo_id, codigo: 'acao_invalida', acao: item.acao });
      if (item.acao !== ACOES.MANTER && !analise.acoesPermitidas.includes(item.acao)) conflitosValidacao.push({ periodo_id: item.periodo_id, codigo: 'acao_fora_de_acoes_permitidas', acao: item.acao, acoesPermitidas: analise.acoesPermitidas });
      if (item.acao !== ACOES.MANTER && analise.bloqueantes.length > 0) conflitosValidacao.push({ periodo_id: item.periodo_id, codigo: 'periodo_com_bloqueantes', bloqueantes: analise.bloqueantes });
      const motivoObrigatorio = [ACOES.MARCAR_INDENIZADO, ACOES.EXCLUIR_CADEIA_OPERACIONAL, ACOES.CANCELAR_PERIODO_FUTURO_INDEVIDO].includes(item.acao) || (item.acao === ACOES.MARCAR_LEGADO_ATIVA && (analise.riscos.length > 0 || item.override_sugestao));
      if (motivoObrigatorio && !item.motivo) conflitosValidacao.push({ periodo_id: item.periodo_id, codigo: 'motivo_obrigatorio', acao: item.acao });
      if (item.acao === ACOES.MARCAR_INDENIZADO) {
        if (!documentoValido(item.documento)) conflitosValidacao.push({ periodo_id: item.periodo_id, codigo: 'documento_obrigatorio' });
        if (!(item.dias_indenizados > 0)) conflitosValidacao.push({ periodo_id: item.periodo_id, codigo: 'dias_indenizados_obrigatorio' });
        if (item.dias_indenizados > toNumber(periodo?.dias_saldo) && !(item.override_sugestao && item.motivo && documentoValido(item.documento))) conflitosValidacao.push({ periodo_id: item.periodo_id, codigo: 'dias_indenizados_maior_que_saldo', dias_indenizados: item.dias_indenizados, dias_saldo: toNumber(periodo?.dias_saldo) });
      }
    }
    if (conflitosValidacao.length > 0) {
      const nowFalha = new Date().toISOString();
      const conflitosPorPeriodo = new Map(conflitosValidacao.map((conflito: any) => [String(conflito.periodo_id), conflito]));
      for (const item of acoes) {
        const periodo = periodoPorId.get(String(item.periodo_id));
        const analise = analisePorId.get(String(item.periodo_id));
        await fetchWithRetry(() => base44.asServiceRole.entities.TransicaoDesignacaoOperacao.create({ lote_id: getId(loteAtual), militar_id: militarId, contrato_designacao_id: contratoDesignacaoId, periodo_aquisitivo_id: item.periodo_id, acao: item.acao, acao_sugerida: analise?.acaoSugerida || item.sugestao_original || null, override_sugestao: item.override_sugestao === true || (analise?.acaoSugerida && item.acao !== analise.acaoSugerida), motivo: item.motivo || null, observacao: item.observacao || null, documento_json: json(item.documento), estado_anterior_json: json(periodo ? resumoPeriodo(periodo) : null), estado_posterior_json: json(periodo ? resumoPeriodo(periodo) : null), riscos_json: json(analise?.riscos || []), alertas_json: json(analise?.alertas || []), conflitos_json: json(conflitosValidacao.filter((conflito: any) => String(conflito.periodo_id) === String(item.periodo_id))), bloqueantes_json: json(analise?.bloqueantes || []), status_operacao: conflitosPorPeriodo.has(String(item.periodo_id)) ? 'bloqueada' : 'registrada', aplicado_por: userEmailEfetivo, aplicado_em: nowFalha }), `Operacao.validacao:${item.periodo_id}`);
      }
      throw Object.assign(new Error('falhou_validacao'), { status: 400, codigo: 'falhou_validacao', detalhes: { conflitos: conflitosValidacao } });
    }

    const nowIso = new Date().toISOString();
    const operacoesRetorno: any[] = [];
    const totais = { recebidas: acoes.length, aplicadas: 0, mantidas: 0, ignoradas: 0, bloqueadas: 0, conflitos: 0 };
    for (const item of acoes) {
      const periodo = periodoPorId.get(String(item.periodo_id));
      const analise = analisePorId.get(String(item.periodo_id));
      const estadoAnterior = resumoPeriodo(periodo);
      let patch: any = {};
      let statusOperacao = 'registrada';
      if (item.acao === ACOES.MANTER) { totais.mantidas += 1; statusOperacao = 'ignorada'; }
      else {
        patch = patchParaAcao({ acao: item.acao, periodo, loteId: getId(loteAtual), nowIso, userEmail: userEmailEfetivo, motivo: item.motivo, observacao: item.observacao, documento: item.documento, diasIndenizados: item.dias_indenizados, contrato, dataBase, previewHash });
        await fetchWithRetry(() => base44.asServiceRole.entities.PeriodoAquisitivo.update(getId(periodo), patch), `Periodo.update:${getId(periodo)}`);
        totais.aplicadas += 1; aplicacoesExecutadas += 1; statusOperacao = 'aplicada';
      }
      const estadoPosterior = item.acao === ACOES.MANTER ? estadoAnterior : resumoPeriodo(comporEstadoPosterior(periodo, patch));
      const operacao = await fetchWithRetry(() => base44.asServiceRole.entities.TransicaoDesignacaoOperacao.create({ lote_id: getId(loteAtual), militar_id: militarId, contrato_designacao_id: contratoDesignacaoId, periodo_aquisitivo_id: item.periodo_id, acao: item.acao, acao_sugerida: analise?.acaoSugerida || item.sugestao_original || null, override_sugestao: item.override_sugestao === true || (analise?.acaoSugerida && item.acao !== analise.acaoSugerida), motivo: item.motivo || null, observacao: item.observacao || null, documento_json: json(item.documento), estado_anterior_json: json(estadoAnterior), estado_posterior_json: json(estadoPosterior), riscos_json: json(analise?.riscos || []), alertas_json: json(analise?.alertas || []), conflitos_json: json(analise?.conflitos || []), bloqueantes_json: json(analise?.bloqueantes || []), status_operacao: statusOperacao, aplicado_por: userEmailEfetivo, aplicado_em: nowIso }), `Operacao.create:${item.periodo_id}`);
      operacoesRetorno.push(operacao);
    }
    const loteFinalPatch = { status: 'aplicado', aplicado_por: userEmailEfetivo, aplicado_em: nowIso, totais_json: json(totais), meta_json: json({ modo: 'apply_manual', appliedAt: nowIso, userEmail: authUserEmail, effectiveEmail: isImpersonating ? effectiveEmailNorm : null, previewHash: previa.previewHash, warnings: [] }) };
    await atualizarLote(base44, loteAtual, loteFinalPatch);
    const loteFinal = { ...loteAtual, ...loteFinalPatch };
    return Response.json({ ok: true, modo: 'apply_manual', lote: { id: getId(loteFinal), status: loteFinal.status, preview_hash: previewHash, idempotency_key: idempotencyKey }, operacoes: operacoesRetorno, totais, meta: { appliedAt: nowIso, userEmail: authUserEmail || null, effectiveEmail: isImpersonating ? effectiveEmailNorm : null, previewHash: previa.previewHash, warnings: [] } });
  } catch (error) {
    const status = error?.status || error?.response?.status || 500;
    const codigo = error?.codigo || (status === 500 ? 'erro_interno' : 'falha_aplicacao');
    const detalhes = error?.detalhes || undefined;
    try {
      if (loteAtual?.id || loteAtual?._id) {
        const totaisFalha = { recebidas: 0, aplicadas: 0, mantidas: 0, ignoradas: 0, bloqueadas: 0, conflitos: Array.isArray(detalhes?.conflitos) ? detalhes.conflitos.length : 1 };
        await atualizarLote(createClientFromRequest(req), loteAtual, { status: aplicacoesExecutadas > 0 ? 'falhou_parcial' : 'falhou_validacao', aplicado_em: new Date().toISOString(), totais_json: json(totaisFalha), meta_json: json({ codigo, detalhes }) });
      }
    } catch (_loteError) { /* não mascara erro original */ }
    return erro(error?.message || 'Erro ao aplicar transição manual de designação.', status, { codigo, detalhes });
  }
});
