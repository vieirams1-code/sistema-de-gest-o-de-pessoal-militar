import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 400;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const LIMIT_USUARIO_ACESSO = 1000;
const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'perfil_id'];
const REQUIRED_ACTION = 'gerir_gratificacoes_funcao';
const OPERACOES = new Set(['criar_rascunho', 'atualizar_rascunho', 'enviar_dp', 'marcar_aguardando_publicacao', 'registrar_publicacao_nomeacao', 'criar_nomeacao_ativa', 'finalizar_gratificacao']);
const STATUS_RASCUNHO = 'rascunho';
const STATUS_SOLICITADO_DP = 'solicitado_dp';
const STATUS_AGUARDANDO_PUBLICACAO = 'aguardando_publicacao_nomeacao';
const STATUS_COTA_ATIVA = 'ativa';
const STATUS_GRATIFICACAO_ATIVA = 'nomeado_ativo';
const STATUS_DISPENSADO = 'dispensado';
const STATUS_CANCELADO = 'cancelado';
const GRATIFICACAO_FIELDS = [
  'militar_id', 'tipo_gratificacao_funcao_id', 'cota_gratificacao_funcao_id', 'funcao_gratificada',
  'numero_processo', 'observacoes', 'data_solicitacao', 'documento_solicitacao',
  'data_publicacao_nomeacao', 'data_inicio_efeitos', 'doems_nomeacao_numero', 'doems_nomeacao_edicao',
  'doems_nomeacao_link', 'ato_nomeacao_numero',
  'data_fim_efeitos', 'motivo_dispensa', 'data_publicacao_dispensa', 'doems_dispensa_numero',
  'doems_dispensa_edicao', 'doems_dispensa_link', 'ato_dispensa_numero', 'documento_solicitacao_dispensa',
];
const CAMPOS_MILITAR_SNAPSHOT = [
  'id', 'nome_completo', 'nome_guerra', 'posto_graduacao', 'quadro', 'matricula', 'lotacao',
  'lotacao_atual', 'lotacao_nome', 'unidade_nome', 'setor_nome',
];

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeTipo = (value: unknown) => String(value || '').trim().toLowerCase();
const trimString = (value: unknown) => String(value ?? '').trim();
const toNumber = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };

function withStatus(message: string, status: number) {
  const error = new Error(message);
  error['status'] = status;
  return error;
}

async function fetchWithRetry(queryFn: () => Promise<any>, label = 'query') {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt += 1) {
    try { return await queryFn(); } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      if (!RETRY_STATUS.has(status) || attempt === RETRY_MAX_ATTEMPTS) break;
      const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      console.warn(`[gerirRascunhoGratificacaoFuncao] retry step=${label} attempt=${attempt} status=${status}`);
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
    actions: consolidarActions(perfis || [], acessos || []),
    isAdminByAccess: (acessos || []).some((a: any) => normalizeTipo(a?.tipo_acesso) === 'admin'),
  };
}

function textoReferencia(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') return trimString(value.nome || value.nome_curto || value.sigla || value.label || value.descricao);
  return trimString(value);
}

function sanitizePayload(input: any = {}, operacao: string) {
  const out: Record<string, any> = {};
  for (const field of GRATIFICACAO_FIELDS) out[field] = trimString(input[field]);

  if (operacao === 'criar_rascunho' || operacao === 'atualizar_rascunho' || operacao === 'criar_nomeacao_ativa') {
    if (!out.militar_id) throw withStatus('militar_id é obrigatório.', 400);
    if (!out.funcao_gratificada) throw withStatus('funcao_gratificada é obrigatória.', 400);

    if (operacao === 'criar_nomeacao_ativa') {
      if (!out.data_solicitacao) throw withStatus('data_solicitacao é obrigatória.', 400);
    }
  }
  return out;
}

async function buscarUm(base44: ReturnType<typeof createClientFromRequest>, entityName: string, id: string, campos?: string[]) {
  const registros = await fetchWithRetry(() => base44.asServiceRole.entities[entityName].filter({ id }, undefined, 1, 0, campos), `${entityName}.get:${id}`);
  const registro = (registros || [])[0];
  if (!registro) throw withStatus(`${entityName} não encontrado.`, 404);
  return registro;
}

