import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ENTIDADES = new Set(['MilitarFuncao', 'MilitarTag', 'FeriasTag', 'FuncaoMilitar', 'TagGrupo', 'Tag']);
const OPERACOES = new Set(['create', 'update', 'encerrar', 'remover', 'desativar', 'delete', 'bulk']);

const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id', 'perfil_id'];

const PERMISSIONS_MAP: Record<string, string[]> = {
  MilitarFuncao: ['adicionar_militares', 'editar_militares'],
  MilitarTag: ['adicionar_militares', 'editar_militares'],
  FeriasTag: ['adicionar_ferias', 'editar_ferias'],
  FuncaoMilitar: ['gerir_configuracoes'],
  TagGrupo: ['gerir_configuracoes'],
  Tag: ['gerir_configuracoes'],
};

const APLICABILIDADES = new Set(['militar', 'ferias', 'atestado', 'todos']);
const TIPOS_VISUAIS = new Set(['normal', 'destaque', 'alerta', 'favorito', 'critico']);
const INSTITUCIONAIS = new Set(['comandante', 'subcomandante']);

const BULK_MAX_ITEMS = 1000;

const normalizeTipo = (t: unknown) => String(t || '').trim().toLowerCase();
const normalizeNome = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
const isDevRuntime = () => {
  try {
    const getEnv = (k: string) => (Deno.env as any).get(k);
    const env = String(getEnv('ENV') || getEnv('NODE_ENV') || '').toLowerCase();
    return env === 'dev' || env === 'development' || env === 'local';
  } catch {
    return false;
  }
};
function logDev(label: string, payload: Record<string, unknown>) {
  if (!isDevRuntime()) return;
  console.log(label, payload);
}

function extrairMatrizPermissoes(descricao: unknown) {
  if (typeof descricao !== 'string' || !descricao) return {};
  const start = descricao.indexOf('[SGP_PERMISSIONS_MATRIX]');
  const end = descricao.indexOf('[/SGP_PERMISSIONS_MATRIX]');
  if (start === -1 || end === -1 || end <= start) return {};
  try { return JSON.parse(descricao.slice(start + 24, end).trim()) || {}; } catch { return {}; }
}
function consolidarActions(perfis: any[], acessos: any[]) {
  const actions: Record<string, boolean> = {};
  const apply = (src: any) => Object.entries(src || {}).forEach(([k, v]) => {
    if (!k.startsWith('perm_') || typeof v !== 'boolean') return;
    const key = k.replace(/^perm_/, '');
    if (v === true) actions[key] = true;
    else if (!(key in actions)) actions[key] = false;
  });
  (perfis || []).forEach((p) => { apply(p); apply(extrairMatrizPermissoes(p?.descricao)); });
  (acessos || []).forEach(apply);
  return actions;
}
async function resolverPermissoes(base44: any, email: string) {
  const acessos = await base44.asServiceRole.entities.UsuarioAcesso.filter({ user_email: email, ativo: true }, undefined, 100, 0, CAMPOS_USUARIO_ACESSO);
  const isAdminByAccess = (acessos || []).some((a: any) => normalizeTipo(a.tipo_acesso) === 'admin');
  const perfilIds = Array.from(new Set((acessos || []).map((a: any) => a?.perfil_id).filter(Boolean)));
  const perfis = perfilIds.length > 0 ? await base44.asServiceRole.entities.PerfilPermissao.filter({ id: { $in: perfilIds }, ativo: true }) : [];
  return { acessos: acessos || [], actions: consolidarActions(perfis || [], acessos || []), isAdminByAccess };
}
async function listarMilitarIdsDoEscopo(base44: any, acessos: any[]) {
  const ids = new Set<string>();
  const queries: any[] = [];

  for (const acesso of acessos || []) {
    const tipo = normalizeTipo(acesso?.tipo_acesso);
    if (tipo === 'admin') return null;
    if (tipo === 'proprio') {
      if (acesso?.militar_id) ids.add(String(acesso.militar_id));
      continue;
    }
    const grupamentoId = acesso?.grupamento_id || null;
    const subgrupamentoId = acesso?.subgrupamento_id || null;

    if (tipo === 'setor' && grupamentoId) {
      queries.push({ grupamento_raiz_id: grupamentoId }, { grupamento_id: grupamentoId }, { estrutura_id: grupamentoId });
    } else if (tipo === 'subsetor' && subgrupamentoId) {
      queries.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
      const filhos = await base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }, undefined, 1000, 0, ['id']);
      for (const filho of (filhos || [])) if (filho?.id) queries.push({ estrutura_id: filho.id }, { subgrupamento_id: filho.id });
    } else if (tipo === 'unidade' && subgrupamentoId) {
      queries.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
    }
  }

  if (queries.length > 0) {
    const results = await Promise.all(queries.map((q) => base44.asServiceRole.entities.Militar.filter(q, undefined, 1000, 0, ['id'])));
    for (const lista of results) {
      for (const m of (lista || [])) if (m?.id) ids.add(String(m.id));
    }
  }

  return Array.from(ids);
}

