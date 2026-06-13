import { base44 } from '@/api/base44Client';
import { criarEscopado, atualizarEscopado, excluirEscopado, bulkEscopado } from './cudEscopadoClient.js';

/**
 * Service para gestão de Rotinas Administrativas.
 */

const ENTITY_ROTINA = 'RotinaAdministrativa';
const ENTITY_EXECUCAO = 'ExecucaoRotinaAdministrativa';
const ENTITY_ITEM = 'ItemExecucaoRotinaAdministrativa';

export async function getRotinasAdministrativas(unidadeId, hasGlobalAccess = false) {
  console.log('[RotinasAdministrativas] getRotinasAdministrativas params:', { unidadeId, hasGlobalAccess });
  const query = {
    ativo: true,
  };

  if (!hasGlobalAccess) {
    // Se não tem acesso global, FILTRA OBRIGATORIAMENTE por unidade_id.
    // Se unidadeId for nulo/undefined, o filtro forçará zero resultados por segurança,
    // a menos que o backend tenha regra de bypass (que no caso de RotinaAdministrativa não tem para usuários comuns).
    query.unidade_id = unidadeId || 'SEM_UNIDADE_DEFINIDA';
  }

  const results = await base44.entities[ENTITY_ROTINA].list({
    query,
    sort: 'nome',
  });

  console.log('[RotinasAdministrativas] getRotinasAdministrativas result count:', results.length);
  return results;
}

export async function getExecucoesRotina(unidadeId, filters = {}, hasGlobalAccess = false) {
  const query = { ...filters };

  if (!hasGlobalAccess && unidadeId) {
    query.unidade_id = unidadeId;
  }

  return base44.entities[ENTITY_EXECUCAO].list({
    query,
    sort: '-data_geracao',
  });
}

export async function salvarRotina(rotina, usuario) {
  console.log('[RotinasAdministrativas] salvarRotina usuario:', {
    id: usuario?.id,
    full_name: usuario?.full_name,
    unidade_id: usuario?.unidade_id,
    unidade: usuario?.unidade
  });

  const payload = {
    ...rotina,
    updated_date: new Date().toISOString()
  };

  // Fallbacks para unidade e escopo
  if (!payload.unidade_id) {
    payload.unidade_id = usuario?.unidade_id || usuario?.unidade?.id || usuario?.subgrupamento_id;
  }
  if (!payload.unidade_nome) {
    payload.unidade_nome = usuario?.unidade_nome || usuario?.unidade?.nome || usuario?.subgrupamento_nome;
  }
  if (!payload.escopo_tipo) {
    payload.escopo_tipo = 'unidade';
  }
  if (payload.ativo === undefined) {
    payload.ativo = true;
  }

  // Garantir metadados de criação
  if (!payload.id) {
    payload.criado_por = usuario?.id;
    payload.criado_por_nome = usuario?.full_name;
    payload.created_date = payload.updated_date;
  }

  if (!payload.unidade_id && payload.escopo_tipo === 'unidade') {
    throw new Error('Não foi possível determinar a unidade para salvar a rotina. Por favor, verifique seu perfil.');
  }

  console.log('[RotinasAdministrativas] salvarRotina final payload:', payload);

  if (payload.id) {
    return atualizarEscopado(ENTITY_ROTINA, payload.id, payload);
  }
  return criarEscopado(ENTITY_ROTINA, payload);
}

export async function inativarRotina(id) {
  return atualizarEscopado(ENTITY_ROTINA, id, { ativo: false });
}

export async function excluirRotina(id) {
  // Verificar se há execuções antes de excluir (proteção no service)
  const execs = await base44.entities[ENTITY_EXECUCAO].list({
    query: { rotina_id: id },
    limit: 1
  });

  if (execs.length > 0) {
    return inativarRotina(id);
  }

  return excluirEscopado(ENTITY_ROTINA, id);
}

export async function atualizarStatusExecucao(id, status, usuario, extra = {}) {
  const payload = { status, ...extra };

  if (status === 'concluida') {
    payload.data_conclusao = new Date().toISOString();
    payload.concluido_por = usuario.id;
    payload.concluido_por_nome = usuario.full_name;
  }

  return atualizarEscopado(ENTITY_EXECUCAO, id, payload);
}