async function validarReferencias(base44: ReturnType<typeof createClientFromRequest>, data: Record<string, any>) {
  const [militar, tipo, cota] = await Promise.all([
    buscarUm(base44, 'Militar', data.militar_id, CAMPOS_MILITAR_SNAPSHOT),
    data.tipo_gratificacao_funcao_id ? buscarUm(base44, 'TipoGratificacaoFuncao', data.tipo_gratificacao_funcao_id) : Promise.resolve(null),
    data.cota_gratificacao_funcao_id ? buscarUm(base44, 'CotaGratificacaoFuncao', data.cota_gratificacao_funcao_id) : Promise.resolve(null),
  ]);

  if (tipo && tipo.ativo === false) throw withStatus('Tipo inativo.', 400);
  if (cota) {
    if (normalizeTipo(cota.status) !== STATUS_COTA_ATIVA) throw withStatus('Cota inativa.', 400);
    if (data.tipo_gratificacao_funcao_id && String(cota.tipo_gratificacao_funcao_id || '') !== data.tipo_gratificacao_funcao_id) {
      throw withStatus('cota_gratificacao_funcao_id deve pertencer ao tipo_gratificacao_funcao_id informado.', 400);
    }
  }


  const gratificacoesDoMilitar = await fetchWithRetry(
    () => base44.asServiceRole.entities.GratificacaoFuncao.filter({ militar_id: data.militar_id, funcao_gratificada: data.funcao_gratificada }, undefined, 100, 0, ['id', 'status']),
    `GratificacaoFuncao.militar:${data.militar_id}`,
  );
  const ativasDoMilitar = (gratificacoesDoMilitar || []).filter((item: any) => normalizeTipo(item?.status) === STATUS_GRATIFICACAO_ATIVA && item.id !== data.id);
  if (ativasDoMilitar.length > 0) throw withStatus('Já existe nomeação ativa para este militar.', 400);

  let ocupadas = 0;
  let disponiveis = 0;
  if (cota) {
    const gratificacoesDaCota = await fetchWithRetry(
      () => base44.asServiceRole.entities.GratificacaoFuncao.filter({ cota_gratificacao_funcao_id: data.cota_gratificacao_funcao_id }, undefined, 1000, 0, ['id', 'status']),
      `GratificacaoFuncao.cota:${data.cota_gratificacao_funcao_id}`,
    );
    ocupadas = (gratificacoesDaCota || []).filter((item: any) => normalizeTipo(item?.status) === STATUS_GRATIFICACAO_ATIVA).length;
    disponiveis = Math.max(toNumber(cota.quantidade_autorizada) - ocupadas, 0);
    if (!(disponiveis > 0)) throw withStatus('Sem disponibilidade de cota.', 400);
  }

  return { militar, tipo, cota, ocupadas, disponiveis };
}

