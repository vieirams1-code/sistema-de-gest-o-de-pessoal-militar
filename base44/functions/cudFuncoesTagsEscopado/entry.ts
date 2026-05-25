import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ENTIDADES = new Set(['MilitarFuncao', 'MilitarTag', 'FeriasTag', 'FuncaoMilitar', 'TagGrupo', 'Tag']);
const OPERACOES = new Set(['create', 'update', 'encerrar', 'remover', 'desativar']);

const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id', 'perfil_id'];

const PERMISSIONS_MAP: Record<string, string[]> = {
  MilitarFuncao: ['adicionar_militares', 'editar_militares'],
  MilitarTag: ['adicionar_militares', 'editar_militares'],
  FeriasTag: ['adicionar_ferias', 'editar_ferias'],
  FuncaoMilitar: ['gerir_configuracoes'],
  TagGrupo: ['gerir_configuracoes'],
  Tag: ['gerir_configuracoes'],
};

const APLICABILIDADES = new Set(['militar', 'ferias', 'ambos']);
const TIPOS_VISUAIS = new Set(['normal', 'destaque', 'alerta', 'favorito', 'critico']);
const TIPOS_USO_TAG = new Set(['comum', 'unica']);
const INSTITUCIONAIS = new Set(['comandante', 'subcomandante']);

