const CONFIANCA_NUMERICA = {
  ALTA: 92,
  MEDIA: 74,
  BAIXA: 58,
};

const HEURISTICAS = [
  { tipo: 'Concessão de Férias', termos: ['ferias', 'gozo', 'abono', 'usufruto'] },
  { tipo: 'Averbação de Tempo de Serviço', termos: ['averbacao', 'tempo de servico', 'tempo de contribuição', 'tempo de contribuicao'] },
  { tipo: 'Licença Especial', termos: ['licenca especial', 'licença especial'] },
  { tipo: 'Homologação de Atestado', termos: ['atestado', 'homologacao de atestado', 'homologação de atestado'] },
  { tipo: 'Ata JISO', termos: ['jiso', 'inspecao de saude', 'inspeção de saúde'] },
  { tipo: 'Melhoria de Comportamento', termos: ['melhoria de comportamento', 'comportamento'] },
  { tipo: 'Elogio Individual', termos: ['elogio'] },
  { tipo: 'Designação de Função', termos: ['designacao de funcao', 'designação de função', 'nomeacao', 'nomeação'] },
  { tipo: 'Luto', termos: ['luto', 'falecimento'] },
  { tipo: 'Cursos / Estágios / Capacitações', termos: ['curso', 'estagio', 'capacitação', 'capacitação', 'certificado'] },
];

function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function calcularPontuacao(tipo, texto) {
  const regra = HEURISTICAS.find((item) => item.tipo === tipo);
  if (!regra) return 0;

  return regra.termos.reduce((total, termo) => {
    if (!texto.includes(normalizar(termo))) return total;
    return total + Math.max(8, Math.min(18, termo.length));
  }, 0);
}

function confidenceFromRaw(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const base = Math.round(valor);
    return Math.max(35, Math.min(99, base));
  }

  if (!valor) return null;
  const texto = String(valor).trim();
  const percentual = texto.match(/(\d{1,3})\s*%/);
  if (percentual) {
    return Math.max(35, Math.min(99, Number(percentual[1])));
  }

  const numerico = Number(texto);
  if (Number.isFinite(numerico) && numerico > 0) {
    return numerico <= 1
      ? Math.max(35, Math.min(99, Math.round(numerico * 100)))
      : Math.max(35, Math.min(99, Math.round(numerico)));
  }

  return CONFIANCA_NUMERICA[texto.toUpperCase()] || null;
}

function ordenarSugestoes(sugestoes = []) {
  return sugestoes
    .filter((item) => item?.tipo && Number.isFinite(item?.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item, index) => ({
      tipo: item.tipo,
      confianca: Math.max(35, Math.min(99, Math.round(item.score - index))),
    }));
}

export function construirSugestaoSistema(linha, tiposPublicacaoValidos = []) {
  const transformado = linha?.transformado || {};
  const tipoSugerido = transformado.tipo_publicacao_sugerido || transformado.tipo_publicacao_confirmado || '';

  const confiancaExistente = confidenceFromRaw(transformado.confianca_classificacao);
  const textoBase = normalizar([
    transformado.materia_legado,
    transformado.conteudo_trecho_legado,
    transformado.tipo_publicacao_confirmado,
  ].join(' '));

  const candidatos = Array.from(new Set([
    ...tiposPublicacaoValidos,
    ...HEURISTICAS.map((item) => item.tipo),
    tipoSugerido,
  ].filter(Boolean)));

  const sugestoesOrdenadas = ordenarSugestoes(candidatos.map((tipo) => {
    const scoreBase = calcularPontuacao(tipo, textoBase);
    const bonusPrincipal = tipo === tipoSugerido ? 24 : 0;
    const bonusConfirmado = tipo && tipo === transformado.tipo_publicacao_confirmado ? 16 : 0;
    const score = scoreBase + bonusPrincipal + bonusConfirmado;

    return { tipo, score };
  }));

  if (sugestoesOrdenadas.length === 0 && tipoSugerido) {
    return {
      principal: {
        tipo: tipoSugerido,
        confianca: confiancaExistente || 72,
      },
      secundarias: [],
    };
  }

  const principal = sugestoesOrdenadas[0] || {
    tipo: tipoSugerido || 'Sem sugestão',
    confianca: confiancaExistente || 55,
  };

  if (confiancaExistente) {
    principal.confianca = Math.max(principal.confianca, confiancaExistente);
  }

  return {
    principal,
    secundarias: sugestoesOrdenadas.slice(1, 3),
  };
}
