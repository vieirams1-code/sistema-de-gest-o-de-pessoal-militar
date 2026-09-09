import { base44 } from '../api/base44Client.js';
import { fetchScopedMedalhasBundle } from './getScopedMedalhasBundleClient.js';

let runtimeClient = null;

export function __setMilitarTimelineClientForTests(client) {
  runtimeClient = client;
}

function getClient() {
  return runtimeClient || base44;
}

/**
 * Monta a linha do tempo institucional única de um militar.
 *
 * @param {string} militarId - ID do militar.
 * @returns {Promise<Array>} - Lista de eventos formatada e ordenada.
 */
export async function getMilitarTimeline(militarId, permissions = {}) {
  if (!militarId) return [];

  const client = getClient();
  const allowed = {
    livro: permissions?.livro === true,
    publicacoes: permissions?.publicacoes === true,
    ferias: permissions?.ferias === true,
    atestados: permissions?.atestados === true,
    atestadoSensitive: permissions?.atestadoSensitive === true,
    antiguidade: permissions?.antiguidade === true,
    medalhas: permissions?.medalhas === true,
    funcoes: permissions?.funcoes === true,
    gratificacoes: permissions?.gratificacoes === true,
  };
  const maybe = (enabled, fn) => enabled ? fn() : Promise.resolve([]);
  const carregarMedalhasTimeline = async () => {
    if (runtimeClient) {
      // Fallback exclusivo para o cliente injetado pelos testes unitários.
      return client.entities.Medalha.filter({ militar_id: militarId });
    }
    const { medalhas = [] } = await fetchScopedMedalhasBundle({
      readPurpose: 'VIEW',
      militarId,
    });
    return medalhas;
  };
  const carregarFeriasTimeline = async () => {
    if (runtimeClient) {
      // Fallback exclusivo para o cliente injetado pelos testes unitários.
      return client.entities.Ferias.filter({ militar_id: militarId });
    }
    const { fetchScopedPeriodosAquisitivosBundle } = await import('./getScopedPeriodosAquisitivosBundleClient.js');
    const { ferias = [] } = await fetchScopedPeriodosAquisitivosBundle();
    return ferias.filter((item) => String(item?.militar_id || '') === String(militarId));
  };

  const [
    registrosLivro,
    publicacoesExOfficio,
    ferias,
    atestados,
    promocoes,
    medalhas,
    vinculosFuncoes,
    gratificacoes,
    funcoesCatalogo,
    tiposGratificacao
  ] = await Promise.all([
    maybe(allowed.livro, () => client.entities.RegistroLivro.filter({ militar_id: militarId })),
    maybe(allowed.publicacoes, () => client.entities.PublicacaoExOfficio.filter({ militar_id: militarId })),
    maybe(allowed.ferias, carregarFeriasTimeline),
    maybe(allowed.atestados, () => client.entities.Atestado.filter({ militar_id: militarId })),
    maybe(allowed.antiguidade, () => client.entities.HistoricoPromocaoMilitarV2.filter({ militar_id: militarId })),
    maybe(allowed.medalhas, carregarMedalhasTimeline),
    maybe(allowed.funcoes, () => client.entities.MilitarFuncao.filter({ militar_id: militarId })),
    maybe(allowed.gratificacoes, () => client.entities.GratificacaoFuncao.filter({ militar_id: militarId })),
    maybe(allowed.funcoes, () => client.entities.FuncaoMilitar.list()),
    maybe(allowed.gratificacoes, () => client.entities.TipoGratificacaoFuncao.list())
  ]);

  const funcoesMap = new Map((funcoesCatalogo || []).map(f => [f.id, f]));
  const tiposGratificacaoMap = new Map((tiposGratificacao || []).map(t => [t.id, t]));

  const timeline = [
    ...(registrosLivro || []).map(item => ({
      id: item.id,
      data: item.data_publicacao || item.created_date,
      tipo: 'Publicação',
      categoria: 'Registro',
      titulo: item.tipo_registro || item.tipo || 'Registro de Livro',
      descricao: item.conteudo || item.descricao || '',
      origem: 'RegistroLivro'
    })),
    ...(publicacoesExOfficio || []).map(item => {
      const isDOEMS = item.tipo === 'Registro de Publicação DOEMS';
      return {
        id: item.id,
        data: item.data_publicacao || item.created_date,
        tipo: 'Publicação',
        categoria: 'Registro',
        titulo: isDOEMS
          ? `Registro de Publicação DOEMS${item.subtipo_geral ? ` (${item.subtipo_geral})` : ''}`
          : item.tipo || 'Publicação Ex Officio',
        descricao: [
          item.doems_edicao_numero ? `DOEMS: ${item.doems_edicao_numero}` : '',
          item.conteudo || item.texto_publicacao || '',
        ]
          .filter(Boolean)
          .join(' — '),
        origem: isDOEMS ? 'Publicação externa' : 'PublicacaoExOfficio',
      };
    }),
    ...(ferias || []).map(item => ({
      id: item.id,
      data: item.data_inicio,
      tipo: 'Férias',
      categoria: 'Férias',
      titulo: 'Gozo de Férias',
      descricao: `${item.dias || 0} dias ref. ao período ${item.periodo_aquisitivo_ref || 'N/D'}`,
      origem: 'Ferias'
    })),
    ...(atestados || []).map(item => ({
      id: item.id,
      data: item.data_inicio,
      tipo: 'Atestado',
      categoria: 'Saúde',
      titulo: item.tipo_afastamento || 'Atestado Médico',
      descricao: `${item.dias || 0} dias${allowed.atestadoSensitive && item.cid_10 ? ' - CID: ' + item.cid_10 : ''}`,
      origem: 'Atestado'
    })),
    ...(promocoes || []).map(item => ({
      id: item.id,
      data: item.data_promocao,
      tipo: 'Promoção',
      categoria: 'Carreira',
      titulo: `${item.posto_graduacao_novo || ''} ${item.quadro_novo || ''}`.trim() || 'Promoção',
      descricao: `Boletim: ${item.boletim_referencia || 'N/D'}`,
      origem: 'HistoricoPromocaoMilitarV2'
    })),
    ...(medalhas || []).map(item => ({
      id: item.id,
      data: item.data_concessao || item.data_indicacao,
      tipo: 'Medalha',
      categoria: 'Carreira',
      titulo: item.tipo_medalha_nome || 'Medalha',
      descricao: `Status: ${item.status || 'N/D'}`,
      origem: 'Medalha'
    })),
    ...(vinculosFuncoes || []).map(item => {
      const f = funcoesMap.get(item.funcao_militar_id);
      return {
        id: item.id,
        data: item.data_inicio,
        tipo: 'Função',
        categoria: 'Função',
        titulo: f?.nome || 'Função',
        descricao: `${item.principal ? 'Principal - ' : ''}${item.status || 'Ativa'} desde ${item.data_inicio}`,
        origem: 'MilitarFuncao'
      };
    }),
    ...(gratificacoes || []).map(item => {
      const t = tiposGratificacaoMap.get(item.tipo_gratificacao_funcao_id);
      return {
        id: item.id,
        data: item.data_publicacao_nomeacao || item.data_solicitacao || item.created_date,
        tipo: 'Gratificação',
        categoria: 'Gratificação',
        titulo: item.tipo_gratificacao || t?.nome || 'Gratificação de Função',
        descricao: `${item.funcao_gratificada || ''} - Status: ${item.status || 'N/D'}`,
        origem: 'GratificacaoFuncao'
      };
    })
  ];

  // Ignorar registros inválidos (sem data)
  const validTimeline = timeline.filter(item => !!item.data);

  // Deduplicação por objeto completo
  const seen = new Set();
  const uniqueTimeline = validTimeline.filter(item => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Ordenação: mais recente primeiro
  return uniqueTimeline.sort((a, b) => {
    return new Date(b.data) - new Date(a.data);
  });
}
