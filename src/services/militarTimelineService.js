import { base44 } from '../api/base44Client.js';

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
export async function getMilitarTimeline(militarId) {
  if (!militarId) return [];

  const client = getClient();

  const [
    registrosLivro,
    publicacoesExOfficio,
    ferias,
    atestados,
    promocoes,
    medalhas
  ] = await Promise.all([
    client.entities.RegistroLivro.filter({ militar_id: militarId }),
    client.entities.PublicacaoExOfficio.filter({ militar_id: militarId }),
    client.entities.Ferias.filter({ militar_id: militarId }),
    client.entities.Atestado.filter({ militar_id: militarId }),
    client.entities.HistoricoPromocaoMilitarV2.filter({ militar_id: militarId }),
    client.entities.Medalha.filter({ militar_id: militarId })
  ]);

  const timeline = [
    ...(registrosLivro || []).map(item => ({
      id: item.id,
      data: item.data_publicacao || item.created_date,
      tipo: 'Publicação',
      titulo: item.tipo_registro || item.tipo || 'Registro de Livro',
      descricao: item.conteudo || item.descricao || '',
      origem: 'RegistroLivro'
    })),
    ...(publicacoesExOfficio || []).map(item => ({
      id: item.id,
      data: item.data_publicacao || item.created_date,
      tipo: 'Publicação',
      titulo: item.tipo || 'Publicação Ex Officio',
      descricao: item.conteudo || '',
      origem: 'PublicacaoExOfficio'
    })),
    ...(ferias || []).map(item => ({
      id: item.id,
      data: item.data_inicio,
      tipo: 'Férias',
      titulo: 'Gozo de Férias',
      descricao: `${item.dias || 0} dias ref. ao período ${item.periodo_aquisitivo_ref || 'N/D'}`,
      origem: 'Ferias'
    })),
    ...(atestados || []).map(item => ({
      id: item.id,
      data: item.data_inicio,
      tipo: 'Atestado',
      titulo: item.tipo_afastamento || 'Atestado Médico',
      descricao: `${item.dias || 0} dias${item.cid_10 ? ' - CID: ' + item.cid_10 : ''}`,
      origem: 'Atestado'
    })),
    ...(promocoes || []).map(item => ({
      id: item.id,
      data: item.data_promocao,
      tipo: 'Promoção',
      titulo: `${item.posto_graduacao_novo || ''} ${item.quadro_novo || ''}`.trim() || 'Promoção',
      descricao: `Boletim: ${item.boletim_referencia || 'N/D'}`,
      origem: 'HistoricoPromocaoMilitarV2'
    })),
    ...(medalhas || []).map(item => ({
      id: item.id,
      data: item.data_concessao || item.data_indicacao,
      tipo: 'Medalha',
      titulo: item.tipo_medalha_nome || 'Medalha',
      descricao: `Status: ${item.status || 'N/D'}`,
      origem: 'Medalha'
    }))
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
