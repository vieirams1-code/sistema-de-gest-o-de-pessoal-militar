import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// =====================================================================
// controleProcessosEscopado — Backend escopado do módulo
// Controle de Processos e Procedimentos.
// ---------------------------------------------------------------------
// Centraliza TODAS as escritas e leituras escopadas das entidades:
//   - CaixaProcessual
//   - ProcessoControle
//   - TramiteProcessual
//   - EventoProcessual
//
// Substitui a escrita direta pelo SDK no frontend (que estava bloqueada
// por RLS admin-only). Aqui a operação roda com asServiceRole SOMENTE
// após validar autenticação, permissão funcional e participação/gestão
// na caixa correspondente.
//
// Regras (espelham o pedido):
//   - visualizar: apenas processos das caixas do usuário; quem tem
//     perm_visualizar_todas_caixas_processuais (ou admin) vê tudo;
//   - criar processo: perm_criar_processo_controle;
//   - editar processo: perm_editar_processo_controle + participação/
//     gestão na caixa atual (admin/permissão ampla ignora caixa);
//   - tramitar: perm_tramitar_processo_controle + participação/gestão
//     na caixa atual;
//   - arquivar: perm_arquivar_processo_controle + GESTÃO da caixa atual
//     (admin/permissão ampla ignora gestão);
//   - despacho: perm_editar_processo_controle + participação/gestão;
//   - gerenciar caixas: perm_gerenciar_caixas_processuais.
//
// Campos protegidos (não aceitos crus do frontend sem validação backend):
//   - ProcessoControle: caixa_atual_id, unidade_id;
//   - CaixaProcessual: usuarios_ids, gestores_ids, unidade_id.
//
// link_externo é sanitizado (remoção de tokens) antes de salvar.
// Toda escrita relevante gera EventoProcessual.
// =====================================================================

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
];

const PARAMS_SENSIVEIS = [
  'access_token', 'token', 'auth', 'authorization', 'jwt', 'id_token',
  'refresh_token', 'api_key', 'apikey', 'key', 'senha', 'password', 'secret',
];

// Campos que o frontend NÃO pode definir/alterar diretamente.
const PROCESSO_CAMPOS_PROTEGIDOS = ['caixa_atual_id', 'unidade_id', 'criado_por', 'arquivado'];
const CAIXA_CAMPOS_PROTEGIDOS_EDICAO = []; // membros/gestores são editáveis só via gerenciar caixas (já validado).

const normalizeTipo = (t) => String(t || '').trim().toLowerCase();
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
const nowIso = () => new Date().toISOString();

function sanitizarLinkExterno(link) {
  const original = String(link || '').trim();
  if (!original) return '';
  try {
    const url = new URL(original);
    PARAMS_SENSIVEIS.forEach((param) => {
      [...url.searchParams.keys()].forEach((chave) => {
        if (chave.toLowerCase() === param) url.searchParams.delete(chave);
      });
    });
    if (url.hash && PARAMS_SENSIVEIS.some((p) => url.hash.toLowerCase().includes(p))) {
      url.hash = '';
    }
    return url.toString();
  } catch {
    return original;
  }
}

async function fetchWithRetry(queryFn, label = 'query') {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      if (!RETRY_STATUS.has(status) || attempt === RETRY_MAX_ATTEMPTS) break;
      const exp = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 200);
      await new Promise((res) => setTimeout(res, exp + jitter));
      console.warn(`[controleProcessosEscopado] retry step=${label} attempt=${attempt} status=${status}`);
    }
  }
  throw lastError;
}

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

