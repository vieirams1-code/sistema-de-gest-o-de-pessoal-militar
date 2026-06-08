/**
 * Unifica documentos do militar a partir de diversas fontes.
 *
 * @param {Object} params
 * @param {Array} params.publicacoes - Lista de publicações ex officio.
 * @param {Array} params.registrosLivro - Lista de registros de livro.
 * @param {Array} params.atestados - Lista de atestados médicos.
 * @param {Array} params.ferias - Lista de períodos de férias.
 * @param {Array} params.promocoes - Lista de históricos de promoções.
 * @param {Array} params.medalhas - Lista de medalhas concedidas.
 * @param {Object} [params.filtros] - Filtros opcionais.
 * @param {string} [params.filtros.tipo] - Filtra por tipo de documento.
 * @param {string|Date} [params.filtros.dataInicio] - Data inicial para o filtro de período.
 * @param {string|Date} [params.filtros.dataFim] - Data final para o filtro de período.
 * @returns {Array} - Lista de documentos unificada, filtrada e ordenada.
 */
export function getDocumentosUnificados(params = {}) {
  const {
    publicacoes = [],
    registrosLivro = [],
    atestados = [],
    ferias = [],
    promocoes = [],
    medalhas = [],
    filtros = {}
  } = params || {};

  const { tipo, dataInicio, dataFim } = filtros || {};

  const documentos = [
    ...(publicacoes || []).map(item => ({
      data: item.data_publicacao || item.created_date,
      tipo: 'Publicação',
      titulo: item.tipo || 'Publicação Ex Officio',
      origem: 'Publicação Ex Officio',
      referencia: [item.doems_edicao_numero ? `DOEMS: ${item.doems_edicao_numero}` : '', item.conteudo || item.texto_publicacao || ''].filter(Boolean).join(' — ')
    })),
    ...(registrosLivro || []).map(item => ({
      data: item.data_publicacao || item.created_date,
      tipo: 'Registro de Livro',
      titulo: item.tipo_registro || item.tipo || 'Registro de Livro',
      origem: 'Registro de Livro',
      referencia: item.conteudo || item.descricao || ''
    })),
    ...(atestados || []).map(item => ({
      data: item.data_inicio,
      tipo: 'Atestado',
      titulo: item.tipo_afastamento || 'Atestado Médico',
      origem: 'Saúde',
      referencia: `${item.dias || 0} dias${item.cid_10 ? ' - CID: ' + item.cid_10 : ''}`
    })),
    ...(ferias || []).map(item => ({
      data: item.data_inicio,
      tipo: 'Férias',
      titulo: 'Gozo de Férias',
      origem: 'Férias',
      referencia: `${item.dias || 0} dias ref. ao período ${item.periodo_aquisitivo_ref || 'N/D'}`
    })),
    ...(promocoes || []).map(item => ({
      data: item.data_promocao,
      tipo: 'Promoção',
      titulo: `${item.posto_graduacao_novo || ''} ${item.quadro_novo || ''}`.trim() || 'Promoção',
      origem: 'Carreira',
      referencia: `Boletim: ${item.boletim_referencia || 'N/D'}`
    })),
    ...(medalhas || []).map(item => ({
      data: item.data_concessao || item.data_indicacao,
      tipo: 'Medalha',
      titulo: item.tipo_medalha_nome || 'Medalha',
      origem: 'Condecoração',
      referencia: `Status: ${item.status || 'N/D'}`
    }))
  ];

  let filtrados = documentos;

  // Filtro por tipo
  if (tipo) {
    filtrados = filtrados.filter(doc => doc.tipo === tipo);
  }

  // Filtro por período
  if (dataInicio || dataFim) {
    const inicio = dataInicio ? new Date(dataInicio) : null;
    const fim = dataFim ? new Date(dataFim) : null;

    filtrados = filtrados.filter(doc => {
      if (!doc.data) return false;
      const dataDoc = new Date(doc.data);
      if (inicio && dataDoc < inicio) return false;
      if (fim && dataDoc > fim) return false;
      return true;
    });
  }

  // Deduplicação (evita itens idênticos de fontes diferentes)
  const seen = new Set();
  const documentosUnicos = filtrados.filter(item => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Ordenação: mais recente primeiro
  return documentosUnicos.sort((a, b) => {
    if (!a.data && !b.data) return 0;
    if (!a.data) return 1;
    if (!b.data) return -1;
    return new Date(b.data) - new Date(a.data);
  });
}