/**
 * Lógica específica para Memorando TARS
 */
export async function executarMemorandoTars(rotina, params, usuario) {
  const { data_inicio, data_fim, incluir_anexos, observacoes } = params;

  if (!data_inicio || !data_fim) {
    throw new Error('Período de início e fim é obrigatório.');
  }

  // 1. Buscar atestados do período e unidade DA ROTINA (Reforço de escopo)
  const atestados = await base44.entities.Atestado.list({
    query: {
      unidade_id: rotina.unidade_id,
      data_inicio: { $gte: data_inicio },
      data_fim: { $lte: data_fim },
    }
  });

  // 2. Criar a execução
  const execucao = await criarEscopado(ENTITY_EXECUCAO, {
    rotina_id: rotina.id,
    rotina_nome: rotina.nome,
    status: 'pendente',
    competencia_inicio: data_inicio,
    competencia_fim: data_fim,
    data_geracao: new Date().toISOString(),
    responsavel_id: usuario.id,
    responsavel_nome: usuario.full_name,
    unidade_id: rotina.unidade_id,
    unidade_nome: rotina.unidade_nome,
    quantidade_itens: atestados.length,
    observacoes,
  });

  // 3. Criar itens de execução
  const itens = atestados.map(atestado => ({
    execucao_id: execucao.id,
    origem_tipo: 'atestado',
    origem_id: atestado.id,
    militar_id: atestado.militar_id,
    militar_nome: atestado.militar_nome,
    militar_posto_graduacao: atestado.militar_posto_graduacao,
    militar_matricula: atestado.militar_matricula,
    descricao: `Atestado de ${atestado.quantidade_dias} dias`,
    data_inicio: atestado.data_inicio,
    data_fim: atestado.data_fim,
    possui_anexo: !!atestado.arquivo_url
  }));

  if (itens.length > 0) {
    await bulkEscopado(ENTITY_ITEM, itens);
  }

  // 4. Gerar texto do memorando
  const textoGerado = renderizarTemplateMemorando(rotina.template_texto, {
    data_inicio,
    data_fim,
    atestados,
    usuario_nome: usuario.full_name,
    usuario_funcao: usuario.funcao || 'Responsável Administrativo',
    unidade_nome: rotina.unidade_nome
  });

  await atualizarEscopado(ENTITY_EXECUCAO, execucao.id, { texto_gerado: textoGerado });

  return { ...execucao, texto_gerado: textoGerado, itens };
}

export function renderizarTemplateMemorando(template, data) {
  let text = template || '';

  const tabela = data.atestados.length > 0
    ? `\n| Militar | Matrícula | Período | Dias | \n| --- | --- | --- | --- |\n` +
      data.atestados.map(a => `| ${a.militar_posto_graduacao} ${a.militar_nome} | ${a.militar_matricula} | ${a.data_inicio} a ${a.data_fim} | ${a.quantidade_dias} |`).join('\n')
    : '\nNenhum atestado registrado no período.\n';

  const replacements = {
    '{{data_inicio}}': data.data_inicio,
    '{{data_fim}}': data.data_fim,
    '{{tabela_atestados}}': tabela,
    '{{usuario_nome}}': data.usuario_nome,
    '{{usuario_funcao}}': data.usuario_funcao,
    '{{unidade_nome}}': data.unidade_nome
  };

  Object.entries(replacements).forEach(([key, value]) => {
    text = text.replace(new RegExp(key, 'g'), value || '');
  });

  return text;
}

export async function getItensExecucao(execucaoId, unidadeId, hasGlobalAccess = false) {
  // Reforço de escopo para itens
  if (!hasGlobalAccess && unidadeId) {
    const exec = await base44.entities[ENTITY_EXECUCAO].get(execucaoId);
    if (exec && exec.unidade_id !== unidadeId) {
      throw new Error('Acesso negado aos itens desta execução.');
    }
  }

  return base44.entities[ENTITY_ITEM].list({
    query: { execucao_id: execucaoId }
  });
}
