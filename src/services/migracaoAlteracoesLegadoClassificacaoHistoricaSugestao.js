function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const REGRAS_SUGESTAO_CLASSIFICACAO_HISTORICA = Object.freeze([
  {
    nome: 'Concessão de Férias',
    termos: ['concede ferias', 'concessao de ferias', 'ferias regulamentares'],
    prioridade: 100,
  },
  { nome: 'Elogio', termos: ['elogio'], prioridade: 90 },
  { nome: 'Punição', termos: ['punicao', 'repreensao', 'detencao', 'prisao'], prioridade: 90 },
  { nome: 'Designação', termos: ['designa', 'designado', 'nomeia'], prioridade: 85 },
  { nome: 'Dispensa', termos: ['dispensa'], prioridade: 80 },
  { nome: 'Curso', termos: ['curso', 'estagio', 'capacitacao'], prioridade: 75 },
  { nome: 'Apresentação', termos: ['apresentacao'], prioridade: 72 },
  { nome: 'Movimentação', termos: ['movimenta', 'transferido', 'classificado'], prioridade: 70 },
]);

function montarTextoBase(linha = {}) {
  const transformado = linha.transformado || {};
  return normalizar([
    linha.classificacao_original_legado,
    transformado.classificacao_original_legado,
    linha.tipo_legado,
    transformado.tipo_legado,
    linha.materia_legado,
    transformado.materia_legado,
    linha.texto_publicacao,
    linha.texto_publicado,
    transformado.texto_publicacao,
    transformado.conteudo_trecho_legado,
  ].filter(Boolean).join(' '));
}

function buscarClassificacaoDisponivel(classificacoesHistoricasAtivas = [], nomeSugerido) {
  const alvo = normalizar(nomeSugerido);
  return (classificacoesHistoricasAtivas || []).find((classificacao) => (
    classificacao?.ativo !== false
    && classificacao?.uso_migracao !== false
    && normalizar(classificacao?.nome) === alvo
  )) || null;
}

export function sugerirClassificacaoHistoricaLegado(linha = {}, classificacoesHistoricasAtivas = []) {
  const classificacaoAtualId = String(linha.classificacao_historica_id || linha.transformado?.classificacao_historica_id || '').trim();
  const classificacaoAtualNome = String(linha.classificacao_historica_nome || linha.transformado?.classificacao_historica_nome || '').trim();
  if (classificacaoAtualId || classificacaoAtualNome) return null;

  const textoBase = montarTextoBase(linha);
  if (!textoBase) return null;

  const regra = REGRAS_SUGESTAO_CLASSIFICACAO_HISTORICA
    .map((item) => {
      const termosEncontrados = item.termos.filter((termo) => textoBase.includes(normalizar(termo)));
      return {
        ...item,
        termosEncontrados,
        score: termosEncontrados.length ? item.prioridade + termosEncontrados.join(' ').length : 0,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (!regra) return null;

  const classificacao = buscarClassificacaoDisponivel(classificacoesHistoricasAtivas, regra.nome);
  if (!classificacao?.id) return null;

  return {
    id: classificacao.id,
    nome: classificacao.nome,
    grupo: classificacao.grupo || '',
    termosEncontrados: regra.termosEncontrados,
  };
}

export { REGRAS_SUGESTAO_CLASSIFICACAO_HISTORICA };
