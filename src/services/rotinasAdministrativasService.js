import { base44 } from '@/api/base44Client';
import { criarEscopado, atualizarEscopado, excluirEscopado, bulkEscopado } from './cudEscopadoClient';

/**
 * Service para gestão de Rotinas Administrativas.
 */

const ENTITY_ROTINA = 'RotinaAdministrativa';
const ENTITY_EXECUCAO = 'ExecucaoRotinaAdministrativa';
const ENTITY_ITEM = 'ItemExecucaoRotinaAdministrativa';

export async function getRotinasAdministrativas(unidadeId, hasGlobalAccess = false) {
  const query = {
    ativo: true,
  };

  if (!hasGlobalAccess && unidadeId) {
    query.unidade_id = unidadeId;
  }

  return base44.entities[ENTITY_ROTINA].list({
    query,
    sort: 'nome',
  });
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

export async function salvarRotina(rotina) {
  if (rotina.id) {
    return atualizarEscopado(ENTITY_ROTINA, rotina.id, rotina);
  }
  return criarEscopado(ENTITY_ROTINA, rotina);
}

export async function excluirRotina(id) {
  return excluirEscopado(ENTITY_ROTINA, id);
}

export async function atualizarStatusExecucao(id, status, extra = {}) {
  return atualizarEscopado(ENTITY_EXECUCAO, id, { status, ...extra });
}

/**
 * Lógica específica para Memorando TARS
 */
export async function executarMemorandoTars(rotina, params, usuario) {
  const { data_inicio, data_fim, incluir_anexos, observacoes } = params;

  // 1. Buscar atestados do período e unidade
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

function renderizarTemplateMemorando(template, data) {
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

export async function getItensExecucao(execucaoId) {
  return base44.entities[ENTITY_ITEM].list({
    query: { execucao_id: execucaoId }
  });
}