function consolidarActions(perfis, acessos) {
  const actions = {};
  const aplicarFonte = (fonte) => {
    if (!fonte) return;
    Object.entries(fonte).forEach(([key, val]) => {
      if (typeof val !== 'boolean') return;
      if (!key.startsWith('perm_')) return;
      const actionKey = key.replace(/^perm_/, '');
      if (val === true) actions[actionKey] = true;
      else if (!(actionKey in actions)) actions[actionKey] = false;
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

async function resolverPermissoes(base44, email) {
  const acessos = await fetchWithRetry(
    () => base44.asServiceRole.entities.UsuarioAcesso.filter(
      { user_email: email, ativo: true }, undefined, 100, 0, CAMPOS_USUARIO_ACESSO,
    ),
    `usuarioAcesso.list:${email}`,
  );
  const isAdminByAccess = (acessos || []).some((a) => normalizeTipo(a.tipo_acesso) === 'admin');
  const perfilIds = Array.from(new Set((acessos || []).map((a) => a?.perfil_id).filter(Boolean)));
  let perfis = [];
  if (perfilIds.length > 0) {
    perfis = await fetchWithRetry(
      () => base44.asServiceRole.entities.PerfilPermissao.filter({ id: { $in: perfilIds }, ativo: true }),
      `perfilPermissao.in:${email}`,
    );
  }
  return { acessos: acessos || [], actions: consolidarActions(perfis || [], acessos || []), isAdminByAccess };
}

const isMembroCaixa = (caixa, email) =>
  Boolean(caixa) && (caixa.usuarios_ids || []).includes(email);
const isGestorCaixa = (caixa, email) =>
  Boolean(caixa) && (caixa.gestores_ids || []).includes(email);
const participaCaixa = (caixa, email) =>
  isMembroCaixa(caixa, email) || isGestorCaixa(caixa, email);

async function getCaixa(base44, id) {
  if (!id) return null;
  try {
    return await fetchWithRetry(() => base44.asServiceRole.entities.CaixaProcessual.get(id), `caixa.get:${id}`);
  } catch (_e) {
    const lista = await base44.asServiceRole.entities.CaixaProcessual.filter({ id }, undefined, 1, 0).catch(() => []);
    return lista?.[0] || null;
  }
}

async function getProcesso(base44, id) {
  if (!id) return null;
  try {
    return await fetchWithRetry(() => base44.asServiceRole.entities.ProcessoControle.get(id), `processo.get:${id}`);
  } catch (_e) {
    const lista = await base44.asServiceRole.entities.ProcessoControle.filter({ id }, undefined, 1, 0).catch(() => []);
    return lista?.[0] || null;
  }
}

async function registrarEvento(base44, processoId, evento) {
  return base44.asServiceRole.entities.EventoProcessual.create({
    processo_id: processoId,
    data_evento: nowIso(),
    ...evento,
  });
}

function erro(status, message, extra = {}) {
  const e = new Error(message);
  e.status = status;
  e.extra = extra;
  return e;
}

function limparPayloadProcesso(data = {}) {
  const limpo = { ...data };
  delete limpo.interessados;
  PROCESSO_CAMPOS_PROTEGIDOS.forEach((c) => delete limpo[c]);
  if (limpo.link_externo) limpo.link_externo = sanitizarLinkExterno(limpo.link_externo);
  return limpo;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const action = String(payload?.action || '').trim();
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    const id = payload?.id ? String(payload.id) : null;

    const email = normalizeEmail(authUser.email);
    const isAdminByRole = String(authUser.role || '').toLowerCase() === 'admin';
    const perms = await resolverPermissoes(base44, authUser.email);
    const isAdmin = isAdminByRole || perms.isAdminByAccess;
    const actions = perms.actions || {};

    const can = (key) => isAdmin || actions[key] === true;
    const podeVerTodas = isAdmin || actions['visualizar_todas_caixas_processuais'] === true;
    const podeModulo = isAdmin || actions['visualizar_controle_processos'] === true;

    if (!podeModulo) {
      return Response.json({ error: 'Acesso negado: sem permissão no módulo Controle de Processos.' }, { status: 403 });
    }

    // Pré-carrega todas as caixas (volume baixo) para resolver participação/visibilidade.
    const todasCaixas = await fetchWithRetry(
      () => base44.asServiceRole.entities.CaixaProcessual.list('-data_criacao', 1000),
      'caixas.list',
    );
    const caixasById = new Map((todasCaixas || []).map((c) => [c.id, c]));
    const caixasDoUsuario = (todasCaixas || []).filter((c) => participaCaixa(c, email));
    const caixasDoUsuarioIds = new Set(caixasDoUsuario.map((c) => c.id));

    switch (action) {
      // ---------------- Leitura escopada ----------------
      case 'listarCaixasProcessuaisEscopado': {
        const visiveis = podeVerTodas ? (todasCaixas || []) : caixasDoUsuario;
        return Response.json({ ok: true, caixas: visiveis });
      }

      case 'listarProcessosControleEscopado': {
        const processos = await fetchWithRetry(
          () => base44.asServiceRole.entities.ProcessoControle.list('-updated_date', 2000),
          'processos.list',
        );
        const visiveis = podeVerTodas
          ? (processos || [])
          : (processos || []).filter((p) => caixasDoUsuarioIds.has(p.caixa_atual_id));
        return Response.json({ ok: true, processos: visiveis });
      }

      // ---------------- Caixas ----------------
      case 'criarCaixaProcessual': {
        if (!can('gerenciar_caixas_processuais')) {
          return Response.json({ error: 'Acesso negado: sem permissão para gerenciar caixas.' }, { status: 403 });
        }
        const nome = String(data?.nome || '').trim();
        if (!nome) return Response.json({ error: 'nome é obrigatório.' }, { status: 400 });
        const caixa = await base44.asServiceRole.entities.CaixaProcessual.create({
          nome,
          descricao: String(data?.descricao || ''),
          unidade_id: data?.unidade_id || '',
          ativa: data?.ativa !== false,
          usuarios_ids: Array.isArray(data?.usuarios_ids) ? data.usuarios_ids : [],
          gestores_ids: Array.isArray(data?.gestores_ids) ? data.gestores_ids : [],
          criada_por: email,
          data_criacao: nowIso(),
        });
        return Response.json({ ok: true, caixa });
      }

      case 'editarCaixaProcessual': {
        if (!can('gerenciar_caixas_processuais')) {
          return Response.json({ error: 'Acesso negado: sem permissão para gerenciar caixas.' }, { status: 403 });
        }
        if (!id) return Response.json({ error: 'id da caixa é obrigatório.' }, { status: 400 });
        const existente = caixasById.get(id) || await getCaixa(base44, id);
        if (!existente) return Response.json({ error: 'Caixa não encontrada.' }, { status: 404 });
        const patch = {};
        if (data?.nome !== undefined) patch.nome = String(data.nome).trim();
        if (data?.descricao !== undefined) patch.descricao = String(data.descricao);
        if (data?.ativa !== undefined) patch.ativa = Boolean(data.ativa);
        if (data?.unidade_id !== undefined) patch.unidade_id = data.unidade_id || '';
        if (Array.isArray(data?.usuarios_ids)) patch.usuarios_ids = data.usuarios_ids;
        if (Array.isArray(data?.gestores_ids)) patch.gestores_ids = data.gestores_ids;
        const caixa = await base44.asServiceRole.entities.CaixaProcessual.update(id, patch);
        return Response.json({ ok: true, caixa });
      }

      // ---------------- Processos ----------------
      case 'criarProcessoControle': {
        if (!can('criar_processo_controle')) {
          return Response.json({ error: 'Acesso negado: sem permissão para criar processo.' }, { status: 403 });
        }
        const caixaId = String(data?.caixa_atual_id || '').trim();
        if (!caixaId) return Response.json({ error: 'caixa_atual_id é obrigatório.' }, { status: 400 });
        const caixa = caixasById.get(caixaId) || await getCaixa(base44, caixaId);
        if (!caixa) return Response.json({ error: 'Caixa de destino não encontrada.' }, { status: 404 });
        // Não-admin/sem visão ampla só cria em caixa onde participa.
        if (!podeVerTodas && !participaCaixa(caixa, email)) {
          return Response.json({ error: 'Acesso negado: você não participa da caixa selecionada.' }, { status: 403 });
        }
        if (!String(data?.titulo || '').trim()) return Response.json({ error: 'titulo é obrigatório.' }, { status: 400 });
        if (!String(data?.tipo_interno || '').trim()) return Response.json({ error: 'tipo_interno é obrigatório.' }, { status: 400 });

        const corpo = limparPayloadProcesso(data);
        const processo = await base44.asServiceRole.entities.ProcessoControle.create({
          ...corpo,
          caixa_atual_id: caixaId, // canônico (validado)
          unidade_id: caixa.unidade_id || data?.unidade_id || '',
          status: data?.status || 'Novo',
          prioridade: data?.prioridade || 'Normal',
          arquivado: false,
          interessados_ids: Array.isArray(data?.interessados_ids) ? data.interessados_ids : [],
          criado_por: email,
        });
        await registrarEvento(base44, processo.id, {
          tipo_evento: 'criacao',
          descricao: `Processo criado: ${processo.titulo}`,
          usuario_id: email,
          dados_novos: corpo,
        });
        return Response.json({ ok: true, processo });
      }

      case 'editarProcessoControle': {
        if (!can('editar_processo_controle')) {
          return Response.json({ error: 'Acesso negado: sem permissão para editar processo.' }, { status: 403 });
        }
        if (!id) return Response.json({ error: 'id do processo é obrigatório.' }, { status: 400 });
        const processo = await getProcesso(base44, id);
        if (!processo) return Response.json({ error: 'Processo não encontrado.' }, { status: 404 });
        const caixaAtual = caixasById.get(processo.caixa_atual_id);
        if (!podeVerTodas && !participaCaixa(caixaAtual, email)) {
          return Response.json({ error: 'Acesso negado: você não participa da caixa atual do processo.' }, { status: 403 });
        }
        const corpo = limparPayloadProcesso(data);
        const atualizado = await base44.asServiceRole.entities.ProcessoControle.update(id, corpo);
        await registrarEvento(base44, id, {
          tipo_evento: 'edicao',
          descricao: 'Processo atualizado',
          usuario_id: email,
          dados_anteriores: processo,
          dados_novos: corpo,
        });
        return Response.json({ ok: true, processo: atualizado });
      }

      case 'tramitarProcessoControle': {
        if (!can('tramitar_processo_controle')) {
          return Response.json({ error: 'Acesso negado: sem permissão para tramitar processo.' }, { status: 403 });
        }
        if (!id) return Response.json({ error: 'id do processo é obrigatório.' }, { status: 400 });
        const processo = await getProcesso(base44, id);
        if (!processo) return Response.json({ error: 'Processo não encontrado.' }, { status: 404 });
        const caixaAtual = caixasById.get(processo.caixa_atual_id);
        if (!podeVerTodas && !participaCaixa(caixaAtual, email)) {
          return Response.json({ error: 'Acesso negado: você não participa da caixa atual do processo.' }, { status: 403 });
        }
        const destinoId = String(data?.caixa_destino_id || '').trim();
        if (!destinoId) return Response.json({ error: 'caixa_destino_id é obrigatório.' }, { status: 400 });
        const caixaDestino = caixasById.get(destinoId) || await getCaixa(base44, destinoId);
        if (!caixaDestino) return Response.json({ error: 'Caixa de destino não encontrada.' }, { status: 404 });

        const acaoSolicitada = String(data?.acao_solicitada || '');
        const destinatario = String(data?.destinatario_id || '');
        const mensagem = String(data?.mensagem || '');
        const prazo = data?.prazo || '';

        await base44.asServiceRole.entities.TramiteProcessual.create({
          processo_id: id,
          caixa_origem_id: processo.caixa_atual_id || '',
          caixa_destino_id: destinoId,
          remetente_id: email,
          destinatario_id: destinatario,
          mensagem,
          acao_solicitada: acaoSolicitada || undefined,
          prazo: prazo || undefined,
          urgente: Boolean(data?.urgente),
          status_tramite: 'Enviado',
          data_envio: nowIso(),
        });

        const novoStatus = acaoSolicitada === 'Devolver com providência'
          ? 'Devolvido para ajustes'
          : 'Aguardando providência da caixa';

        const atualizado = await base44.asServiceRole.entities.ProcessoControle.update(id, {
          caixa_atual_id: destinoId,
          status: novoStatus,
          responsavel_id: destinatario || processo.responsavel_id || '',
          ...(prazo ? { prazo } : {}),
        });

        await registrarEvento(base44, id, {
          tipo_evento: 'tramitacao',
          descricao: `Tramitado para "${caixaDestino.nome}"${acaoSolicitada ? ` — ${acaoSolicitada}` : ''}`,
          usuario_id: email,
          dados_anteriores: { caixa_atual_id: processo.caixa_atual_id, status: processo.status },
          dados_novos: { caixa_destino_id: destinoId, acao_solicitada: acaoSolicitada, mensagem },
        });
        return Response.json({ ok: true, processo: atualizado });
      }

      case 'arquivarProcessoControle': {
        if (!can('arquivar_processo_controle')) {
          return Response.json({ error: 'Acesso negado: sem permissão para arquivar processo.' }, { status: 403 });
        }
        if (!id) return Response.json({ error: 'id do processo é obrigatório.' }, { status: 400 });
        const processo = await getProcesso(base44, id);
        if (!processo) return Response.json({ error: 'Processo não encontrado.' }, { status: 404 });
        const caixaAtual = caixasById.get(processo.caixa_atual_id);
        // Arquivar exige GESTÃO da caixa atual, salvo admin/permissão ampla.
        if (!podeVerTodas && !isGestorCaixa(caixaAtual, email)) {
          return Response.json({ error: 'Acesso negado: somente gestor da caixa atual pode arquivar.' }, { status: 403 });
        }
        const atualizado = await base44.asServiceRole.entities.ProcessoControle.update(id, {
          arquivado: true,
          status: 'Arquivado',
        });
        await registrarEvento(base44, id, {
          tipo_evento: 'arquivamento',
          descricao: 'Processo arquivado',
          usuario_id: email,
        });
        return Response.json({ ok: true, processo: atualizado });
      }

      case 'registrarDespachoProcesso': {
        if (!can('editar_processo_controle')) {
          return Response.json({ error: 'Acesso negado: sem permissão para despachar processo.' }, { status: 403 });
        }
        if (!id) return Response.json({ error: 'id do processo é obrigatório.' }, { status: 400 });
        const texto = String(data?.texto || data?.descricao || '').trim();
        if (!texto) return Response.json({ error: 'texto do despacho é obrigatório.' }, { status: 400 });
        const processo = await getProcesso(base44, id);
        if (!processo) return Response.json({ error: 'Processo não encontrado.' }, { status: 404 });
        const caixaAtual = caixasById.get(processo.caixa_atual_id);
        if (!podeVerTodas && !participaCaixa(caixaAtual, email)) {
          return Response.json({ error: 'Acesso negado: você não participa da caixa atual do processo.' }, { status: 403 });
        }
        const evento = await registrarEvento(base44, id, {
          tipo_evento: 'despacho',
          descricao: texto,
          usuario_id: email,
        });
        return Response.json({ ok: true, evento });
      }

      default:
        return Response.json({ error: `Ação "${action}" inválida.` }, { status: 400 });
    }
  } catch (error) {
    const status = error?.status || error?.response?.status || 500;
    console.error('[controleProcessosEscopado] erro', { message: error?.message, status });
    return Response.json({ error: error?.message || 'Erro interno em controleProcessosEscopado.' }, { status });
  }
});