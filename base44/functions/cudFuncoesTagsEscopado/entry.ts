import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ENTIDADES = new Set(['MilitarFuncao', 'MilitarTag', 'FeriasTag']);
const OPERACOES = new Set(['create', 'update', 'encerrar', 'remover']);

const CAMPOS_USUARIO_ACESSO = ['id', 'user_email', 'ativo', 'tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id', 'perfil_id'];

const PERMISSIONS_MAP: Record<string, string[]> = {
  MilitarFuncao: ['adicionar_militares', 'editar_militares'],
  MilitarTag: ['adicionar_militares', 'editar_militares'],
  FeriasTag: ['adicionar_ferias', 'editar_ferias'],
};

const normalizeTipo = (t: unknown) => String(t || '').trim().toLowerCase();

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
    if (tipo === 'setor' && grupamentoId) {
      filtros.push({ grupamento_raiz_id: grupamentoId }, { grupamento_id: grupamentoId }, { estrutura_id: grupamentoId });
    } else if (tipo === 'subsetor' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
      const filhos = await base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }, undefined, 1000, 0, ['id']);
      for (const filho of (filhos || [])) if (filho?.id) filtros.push({ estrutura_id: filho.id }, { subgrupamento_id: filho.id });
    } else if (tipo === 'unidade' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
    }

    for (const filtro of filtros) {
      const militares = await base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, ['id']);
      for (const m of (militares || [])) if (m?.id) ids.add(String(m.id));
    }
  }
  return Array.from(ids);
}

function erro(status: number, message: string) { return Response.json({ error: message }, { status }); }

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

    const registroAtual = (operacao === 'update' || operacao === 'encerrar' || operacao === 'remover')
      ? await svc.get(String(id || ''))
      : null;
    if ((operacao === 'update' || operacao === 'encerrar' || operacao === 'remover') && !registroAtual) return erro(404, 'Registro não encontrado.');

    if (entidade === 'MilitarFuncao') {
      const militarId = String(data?.militar_id || registroAtual?.militar_id || '');
      if (!militarId) return erro(400, 'militar_id é obrigatório.');
      if (!isInScope(militarId)) return erro(403, 'Militar fora do escopo.');

      if (operacao === 'create' || operacao === 'update') {
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
        const duplicadas = await base44.asServiceRole.entities.MilitarTag.filter({ militar_id: militarId, tag_id: tagId, status: 'ativa' }, undefined, 1000, 0);
        if ((duplicadas || []).some((d: any) => String(d.id) !== String(id || ''))) return erro(400, 'Tag ativa já vinculada para este militar.');

        if (operacao === 'create') return Response.json({ data: await svc.create({ ...data, militar_id: militarId, status: 'ativa' }) });
        return Response.json({ data: await svc.update(String(id), { ...data, militar_id: militarId }) });
      }

      if (operacao !== 'remover') return erro(400, 'Delete físico não permitido.');
      return Response.json({ data: await svc.update(String(id), { status: 'removida', data_remocao: data?.data_remocao || new Date().toISOString().slice(0, 10), motivo: data?.motivo || registroAtual?.motivo || null }) });
    }

    // FeriasTag
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
