const STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos',
  'o', 'os', 'para', 'por', 'que', 'se', 'sem', 'um', 'uma', 'uns', 'umas'
]);

export function normalizarTexto(texto = '') {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizar(texto = '') {
  return normalizarTexto(texto)
    .split(' ')
    .filter(Boolean)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function coletarContextoBusca(item = {}) {
  const palavrasChave = Array.isArray(item.palavras_chave) ? item.palavras_chave : [];
  const blocos = [item.topico, item.pergunta_exemplo, ...palavrasChave];
  return normalizarTexto(blocos.filter(Boolean).join(' '));
}

function calcularScoreCorrespondencia(tokensPergunta = [], item = {}) {
  if (!tokensPergunta.length) return 0;

  const textoBusca = coletarContextoBusca(item);
  let score = 0;

  tokensPergunta.forEach((token) => {
    if (textoBusca.includes(token)) score += 1;
  });

  return score;
}

export function buscarResposta(pergunta, tipoProcedimento, baseConhecimento = []) {
  const perguntaNormalizada = normalizarTexto(pergunta);
  const tokensPergunta = tokenizar(perguntaNormalizada);
  const tipoNormalizado = normalizarTexto(tipoProcedimento);

  const candidatos = baseConhecimento.filter((item) => {
    const tipoItem = normalizarTexto(item.tipo_procedimento);
    return !tipoNormalizado || tipoItem === tipoNormalizado;
  });

  let melhorCorrespondencia = null;

  candidatos.forEach((item) => {
    const score = calcularScoreCorrespondencia(tokensPergunta, item);
    if (!melhorCorrespondencia || score > melhorCorrespondencia.score) {
      melhorCorrespondencia = { item, score };
    }
  });

  if (!melhorCorrespondencia || melhorCorrespondencia.score <= 0) {
    return {
      perguntaNormalizada,
      score: 0,
      item: null,
      mensagem: 'Não localizamos correspondência exata na base estruturada para esta pergunta.'
    };
  }

  return {
    perguntaNormalizada,
    score: melhorCorrespondencia.score,
    item: melhorCorrespondencia.item,
    mensagem: ''
  };
}

export function aplicarContexto(resposta, procedimento = {}) {
  if (!resposta?.item) return resposta;

  const item = resposta.item;
  const permiteContexto = Boolean(item.permite_contexto);
  if (!permiteContexto) return resposta;

  const prazo = procedimento?.prazo || procedimento?.data_termino || '';
  const prorrogacoes = procedimento?.prorrogacoes || procedimento?.qtd_prorrogacoes || '';
  const status = procedimento?.status || procedimento?.status_publicacao || '';

  const contextoPartes = [
    prazo ? `Prazo atual: ${prazo}.` : null,
    prorrogacoes ? `Prorrogações: ${prorrogacoes}.` : null,
    status ? `Status do procedimento: ${status}.` : null,
  ].filter(Boolean);

  return {
    ...resposta,
    contextoAplicado: contextoPartes.join(' '),
    sugestaoPratica: contextoPartes.length
      ? 'Valide os dados do procedimento antes de efetivar a publicação no BG.'
      : 'Confirme os dados mínimos (prazo, status e eventual prorrogação) antes da tramitação.'
  };
}