function erro(status: number, message: string) { return Response.json({ error: message }, { status }); }
function normalizarAplicabilidade(value: unknown) {
  const raw = String(value || '').trim();
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized === 'militar') return 'militar';
  if (normalized === 'ferias') return 'ferias';
  if (normalized === 'atestado') return 'atestado';
  if (normalized === 'todos' || normalized === 'ambos' || !normalized) return 'todos';
  return null;
}
function validarAplicabilidade(value: unknown) { return APLICABILIDADES.has(String(value || '').trim()); }
function validarTipoVisual(value: unknown) { return TIPOS_VISUAIS.has(String(value || '').trim()); }

// ============================================================
// BULK HANDLER — MilitarFuncao / MilitarTag / FeriasTag
// ============================================================

const ACOES_BULK_VINCULO = new Set(['aplicar', 'remover', 'encerrar']);
const APLICAB_MILITAR_OK = new Set(['militar', 'todos', 'ambos']);
const APLICAB_FERIAS_OK = new Set(['ferias', 'todos', 'ambos']);

function hojeIso() { return new Date().toISOString().slice(0, 10); }

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function carregarVinculosAtivosPorCampo(svc: any, campoChave: 'militar_id' | 'ferias_id', valores: string[], extra: Record<string, unknown> = {}) {
  const chunks = chunk(valores, 100);
  const results = await Promise.all(chunks.map((grupo) => svc.filter({ [campoChave]: { $in: grupo }, status: 'ativa', ...extra }, undefined, 2000, 0)));
  const out: any[] = [];
  for (const lista of results) {
    if (Array.isArray(lista)) out.push(...lista);
  }
  return out;
}