const normalizeTipo = (t: unknown) => String(t || '').trim().toLowerCase();
const normalizeNome = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();

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
  for (const acesso of acessos || []) {
    const tipo = normalizeTipo(acesso?.tipo_acesso);
    if (tipo === 'admin') return null;
    if (tipo === 'proprio') { if (acesso?.militar_id) ids.add(String(acesso.militar_id)); continue; }
    const filtros: any[] = [];
    const grupamentoId = acesso?.grupamento_id || null;
    const subgrupamentoId = acesso?.subgrupamento_id || null;
    if (tipo === 'setor' && grupamentoId) filtros.push({ grupamento_raiz_id: grupamentoId }, { grupamento_id: grupamentoId }, { estrutura_id: grupamentoId });
    else if (tipo === 'subsetor' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
      const filhos = await base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }, undefined, 1000, 0, ['id']);
      for (const filho of (filhos || [])) if (filho?.id) filtros.push({ estrutura_id: filho.id }, { subgrupamento_id: filho.id });
    } else if (tipo === 'unidade' && subgrupamentoId) filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
    for (const filtro of filtros) {
      const militares = await base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, ['id']);
      for (const m of (militares || [])) if (m?.id) ids.add(String(m.id));
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
  if (normalized === 'ambos') return 'ambos';
  return null;
}
function validarAplicabilidade(value: unknown) { return APLICABILIDADES.has(String(value || '').trim()); }
function validarTipoVisual(value: unknown) { return TIPOS_VISUAIS.has(String(value || '').trim()); }
function normalizarTipoUsoTag(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'comum';
  return normalized;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return erro(401, 'Não autenticado.');

    const { entidade, operacao, id, data = {} } = await req.json();
    if (!ENTIDADES.has(entidade) || !OPERACOES.has(operacao)) return erro(400, 'Entidade/operação inválida.');

    const perms = await resolverPermissoes(base44, authUser.email);
    const isAdmin = String(authUser.role || '').toLowerCase() === 'admin' || perms.isAdminByAccess;
    if (!isAdmin) {
      const required = PERMISSIONS_MAP[entidade] || [];
      if (!required.some((p) => perms.actions[p] === true)) return erro(403, 'Sem permissão para esta ação.');
    }

    const svc = base44.asServiceRole.entities[entidade];
    const militarIdsEscopo = isAdmin ? null : await listarMilitarIdsDoEscopo(base44, perms.acessos);
    const isInScope = (mid: unknown) => militarIdsEscopo === null || militarIdsEscopo.includes(String(mid || ''));
    const registroAtual = (operacao === 'update' || operacao === 'encerrar' || operacao === 'remover' || operacao === 'desativar') ? await svc.get(String(id || '')) : null;
    if ((operacao === 'update' || operacao === 'encerrar' || operacao === 'remover' || operacao === 'desativar') && !registroAtual) return erro(404, 'Registro não encontrado.');

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
      if (!['create', 'update', 'desativar'].includes(operacao)) return erro(400, 'Operação inválida para TagGrupo.');
      if (operacao === 'desativar') {
        const ativo = typeof data?.ativo === 'boolean' ? data.ativo : false;
        return Response.json({ data: await svc.update(String(id), { ativo }) });
      }
      const nome = String(data?.nome ?? registroAtual?.nome ?? '').trim();
      if (!nome) return erro(400, 'nome é obrigatório.');
      const aplicabilidade = normalizarAplicabilidade(data?.aplicabilidade ?? registroAtual?.aplicabilidade ?? '');
      const tipoVisualRaw = String(data?.tipo_visual ?? registroAtual?.tipo_visual ?? 'normal').trim();
      const tipoVisual = tipoVisualRaw === 'chip' ? 'normal' : tipoVisualRaw;
      if (!aplicabilidade || !validarAplicabilidade(aplicabilidade)) return erro(400, 'Aplicabilidade deve ser Militar, Férias ou Ambos.');
      if (!validarTipoVisual(tipoVisual)) return erro(400, 'tipo_visual inválido.');
      const gruposAtivos = await base44.asServiceRole.entities.TagGrupo.filter({ ativo: true }, undefined, 1000, 0);
      const nomeNorm = normalizeNome(nome);
      if ((gruposAtivos || []).some((g: any) => String(g.id) !== String(id || '') && normalizeNome(g.nome) === nomeNorm)) return erro(400, 'Já existe grupo ativo com este nome.');
      const payload = { ...data, nome, aplicabilidade, tipo_visual: tipoVisual, ativo: true };
      if (operacao === 'create') return Response.json({ data: await svc.create(payload) });
      return Response.json({ data: await svc.update(String(id), payload) });
    }

    if (entidade === 'Tag') {
      if (!['create', 'update', 'desativar'].includes(operacao)) return erro(400, 'Operação inválida para Tag.');
      if (operacao === 'desativar') {
        const ativo = typeof data?.ativo === 'boolean' ? data.ativo : false;
        return Response.json({ data: await svc.update(String(id), { ativo }) });
      }
      const nome = String(data?.nome ?? registroAtual?.nome ?? '').trim();
      if (!nome) return erro(400, 'nome é obrigatório.');
      const grupoId = String(data?.grupo_id ?? registroAtual?.grupo_id ?? '').trim() || null;
      const aplicabilidade = normalizarAplicabilidade(data?.aplicabilidade ?? registroAtual?.aplicabilidade ?? '');
      const tipoVisualRaw = String(data?.tipo_visual ?? registroAtual?.tipo_visual ?? 'normal').trim();
      const tipoVisual = tipoVisualRaw === 'chip' ? 'normal' : tipoVisualRaw;
      const tipoUso = normalizarTipoUsoTag(data?.tipo_uso ?? registroAtual?.tipo_uso);
      if (!aplicabilidade || !validarAplicabilidade(aplicabilidade)) return erro(400, 'Aplicabilidade deve ser Militar, Férias ou Ambos.');
      if (!validarTipoVisual(tipoVisual)) return erro(400, 'tipo_visual inválido.');
      if (!TIPOS_USO_TAG.has(tipoUso)) return erro(400, 'tipo_uso inválido. Valores aceitos: comum ou unica.');

      let grupo: any = null;
      if (grupoId) {
        [grupo] = await base44.asServiceRole.entities.TagGrupo.filter({ id: grupoId }, undefined, 1, 0);
        if (!grupo) return erro(404, 'Grupo não encontrado.');
        if (!grupo.ativo) return erro(400, 'Grupo inativo.');
        const grupoApl = String(grupo.aplicabilidade || '');
        if (grupoApl === 'militar' && !['militar', 'ambos'].includes(aplicabilidade)) return erro(400, 'Grupo militar só aceita tag militar/ambos.');
        if (grupoApl === 'ferias' && !['ferias', 'ambos'].includes(aplicabilidade)) return erro(400, 'Grupo ferias só aceita tag ferias/ambos.');
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

      const payload = { ...data, nome, grupo_id: grupoId, aplicabilidade, tipo_visual: tipoVisual, tipo_uso: tipoUso, ativo: true };
      if (operacao === 'create') return Response.json({ data: await svc.create(payload) });
      return Response.json({ data: await svc.update(String(id), payload) });
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
          const ativosMesmoTipo = await Promise.all((ativas || []).filter((v: any) => String(v.id) !== String(id || '')).map(async (v: any) => {
            const [f] = await base44.asServiceRole.entities.FuncaoMilitar.filter({ id: v.funcao_militar_id }, undefined, 1, 0);
            return String(f?.institucional_chave || '').toLowerCase() === chave;
          }));
          if (ativosMesmoTipo.some(Boolean)) return erro(400, `Já existe vínculo ativo de ${chave} para este militar.`);
        }
        if (data?.principal === true) {
          const outrosPrincipais = (ativas || []).filter((v: any) => v.principal === true && String(v.id) !== String(id || ''));
          for (const v of outrosPrincipais) await svc.update(String(v.id), { principal: false });
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
        if (!['militar', 'ambos'].includes(String(tag.aplicabilidade || ''))) return erro(400, 'Tag incompatível para militar.');
        const tipoUsoTag = normalizarTipoUsoTag(tag.tipo_uso);
        const duplicadas = await base44.asServiceRole.entities.MilitarTag.filter({ militar_id: militarId, tag_id: tagId, status: 'ativa' }, undefined, 1000, 0);
        if ((duplicadas || []).some((d: any) => String(d.id) !== String(id || ''))) return erro(400, 'Tag ativa já vinculada para este militar.');
        if (tipoUsoTag === 'unica') {
          const vinculosAtivos = await base44.asServiceRole.entities.MilitarTag.filter({ tag_id: tagId, status: 'ativa' }, undefined, 1000, 0);
          const conflito = (vinculosAtivos || []).find((v: any) => String(v.id) !== String(id || '') && String(v.militar_id || '') !== militarId);
          if (conflito) {
            const [militarConflito] = await base44.asServiceRole.entities.Militar.filter({ id: String(conflito.militar_id || '') }, undefined, 1, 0, ['id', 'nome', 'nome_guerra', 'posto_grad']);
            const militarNome = String(militarConflito?.nome_guerra || militarConflito?.nome || 'militar');
            const postoGrad = String(militarConflito?.posto_grad || '').trim();
            const identificacao = postoGrad ? `${postoGrad} ${militarNome}` : militarNome;
            return Response.json({
              error: `Esta tag já está atribuída a ${identificacao}. Remova a tag desse militar antes de atribuir a outro.`,
              code: 'TAG_UNICA_CONFLITO',
              militar_id: String(conflito.militar_id || ''),
              militar_nome: militarNome,
              posto_grad: postoGrad,
            }, { status: 409 });
          }
        }
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
      if (!['ferias', 'ambos'].includes(String(tag.aplicabilidade || ''))) return erro(400, 'Tag incompatível para férias.');
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