function montarRegistroGratificacao(data: Record<string, any>, refs: any, authUser: any, status: string = STATUS_RASCUNHO) {
  const { militar, tipo, cota } = refs;
  const unidadeMilitar = textoReferencia(militar.lotacao_atual) || textoReferencia(militar.lotacao) || textoReferencia(militar.lotacao_nome) || textoReferencia(militar.unidade_nome);
  const setorMilitar = textoReferencia(militar.setor_nome);
  const registro: Record<string, any> = {
    militar_id: data.militar_id,
    militar_snapshot: {
      nome: militar.nome_completo || militar.nome_guerra || '',
      posto: militar.posto_graduacao || '',
      quadro: militar.quadro || '',
      matricula: militar.matricula || '',
      unidade: unidadeMilitar,
      setor: setorMilitar,
    },
    nome_completo_snapshot: militar.nome_completo || '',
    nome_guerra_snapshot: militar.nome_guerra || '',
    posto_graduacao_snapshot: militar.posto_graduacao || '',
    quadro_snapshot: militar.quadro || '',
    matricula_snapshot: militar.matricula || '',
    unidade_id: cota?.unidade_id || '',
    unidade_nome_snapshot: cota?.unidade_nome_snapshot || unidadeMilitar,
    setor_id: cota?.setor_id || '',
    setor_nome_snapshot: cota?.setor_nome_snapshot || setorMilitar,
    tipo_gratificacao_funcao_id: data.tipo_gratificacao_funcao_id || null,
    cota_gratificacao_funcao_id: data.cota_gratificacao_funcao_id || null,
    funcao_gratificada: data.funcao_gratificada,
    codigo_funcao: cota?.codigo_funcao || '',
    nivel_gratificacao: cota?.nivel_gratificacao || tipo?.nivel || '',
    tipo_gratificacao: cota?.tipo_gratificacao || tipo?.nome || tipo?.sigla || tipo?.codigo || '',
    status: status,
    data_solicitacao: data.data_solicitacao || null,
    numero_processo: data.numero_processo,
    observacoes: data.observacoes,
    solicitado_por: authUser?.email || '',
    origem_registro: status === STATUS_GRATIFICACAO_ATIVA ? 'cadastro_direto_ativa_gratificacao_funcao' : 'cadastro_rascunho_gratificacao_funcao',
    metadados: {
      fluxo_lote: '2B',
      somente_rascunho: status === STATUS_RASCUNHO,
      sem_ativacao: status === STATUS_RASCUNHO,
      sem_nomeacao: status === STATUS_RASCUNHO,
      sem_publicacao_doems: status === STATUS_RASCUNHO,
      sem_efeitos_financeiros: status === STATUS_RASCUNHO,
    },
  };

  if (status === STATUS_GRATIFICACAO_ATIVA) {
    registro.data_publicacao_nomeacao = data.data_publicacao_nomeacao || null;
    registro.data_inicio_efeitos = data.data_inicio_efeitos || null;
    registro.doems_nomeacao_numero = data.doems_nomeacao_numero || '';
    registro.doems_nomeacao_edicao = data.doems_nomeacao_edicao || '';
    registro.doems_nomeacao_link = data.doems_nomeacao_link || '';
    registro.ato_nomeacao_numero = data.ato_nomeacao_numero || '';
    registro.status_alterado_em = new Date().toISOString();
    registro.status_alterado_por = authUser.email || '';
  }

  return registro;
}