async function executarBulkVinculos(
  base44: any,
  entidade: 'MilitarFuncao' | 'MilitarTag' | 'FeriasTag',
  itens: any[],
  isInScope: (id: unknown) => boolean,
) {
  const svc = base44.asServiceRole.entities[entidade];
  const resultados: Array<Record<string, unknown>> = [];
  const criar: any[] = [];
  const atualizar: Array<{ id: string; data: Record<string, unknown> }> = [];

  // Normaliza e valida cada item
  const normalizados = itens.map((raw, idx) => {
    const item: any = { _idx: idx, _raw: raw, acao: String(raw?.acao || '').trim().toLowerCase() };
    if (!ACOES_BULK_VINCULO.has(item.acao)) {
      item._erro = `Ação inválida: "${raw?.acao}". Use aplicar | remover | encerrar.`;
      return item;
    }
    if (entidade === 'MilitarFuncao') {
      item.militar_id = String(raw?.militar_id || '');
      item.funcao_militar_id = String(raw?.funcao_militar_id || '');
      item.id = raw?.id ? String(raw.id) : null;
      if (!item.militar_id) item._erro = 'militar_id é obrigatório.';
      else if (item.acao === 'aplicar' && !item.funcao_militar_id) item._erro = 'funcao_militar_id é obrigatório para aplicar.';
      else if (item.acao === 'encerrar' && !item.id && !(item.militar_id && item.funcao_militar_id)) item._erro = 'id ou (militar_id + funcao_militar_id) obrigatórios para encerrar.';
    } else if (entidade === 'MilitarTag') {
      item.militar_id = String(raw?.militar_id || '');
      item.tag_id = String(raw?.tag_id || '');
      item.id = raw?.id ? String(raw.id) : null;
      if (!item.militar_id) item._erro = 'militar_id é obrigatório.';
      else if (item.acao === 'aplicar' && !item.tag_id) item._erro = 'tag_id é obrigatório para aplicar.';
      else if (item.acao === 'remover' && !item.id && !(item.militar_id && item.tag_id)) item._erro = 'id ou (militar_id + tag_id) obrigatórios para remover.';
    } else {
      item.ferias_id = String(raw?.ferias_id || '');
      item.tag_id = String(raw?.tag_id || '');
      item.id = raw?.id ? String(raw.id) : null;
      if (!item.ferias_id) item._erro = 'ferias_id é obrigatório.';
      else if (item.acao === 'aplicar' && !item.tag_id) item._erro = 'tag_id é obrigatório para aplicar.';
      else if (item.acao === 'remover' && !item.id && !(item.ferias_id && item.tag_id)) item._erro = 'id ou (ferias_id + tag_id) obrigatórios para remover.';
    }
    item.data_evento = String(raw?.data || raw?.data_aplicacao || raw?.data_remocao || raw?.data_fim || '').slice(0, 10) || hojeIso();
    item.motivo = raw?.motivo ?? null;
    return item;
  });

  // 1) Escopo de militar / férias
  const militarIdsParaValidar = new Set<string>();
  const feriasIdsParaValidar = new Set<string>();
  normalizados.forEach((it) => {
    if (it._erro) return;
    if (entidade === 'FeriasTag') feriasIdsParaValidar.add(it.ferias_id);
    else militarIdsParaValidar.add(it.militar_id);
  });

  // Resolver ferias -> militar
  const feriasPorId = new Map<string, any>();
  if (feriasIdsParaValidar.size > 0) {
    for (const grupo of chunk(Array.from(feriasIdsParaValidar), 100)) {
      const lista = await base44.asServiceRole.entities.Ferias.filter({ id: { $in: grupo } }, undefined, 2000, 0, ['id', 'militar_id']);
      (lista || []).forEach((f: any) => feriasPorId.set(String(f.id), f));
    }
    feriasPorId.forEach((f) => militarIdsParaValidar.add(String(f?.militar_id || '')));
  }

  // 2) Validar catálogos (tags / funções) que serão aplicados
  const tagIdsAplicar = new Set<string>();
  const funcaoIdsAplicar = new Set<string>();
  normalizados.forEach((it) => {
    if (it._erro || it.acao !== 'aplicar') return;
    if (entidade === 'MilitarFuncao') funcaoIdsAplicar.add(it.funcao_militar_id);
    else tagIdsAplicar.add(it.tag_id);
  });

  const tagsPorId = new Map<string, any>();
  if (tagIdsAplicar.size > 0) {
    for (const grupo of chunk(Array.from(tagIdsAplicar), 100)) {
      const lista = await base44.asServiceRole.entities.Tag.filter({ id: { $in: grupo } }, undefined, 2000, 0);
      (lista || []).forEach((t: any) => tagsPorId.set(String(t.id), t));
    }
  }
  const funcoesPorId = new Map<string, any>();
  if (funcaoIdsAplicar.size > 0) {
    for (const grupo of chunk(Array.from(funcaoIdsAplicar), 100)) {
      const lista = await base44.asServiceRole.entities.FuncaoMilitar.filter({ id: { $in: grupo } }, undefined, 2000, 0);
      (lista || []).forEach((f: any) => funcoesPorId.set(String(f.id), f));
    }
  }

  // 3) Carrega vínculos ativos existentes (UMA chamada por campo-chave)
  let ativosPorChave = new Map<string, any>();
  let ativosMesmoInstitucionalPorMilitar = new Map<string, any[]>();
  if (entidade === 'MilitarFuncao') {
    const ativos = await carregarVinculosAtivosPorCampo(svc, 'militar_id', Array.from(militarIdsParaValidar));
    ativos.forEach((v) => {
      const chave = `${String(v.militar_id || '')}::${String(v.funcao_militar_id || '')}`;
      ativosPorChave.set(chave, v);
      const f = funcoesPorId.get(String(v.funcao_militar_id || ''));
      const ic = String(f?.institucional_chave || '').toLowerCase();
      if (INSTITUCIONAIS.has(ic)) {
        const list = ativosMesmoInstitucionalPorMilitar.get(`${String(v.militar_id)}::${ic}`) || [];
        list.push(v);
        ativosMesmoInstitucionalPorMilitar.set(`${String(v.militar_id)}::${ic}`, list);
      }
    });
  } else if (entidade === 'MilitarTag') {
    const ativos = await carregarVinculosAtivosPorCampo(svc, 'militar_id', Array.from(militarIdsParaValidar));
    ativos.forEach((v) => {
      ativosPorChave.set(`${String(v.militar_id || '')}::${String(v.tag_id || '')}`, v);
    });
  } else {
    const ativos = await carregarVinculosAtivosPorCampo(svc, 'ferias_id', Array.from(feriasIdsParaValidar));
    ativos.forEach((v) => {
      ativosPorChave.set(`${String(v.ferias_id || '')}::${String(v.tag_id || '')}`, v);
    });
  }

  // 4) Resolve cada item -> create / update (encerramento/remoção)
  for (const it of normalizados) {
    if (it._erro) {
      resultados.push({ ok: false, acao: it.acao, error: it._erro, item: it._raw });
      continue;
    }

    // Validação de escopo
    if (entidade === 'FeriasTag') {
      const f = feriasPorId.get(it.ferias_id);
      if (!f) { resultados.push({ ok: false, acao: it.acao, error: 'Férias não encontrada.', item: it._raw }); continue; }
      if (!isInScope(String(f.militar_id || ''))) { resultados.push({ ok: false, acao: it.acao, error: 'Férias fora do escopo.', item: it._raw }); continue; }
    } else {
      if (!isInScope(it.militar_id)) { resultados.push({ ok: false, acao: it.acao, error: 'Militar fora do escopo.', item: it._raw }); continue; }
    }

    if (it.acao === 'aplicar') {
      if (entidade === 'MilitarFuncao') {
        const f = funcoesPorId.get(it.funcao_militar_id);
        if (!f) { resultados.push({ ok: false, acao: it.acao, error: 'Função não encontrada.', item: it._raw }); continue; }
        if (!f.ativa) { resultados.push({ ok: false, acao: it.acao, error: 'Função inativa.', item: it._raw }); continue; }
        const ic = String(f.institucional_chave || '').toLowerCase();
        if (INSTITUCIONAIS.has(ic)) {
          const existentes = ativosMesmoInstitucionalPorMilitar.get(`${it.militar_id}::${ic}`) || [];
          if (existentes.some((v) => String(v.funcao_militar_id) !== it.funcao_militar_id)) {
            resultados.push({ ok: false, acao: it.acao, error: `Já existe vínculo ativo de ${ic} para este militar.`, item: it._raw });
            continue;
          }
        }
        const chave = `${it.militar_id}::${it.funcao_militar_id}`;
        if (ativosPorChave.has(chave)) {
          resultados.push({ ok: true, acao: it.acao, skipped: 'duplicate', id: ativosPorChave.get(chave).id, item: it._raw });
          continue;
        }
        criar.push({
          _idx: it._idx, _raw: it._raw, _acao: 'aplicar',
          payload: {
            militar_id: it.militar_id,
            funcao_militar_id: it.funcao_militar_id,
            status: 'ativa',
            data_inicio: it.data_evento,
            motivo: it.motivo || undefined,
          },
        });
      } else if (entidade === 'MilitarTag') {
        const tag = tagsPorId.get(it.tag_id);
        if (!tag) { resultados.push({ ok: false, acao: it.acao, error: 'Tag não encontrada.', item: it._raw }); continue; }
        if (!tag.ativo) { resultados.push({ ok: false, acao: it.acao, error: 'Tag inativa.', item: it._raw }); continue; }
        if (!APLICAB_MILITAR_OK.has(String(tag.aplicabilidade || ''))) { resultados.push({ ok: false, acao: it.acao, error: 'Tag incompatível para militar.', item: it._raw }); continue; }
        const chave = `${it.militar_id}::${it.tag_id}`;
        if (ativosPorChave.has(chave)) {
          resultados.push({ ok: true, acao: it.acao, skipped: 'duplicate', id: ativosPorChave.get(chave).id, item: it._raw });
          continue;
        }
        criar.push({
          _idx: it._idx, _raw: it._raw, _acao: 'aplicar',
          payload: {
            militar_id: it.militar_id,
            tag_id: it.tag_id,
            status: 'ativa',
            data_aplicacao: it.data_evento,
            motivo: it.motivo || undefined,
          },
        });
      } else {
        const tag = tagsPorId.get(it.tag_id);
        if (!tag) { resultados.push({ ok: false, acao: it.acao, error: 'Tag não encontrada.', item: it._raw }); continue; }
        if (!tag.ativo) { resultados.push({ ok: false, acao: it.acao, error: 'Tag inativa.', item: it._raw }); continue; }
        if (!APLICAB_FERIAS_OK.has(String(tag.aplicabilidade || ''))) { resultados.push({ ok: false, acao: it.acao, error: 'Tag incompatível para férias.', item: it._raw }); continue; }
        const chave = `${it.ferias_id}::${it.tag_id}`;
        if (ativosPorChave.has(chave)) {
          resultados.push({ ok: true, acao: it.acao, skipped: 'duplicate', id: ativosPorChave.get(chave).id, item: it._raw });
          continue;
        }
        criar.push({
          _idx: it._idx, _raw: it._raw, _acao: 'aplicar',
          payload: {
            ferias_id: it.ferias_id,
            tag_id: it.tag_id,
            status: 'ativa',
            data_aplicacao: it.data_evento,
            motivo: it.motivo || undefined,
          },
        });
      }
    } else {
      // remover (MilitarTag/FeriasTag) ou encerrar (MilitarFuncao)
      let id = it.id;
      if (!id) {
        let chave: string;
        if (entidade === 'MilitarFuncao') chave = `${it.militar_id}::${it.funcao_militar_id}`;
        else if (entidade === 'MilitarTag') chave = `${it.militar_id}::${it.tag_id}`;
        else chave = `${it.ferias_id}::${it.tag_id}`;
        const ativo = ativosPorChave.get(chave);
        if (!ativo) {
          resultados.push({ ok: true, acao: it.acao, skipped: 'not_active', item: it._raw });
          continue;
        }
        id = String(ativo.id);
      }
      const payload: Record<string, unknown> = { motivo: it.motivo || undefined };
      if (entidade === 'MilitarFuncao') {
        payload.status = 'encerrada';
        payload.principal = false;
        payload.data_fim = it.data_evento;
      } else {
        payload.status = 'removida';
        payload.data_remocao = it.data_evento;
      }
      atualizar.push({ id, data: payload, _idx: it._idx, _raw: it._raw, _acao: it.acao } as any);
    }
  }

  // 5) Executar create / update — usa bulkCreate quando disponível, senão Promise.all
  if (criar.length > 0) {
    const payloads = criar.map((c) => c.payload);
    let criados: any[] = [];
    if (typeof svc.bulkCreate === 'function') {
      try {
        const r = await svc.bulkCreate(payloads);
        criados = Array.isArray(r) ? r : (Array.isArray(r?.data) ? r.data : payloads.map(() => ({})));
      } catch (e: any) {
        // fallback unitário em caso de falha do bulk
        criados = await Promise.all(payloads.map((p) => svc.create(p).catch((err: any) => ({ __error: err?.message || 'create_failed' }))));
      }
    } else {
      criados = await Promise.all(payloads.map((p) => svc.create(p).catch((err: any) => ({ __error: err?.message || 'create_failed' }))));
    }
    criar.forEach((c, idx) => {
      const r = criados[idx];
      if (r && r.__error) resultados.push({ ok: false, acao: c._acao, error: r.__error, item: c._raw });
      else resultados.push({ ok: true, acao: c._acao, id: r?.id, item: c._raw });
    });
  }

  if (atualizar.length > 0) {
    const updates = await Promise.all(atualizar.map((u: any) => svc.update(u.id, u.data).catch((err: any) => ({ __error: err?.message || 'update_failed' }))));
    atualizar.forEach((u: any, idx) => {
      const r = updates[idx];
      if (r && r.__error) resultados.push({ ok: false, acao: u._acao, error: r.__error, item: u._raw });
      else resultados.push({ ok: true, acao: u._acao, id: u.id, item: u._raw });
    });
  }

  const sucesso = resultados.filter((r) => r.ok).length;
  const falhas = resultados.length - sucesso;
  return { total: resultados.length, sucesso, falhas, resultados };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return erro(401, 'Não autenticado.');

    const { entidade, operacao, id, data = {}, itens } = await req.json();
    if (!ENTIDADES.has(entidade) || !OPERACOES.has(operacao)) return erro(400, 'Entidade/operação inválida.');

    const perms = await resolverPermissoes(base44, authUser.email);
    const isAdmin = String(authUser.role || '').toLowerCase() === 'admin' || perms.isAdminByAccess;
    if (!isAdmin) {
      const required = PERMISSIONS_MAP[entidade] || [];
      if (!required.some((p) => perms.actions[p] === true)) return erro(403, 'Sem permissão para esta ação.');
    }

    const militarIdsEscopo = isAdmin ? null : await listarMilitarIdsDoEscopo(base44, perms.acessos);
    const isInScope = (mid: unknown) => militarIdsEscopo === null || militarIdsEscopo.includes(String(mid || ''));

    // ========== BULK ==========
    if (operacao === 'bulk') {
      if (!['MilitarFuncao', 'MilitarTag', 'FeriasTag'].includes(entidade)) {
        return erro(400, 'Operação bulk só é suportada para MilitarFuncao, MilitarTag e FeriasTag.');
      }
      if (!Array.isArray(itens)) return erro(400, 'O campo "itens" deve ser um array.');
      if (itens.length === 0) return Response.json({ total: 0, sucesso: 0, falhas: 0, resultados: [] });
      if (itens.length > BULK_MAX_ITEMS) return erro(400, `Limite de ${BULK_MAX_ITEMS} itens por chamada bulk.`);
      const out = await executarBulkVinculos(base44, entidade as any, itens, isInScope);
      return Response.json(out);
    }

    const svc = base44.asServiceRole.entities[entidade];
    const registroAtual = (operacao === 'update' || operacao === 'encerrar' || operacao === 'remover' || operacao === 'desativar' || operacao === 'delete') ? await svc.get(String(id || '')) : null;
    if ((operacao === 'update' || operacao === 'encerrar' || operacao === 'remover' || operacao === 'desativar' || operacao === 'delete') && !registroAtual) return erro(404, 'Registro não encontrado.');

    if (entidade === 'FuncaoMilitar') {
      if (!['create', 'update', 'desativar'].includes(operacao)) return erro(400, 'Operação inválida para FuncaoMilitar.');
      if (operacao === 'desativar') {
        const chaveAtual = normalizeTipo(registroAtual?.institucional_chave);
        if (INSTITUCIONAIS.has(chaveAtual)) return erro(400, 'Funções institucionais não podem ser desativadas.');
        const ativa = typeof data?.ativa === 'boolean' ? data.ativa : false;
        return Response.json({ data: await svc.update(String(id), { ativa }) });
      }
      const nome = String(data?.nome ?? registroAtual?.nome ?? '').trim();
      if (!nome) return erro(400, 'nome é obrigatório.');
      const institucionalChave = normalizeTipo(data?.institucional_chave ?? registroAtual?.institucional_chave ?? '');
      const prioridade = Number(data?.prioridade_lista ?? registroAtual?.prioridade_lista ?? 10);
      if (!Number.isFinite(prioridade)) return erro(400, 'prioridade_lista inválida.');

      const todasAtivas = await base44.asServiceRole.entities.FuncaoMilitar.filter({ ativa: true }, undefined, 1000, 0);
      const nomeNorm = normalizeNome(nome);
      if ((todasAtivas || []).some((f: any) => String(f.id) !== String(id || '') && normalizeNome(f.nome) === nomeNorm)) return erro(400, 'Já existe função ativa com este nome.');

      if (INSTITUCIONAIS.has(institucionalChave)) {
        if (institucionalChave === 'comandante' && prioridade !== 1) return erro(400, 'Comandante deve possuir prioridade 1.');
        if (institucionalChave === 'subcomandante' && prioridade !== 2) return erro(400, 'Subcomandante deve possuir prioridade 2.');
        const atualChave = normalizeTipo(registroAtual?.institucional_chave);
        if (operacao === 'update' && atualChave && atualChave !== institucionalChave) return erro(400, 'Não é permitido trocar institucional_chave de função institucional.');
        if ((todasAtivas || []).some((f: any) => String(f.id) !== String(id || '') && normalizeTipo(f.institucional_chave) === institucionalChave)) return erro(400, `Já existe função ativa com institucional_chave ${institucionalChave}.`);
      } else {
        if (institucionalChave) return erro(400, 'Função personalizada não pode ter institucional_chave.');
        if (prioridade < 10) return erro(400, 'Função personalizada deve ter prioridade_lista >= 10.');
      }

      const payload = { ...data, nome, prioridade_lista: prioridade, institucional_chave: institucionalChave || null, ativa: true };
      if (operacao === 'create') return Response.json({ data: await svc.create(payload) });
      return Response.json({ data: await svc.update(String(id), payload) });
    }

    if (entidade === 'TagGrupo') {
      if (!['create', 'update', 'desativar', 'delete'].includes(operacao)) return erro(400, 'Operação inválida para TagGrupo.');
      if (operacao === 'desativar') {
        const ativo = typeof data?.ativo === 'boolean' ? data.ativo : false;
        return Response.json({ data: await svc.update(String(id), { ativo }) });
      }
      if (operacao === 'delete') {
        const grupoId = String(id || '');
        const tagsAtivas = await base44.asServiceRole.entities.Tag.filter({ grupo_id: grupoId, ativo: true }, undefined, 2000, 0, ['id', 'nome']);
        const nomesTagsAtivas = (tagsAtivas || []).map((tag: any) => String(tag?.nome || '').trim()).filter(Boolean);
        logDev('[GRUPO_DELETE_CHECK]', { grupo_id: grupoId, tagsAtivas: nomesTagsAtivas.length });
        if (nomesTagsAtivas.length > 0) {
          return Response.json({
            code: 'GRUPO_COM_TAGS_ATIVAS',
            tags_ativas: nomesTagsAtivas,
            message: 'Este grupo possui tags ativas e não pode ser excluído.',
          }, { status: 409 });
        }
        await svc.delete(grupoId);
        return Response.json({ data: { id: grupoId, deleted: true } });
      }
      const nome = String(data?.nome ?? registroAtual?.nome ?? '').trim();
      if (!nome) return erro(400, 'nome é obrigatório.');
      const aplicabilidade = normalizarAplicabilidade(data?.aplicabilidade ?? registroAtual?.aplicabilidade ?? '');
      const tipoVisualRaw = String(data?.tipo_visual ?? registroAtual?.tipo_visual ?? 'normal').trim();
      const tipoVisual = tipoVisualRaw === 'chip' ? 'normal' : tipoVisualRaw;
      if (!aplicabilidade || !validarAplicabilidade(aplicabilidade)) return erro(400, 'Aplicabilidade deve ser Militar, Férias, Atestado ou Todos.');
      if (!validarTipoVisual(tipoVisual)) return erro(400, 'tipo_visual inválido.');
      const gruposAtivos = await base44.asServiceRole.entities.TagGrupo.filter({ ativo: true }, undefined, 1000, 0);
      const nomeNorm = normalizeNome(nome);
      if ((gruposAtivos || []).some((g: any) => String(g.id) !== String(id || '') && normalizeNome(g.nome) === nomeNorm)) return erro(400, 'Já existe grupo ativo com este nome.');
      const payload = { ...data, nome, aplicabilidade, tipo_visual: tipoVisual, ativo: true };
      if (operacao === 'create') return Response.json({ data: await svc.create(payload) });
      return Response.json({ data: await svc.update(String(id), payload) });
    }

    if (entidade === 'Tag') {
      if (!['create', 'update', 'desativar', 'delete'].includes(operacao)) return erro(400, 'Operação inválida para Tag.');
      if (operacao === 'desativar') {
        const ativo = typeof data?.ativo === 'boolean' ? data.ativo : false;
        return Response.json({ data: await svc.update(String(id), { ativo }) });
      }
      if (operacao === 'delete') {
        const tagId = String(id || '');
        const militarTags = await base44.asServiceRole.entities.MilitarTag.filter({ tag_id: tagId, status: 'ativa' }, undefined, 2000, 0, ['id']);
        const feriasTags = await base44.asServiceRole.entities.FeriasTag.filter({ tag_id: tagId, status: 'ativa' }, undefined, 2000, 0, ['id']);
        let atestadoTags: any[] = [];
        try {
          if (base44.asServiceRole.entities.AtestadoTag?.filter) {
            atestadoTags = await base44.asServiceRole.entities.AtestadoTag.filter({ tag_id: tagId, status: 'ativa' }, undefined, 2000, 0, ['id']);
          }
        } catch (_error) {
          atestadoTags = [];
        }
        const militarCount = Array.isArray(militarTags) ? militarTags.length : 0;
        const feriasCount = Array.isArray(feriasTags) ? feriasTags.length : 0;
        const atestadoCount = Array.isArray(atestadoTags) ? atestadoTags.length : 0;
        logDev('[TAG_DELETE_CHECK]', {
          tag_id: tagId,
          militarAtivos: militarCount,
          feriasAtivos: feriasCount,
          atestadoAtivos: atestadoCount,
        });
        const totalVinculos = militarCount + feriasCount + atestadoCount;
        if (totalVinculos > 0) {
          return Response.json({
            code: 'TAG_COM_VINCULOS',
            militar_tags: militarCount,
            ferias_tags: feriasCount,
            atestado_tags: atestadoCount,
            message: 'Esta tag possui vínculos e não pode ser excluída.',
          }, { status: 409 });
        }
        await svc.delete(tagId);
        return Response.json({ data: { id: tagId, deleted: true } });
      }
      const nome = String(data?.nome ?? registroAtual?.nome ?? '').trim();
      if (!nome) return erro(400, 'nome é obrigatório.');
      const grupoId = String(data?.grupo_id ?? registroAtual?.grupo_id ?? '').trim() || null;
      const aplicabilidade = normalizarAplicabilidade(data?.aplicabilidade ?? registroAtual?.aplicabilidade ?? '');
      const tipoVisualRaw = String(data?.tipo_visual ?? registroAtual?.tipo_visual ?? 'normal').trim();
      const tipoVisual = tipoVisualRaw === 'chip' ? 'normal' : tipoVisualRaw;


      if (!aplicabilidade || !validarAplicabilidade(aplicabilidade)) return erro(400, 'Aplicabilidade deve ser Militar, Férias, Atestado ou Todos.');
      if (!validarTipoVisual(tipoVisual)) return erro(400, 'tipo_visual inválido.');

      let grupo: any = null;
      if (grupoId) {
        [grupo] = await base44.asServiceRole.entities.TagGrupo.filter({ id: grupoId }, undefined, 1, 0);
        if (!grupo) return erro(404, 'Grupo não encontrado.');
        if (!grupo.ativo) return erro(400, 'Grupo inativo.');
        const grupoApl = normalizarAplicabilidade(grupo.aplicabilidade);
        if (grupoApl === 'militar' && !['militar', 'todos'].includes(aplicabilidade)) return erro(400, 'Grupo militar só aceita tag militar/todos.');
        if (grupoApl === 'ferias' && !['ferias', 'todos'].includes(aplicabilidade)) return erro(400, 'Grupo ferias só aceita tag ferias/todos.');
      }

      const ativas = await base44.asServiceRole.entities.Tag.filter({ ativo: true }, undefined, 2000, 0);
      const nomeNorm = normalizeNome(nome);
      const duplicada = (ativas || []).some((t: any) => {
        if (String(t.id) === String(id || '')) return false;
        if (normalizeNome(t.nome) !== nomeNorm) return false;
        const tg = String(t.grupo_id || '').trim() || null;
        return tg === grupoId;
      });
      if (duplicada) return erro(400, 'Já existe tag ativa com este nome no mesmo grupo.');

      const payload = { ...data, nome, grupo_id: grupoId, aplicabilidade, tipo_visual: tipoVisual, ativo: true };
      logDev('[TAG_BACKEND_PAYLOAD]', { entidade, operacao, id, payload });
      if (operacao === 'create') {
        const created = await svc.create(payload);
        logDev('[TAG_BACKEND_RESULT]', { entidade, operacao, id, result: created });
        return Response.json({ data: created });
      }
      const updated = await svc.update(String(id), payload);
      logDev('[TAG_BACKEND_RESULT]', { entidade, operacao, id, result: updated });
      return Response.json({ data: updated });
    }

    if (entidade === 'MilitarFuncao') {
      const militarId = String(data?.militar_id || registroAtual?.militar_id || '');
      if (!militarId) return erro(400, 'militar_id é obrigatório.');
      if (!isInScope(militarId)) return erro(403, 'Militar fora do escopo.');
      if (operacao === 'create' || operacao === 'update') { /* unchanged */
        const funcaoId = String(data?.funcao_militar_id || registroAtual?.funcao_militar_id || '');
        if (!funcaoId) return erro(400, 'funcao_militar_id é obrigatório.');
        const [funcao] = await base44.asServiceRole.entities.FuncaoMilitar.filter({ id: funcaoId }, undefined, 1, 0);
        if (!funcao) return erro(404, 'Função não encontrada.');
        if (!funcao.ativa) return erro(400, 'Função inativa.');
        const ativas = await base44.asServiceRole.entities.MilitarFuncao.filter({ militar_id: militarId, status: 'ativa' }, undefined, 1000, 0);
        const chave = String(funcao?.institucional_chave || '').toLowerCase();
        if (chave === 'comandante' || chave === 'subcomandante') {
          const idsParaConsultar = Array.from(new Set((ativas || []).filter((v: any) => String(v.id) !== String(id || '')).map((v: any) => v.funcao_militar_id).filter(Boolean)));
          if (idsParaConsultar.length > 0) {
            const funcoes = await base44.asServiceRole.entities.FuncaoMilitar.filter({ id: { $in: idsParaConsultar } }, undefined, 1000, 0);
            if ((funcoes || []).some((f: any) => String(f?.institucional_chave || '').toLowerCase() === chave)) {
              return erro(400, `Já existe vínculo ativo de ${chave} para este militar.`);
            }
          }
        }
        if (data?.principal === true) {
          const outrosPrincipais = (ativas || []).filter((v: any) => v.principal === true && String(v.id) !== String(id || ''));
          await Promise.all(outrosPrincipais.map((v: any) => svc.update(String(v.id), { principal: false })));
        }
        if (operacao === 'create') return Response.json({ data: await svc.create({ ...data, militar_id: militarId, status: 'ativa' }) });
        return Response.json({ data: await svc.update(String(id), { ...data, militar_id: militarId }) });
      }
      if (operacao !== 'encerrar') return erro(400, 'Delete físico não permitido.');
      return Response.json({ data: await svc.update(String(id), { status: 'encerrada', principal: false, data_fim: data?.data_fim || new Date().toISOString().slice(0, 10), motivo: data?.motivo || registroAtual?.motivo || null }) });
    }

    if (entidade === 'MilitarTag') {
      const militarId = String(data?.militar_id || registroAtual?.militar_id || '');
      if (!militarId) return erro(400, 'militar_id é obrigatório.');
      if (!isInScope(militarId)) return erro(403, 'Militar fora do escopo.');
      if (operacao === 'create' || operacao === 'update') {
        const tagId = String(data?.tag_id || registroAtual?.tag_id || '');
        if (!tagId) return erro(400, 'tag_id é obrigatório.');
        const [tag] = await base44.asServiceRole.entities.Tag.filter({ id: tagId }, undefined, 1, 0);
        if (!tag) return erro(404, 'Tag não encontrada.');
        if (!tag.ativo) return erro(400, 'Tag inativa.');
        if (!['militar', 'todos', 'ambos'].includes(String(tag.aplicabilidade || ''))) return erro(400, 'Tag incompatível para militar.');
        const duplicadas = await base44.asServiceRole.entities.MilitarTag.filter({ militar_id: militarId, tag_id: tagId, status: 'ativa' }, undefined, 1000, 0);
        if ((duplicadas || []).some((d: any) => String(d.id) !== String(id || ''))) return erro(400, 'Tag ativa já vinculada para este militar.');
        if (operacao === 'create') return Response.json({ data: await svc.create({ ...data, militar_id: militarId, status: 'ativa' }) });
        return Response.json({ data: await svc.update(String(id), { ...data, militar_id: militarId }) });
      }
      if (operacao !== 'remover') return erro(400, 'Delete físico não permitido.');
      return Response.json({ data: await svc.update(String(id), { status: 'removida', data_remocao: data?.data_remocao || new Date().toISOString().slice(0, 10), motivo: data?.motivo || registroAtual?.motivo || null }) });
    }

    const feriasId = String(data?.ferias_id || registroAtual?.ferias_id || '');
    if (!feriasId) return erro(400, 'ferias_id é obrigatório.');
    const [ferias] = await base44.asServiceRole.entities.Ferias.filter({ id: feriasId }, undefined, 1, 0);
    if (!ferias) return erro(404, 'Férias não encontrada.');
    if (!isInScope(String(ferias.militar_id || ''))) return erro(403, 'Férias fora do escopo.');
    if (operacao === 'create' || operacao === 'update') {
      const tagId = String(data?.tag_id || registroAtual?.tag_id || '');
      if (!tagId) return erro(400, 'tag_id é obrigatório.');
      const [tag] = await base44.asServiceRole.entities.Tag.filter({ id: tagId }, undefined, 1, 0);
      if (!tag) return erro(404, 'Tag não encontrada.');
      if (!tag.ativo) return erro(400, 'Tag inativa.');
      if (!['ferias', 'todos', 'ambos'].includes(String(tag.aplicabilidade || ''))) return erro(400, 'Tag incompatível para férias.');
      const duplicadas = await base44.asServiceRole.entities.FeriasTag.filter({ ferias_id: feriasId, tag_id: tagId, status: 'ativa' }, undefined, 1000, 0);
      if ((duplicadas || []).some((d: any) => String(d.id) !== String(id || ''))) return erro(400, 'Tag ativa já vinculada para esta férias.');
      if (operacao === 'create') return Response.json({ data: await svc.create({ ...data, ferias_id: feriasId, status: 'ativa' }) });
      return Response.json({ data: await svc.update(String(id), { ...data, ferias_id: feriasId }) });
    }
    if (operacao !== 'remover') return erro(400, 'Delete físico não permitido.');
    return Response.json({ data: await svc.update(String(id), { status: 'removida', data_remocao: data?.data_remocao || new Date().toISOString().slice(0, 10), motivo: data?.motivo || registroAtual?.motivo || null }) });
  } catch (error: any) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro interno.' }, { status });
  }
});