function sanitizeResponse(item: any = {}) {
  return {
    id: item.id || '', militar_id: item.militar_id || '', tipo_gratificacao_funcao_id: item.tipo_gratificacao_funcao_id || '', cota_gratificacao_funcao_id: item.cota_gratificacao_funcao_id || '',
    funcao_gratificada: item.funcao_gratificada || '', numero_processo: item.numero_processo || '', observacoes: item.observacoes || '', status: item.status || '',
    nome_completo_snapshot: item.nome_completo_snapshot || '', nome_guerra_snapshot: item.nome_guerra_snapshot || '', posto_graduacao_snapshot: item.posto_graduacao_snapshot || '', quadro_snapshot: item.quadro_snapshot || '', matricula_snapshot: item.matricula_snapshot || '',
    unidade_nome_snapshot: item.unidade_nome_snapshot || '', setor_nome_snapshot: item.setor_nome_snapshot || '', created_date: item.created_date || '', updated_date: item.updated_date || '',
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload: any = {};
    try { payload = await req.json(); } catch (_error) { payload = {}; }
    const operacao = trimString(payload?.operacao);
    if (!OPERACOES.has(operacao)) return Response.json({ error: 'Operação não permitida neste lote.' }, { status: 400 });

    const authPerms = await resolverPermissoes(base44, authUser.email);
    const authIsAdmin = String(authUser.role || '').toLowerCase() === 'admin' || authPerms.isAdminByAccess;
    const canManage = authIsAdmin || authPerms.actions?.[REQUIRED_ACTION] === true;
    if (!canManage) return Response.json({ error: 'Acesso negado: requer gerir_gratificacoes_funcao ou admin/ALL.' }, { status: 403 });

    const data = sanitizePayload(payload?.data && typeof payload.data === 'object' ? payload.data : {}, operacao);

    if (operacao === 'criar_rascunho' || operacao === 'atualizar_rascunho' || operacao === 'criar_nomeacao_ativa') {
      const refs = await validarReferencias(base44, data);
      const targetStatus = operacao === 'criar_nomeacao_ativa' ? STATUS_GRATIFICACAO_ATIVA : STATUS_RASCUNHO;
      const registro = montarRegistroGratificacao(data, refs, authUser, targetStatus);

      if (operacao === 'criar_rascunho' || operacao === 'criar_nomeacao_ativa') {
        const resultado = await fetchWithRetry(() => base44.asServiceRole.entities.GratificacaoFuncao.create(registro), `GratificacaoFuncao.create:${targetStatus}`);
        return Response.json({ ok: true, operacao, entityName: 'GratificacaoFuncao', data: sanitizeResponse(resultado), meta: { statusRestrito: targetStatus, semAtivacao: targetStatus === STATUS_RASCUNHO } });
      }

      const id = trimString(payload?.id || payload?.data?.id);
      if (!id) throw withStatus('id é obrigatório para atualizar_rascunho.', 400);
      const existente = await buscarUm(base44, 'GratificacaoFuncao', id);
      if (normalizeTipo(existente.status) !== STATUS_RASCUNHO) throw withStatus('Somente GratificacaoFuncao em rascunho pode ser atualizada neste lote.', 400);
      const resultado = await fetchWithRetry(() => base44.asServiceRole.entities.GratificacaoFuncao.update(id, { ...registro, status: STATUS_RASCUNHO }), `GratificacaoFuncao.update:rascunho:${id}`);
      return Response.json({ ok: true, operacao, entityName: 'GratificacaoFuncao', data: sanitizeResponse(resultado), meta: { statusRestrito: STATUS_RASCUNHO, semAtivacao: true, semNomeacao: true } });
    }

    const id = trimString(payload?.id || payload?.data?.id);
    if (!id) throw withStatus('id é obrigatório para esta operação.', 400);
    const existente = await buscarUm(base44, 'GratificacaoFuncao', id);
    const statusAtual = normalizeTipo(existente.status);

    if (operacao === 'enviar_dp') {
      if (statusAtual !== STATUS_RASCUNHO) throw withStatus('Apenas registros em rascunho podem ser enviados à DP.', 400);

      const payloadUpdate = {
        status: STATUS_SOLICITADO_DP,
        data_solicitacao: data.data_solicitacao || null,
        documento_solicitacao: data.documento_solicitacao || '',
        numero_processo: data.numero_processo || existente.numero_processo || '',
        solicitado_por: authUser.email || '',
        status_alterado_em: new Date().toISOString(),
        status_alterado_por: authUser.email || ''
      };
      const resultado = await fetchWithRetry(() => base44.asServiceRole.entities.GratificacaoFuncao.update(id, payloadUpdate), `GratificacaoFuncao.enviar_dp:${id}`);
      return Response.json({ ok: true, operacao, entityName: 'GratificacaoFuncao', data: sanitizeResponse(resultado), meta: { statusRestrito: STATUS_SOLICITADO_DP, semAtivacao: true, semNomeacao: true } });
    }


    if (operacao === 'registrar_publicacao_nomeacao') {
      if (statusAtual !== STATUS_AGUARDANDO_PUBLICACAO) throw withStatus('Registro não está em aguardando_publicacao_nomeacao.', 400);

      const dataPub = trimString(data.data_publicacao_nomeacao);
      const dataEfeitos = trimString(data.data_inicio_efeitos);
      const doemsNum = trimString(data.doems_nomeacao_numero);
      const doemsEd = trimString(data.doems_nomeacao_edicao);

      if (!dataPub) throw withStatus('data_publicacao_nomeacao é obrigatória para esta operação.', 400);
      if (!dataEfeitos) throw withStatus('data_inicio_efeitos é obrigatória para esta operação.', 400);
      if (!doemsNum && !doemsEd) throw withStatus('doems_nomeacao_numero ou doems_nomeacao_edicao é obrigatório para esta operação.', 400);

      const refs = await validarReferencias(base44, existente);

      // validarReferencias will ensure cota has availability considering active nominations.

      const payloadUpdate = {
        status: STATUS_GRATIFICACAO_ATIVA,
        data_publicacao_nomeacao: dataPub,
        data_inicio_efeitos: dataEfeitos,
        doems_nomeacao_numero: doemsNum || existente.doems_nomeacao_numero || '',
        doems_nomeacao_edicao: doemsEd || existente.doems_nomeacao_edicao || '',
        doems_nomeacao_link: trimString(data.doems_nomeacao_link) || existente.doems_nomeacao_link || '',
        ato_nomeacao_numero: trimString(data.ato_nomeacao_numero) || existente.ato_nomeacao_numero || '',
        observacoes: trimString(data.observacoes) || existente.observacoes || '',
        status_alterado_em: new Date().toISOString(),
        status_alterado_por: authUser.email || ''
      };

      const resultado = await fetchWithRetry(() => base44.asServiceRole.entities.GratificacaoFuncao.update(id, payloadUpdate), `GratificacaoFuncao.registrar_publicacao_nomeacao:${id}`);
      return Response.json({ ok: true, operacao, entityName: 'GratificacaoFuncao', data: sanitizeResponse(resultado), meta: { statusRestrito: STATUS_GRATIFICACAO_ATIVA } });
    }

    if (operacao === 'marcar_aguardando_publicacao') {
      if (statusAtual !== STATUS_RASCUNHO && statusAtual !== STATUS_SOLICITADO_DP) throw withStatus('Registro deve estar em rascunho ou solicitado_dp.', 400);

      const payloadUpdate = {
        status: STATUS_AGUARDANDO_PUBLICACAO,
        status_alterado_em: new Date().toISOString(),
        status_alterado_por: authUser.email || ''
      };
      const resultado = await fetchWithRetry(() => base44.asServiceRole.entities.GratificacaoFuncao.update(id, payloadUpdate), `GratificacaoFuncao.marcar_aguardando_publicacao:${id}`);
      return Response.json({ ok: true, operacao, entityName: 'GratificacaoFuncao', data: sanitizeResponse(resultado), meta: { statusRestrito: STATUS_AGUARDANDO_PUBLICACAO, semAtivacao: true, semNomeacao: true } });
    }

    if (operacao === 'finalizar_gratificacao') {
      if (statusAtual === STATUS_DISPENSADO || statusAtual === STATUS_CANCELADO) throw withStatus('Registro já está dispensado ou cancelado.', 400);
      if (statusAtual !== STATUS_GRATIFICACAO_ATIVA) throw withStatus('Apenas registros em nomeado_ativo podem ser finalizados.', 400);

      if (!data.data_fim_efeitos) throw withStatus('data_fim_efeitos é obrigatória para finalizar a gratificação.', 400);
      if (!data.motivo_dispensa) throw withStatus('motivo_dispensa é obrigatório para finalizar a gratificação.', 400);

      const payloadUpdate = {
        status: STATUS_DISPENSADO,
        data_fim_efeitos: data.data_fim_efeitos,
        motivo_dispensa: data.motivo_dispensa,
        data_publicacao_dispensa: data.data_publicacao_dispensa || null,
        doems_dispensa_numero: data.doems_dispensa_numero || '',
        doems_dispensa_edicao: data.doems_dispensa_edicao || '',
        doems_dispensa_link: data.doems_dispensa_link || '',
        ato_dispensa_numero: data.ato_dispensa_numero || '',
        documento_solicitacao_dispensa: data.documento_solicitacao_dispensa || '',
        observacoes: data.observacoes || existente.observacoes || '',
        status_alterado_em: new Date().toISOString(),
        status_alterado_por: authUser.email || ''
      };

      const resultado = await fetchWithRetry(() => base44.asServiceRole.entities.GratificacaoFuncao.update(id, payloadUpdate), `GratificacaoFuncao.finalizar_gratificacao:${id}`);
      return Response.json({ ok: true, operacao, entityName: 'GratificacaoFuncao', data: sanitizeResponse(resultado), meta: { statusRestrito: STATUS_DISPENSADO } });
    }
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao gerir rascunho de Gratificação de Função.', meta: { status } }, { status });
  }
});
