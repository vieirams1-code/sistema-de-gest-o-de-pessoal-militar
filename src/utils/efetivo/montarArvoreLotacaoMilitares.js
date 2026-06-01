const TEXTO_SETOR_FALLBACK = 'CMB';
const TEXTO_SUBSETOR_FALLBACK = '1º GBM';
const TEXTO_UNIDADE_FALLBACK = 'Unidade não informada';

function textoValido(valor) {
  if (valor === null || valor === undefined || typeof valor === 'object') return '';
  const texto = String(valor).trim();
  if (!texto) return '';
  if (/^não informado$/i.test(texto)) return '';
  if (/^setor não informado$/i.test(texto)) return '';
  if (/^subsetor não informado$/i.test(texto)) return '';
  if (/^unidade não informada$/i.test(texto)) return '';
  return texto;
}

function primeiroTextoValido(...valores) {
  for (const valor of valores) {
    const texto = textoValido(valor);
    if (texto) return texto;
  }
  return '';
}

function normalizarChave(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function obterNomeGuerra(militar) {
  return primeiroTextoValido(militar?.nome_guerra, militar?.nomeGuerra, militar?.nome, militar?.nome_completo);
}

function obterPostoGraduacao(militar) {
  return primeiroTextoValido(militar?.posto_graduacao, militar?.postoGraduacao, militar?.posto, militar?.graduacao, militar?.pg);
}

function obterSetor(militar, lotacao) {
  return primeiroTextoValido(
    lotacao?.setor_nome,
    lotacao?.setor,
    lotacao?.grupamento_nome,
    lotacao?.grupamento,
    lotacao?.estrutura_pai_nome,
    lotacao?.parent?.parent?.nome,
    militar?.setor_nome,
    militar?.setor,
    militar?.grupamento_nome,
    militar?.grupamento,
  );
}

function obterSubsetor(militar, lotacao) {
  return primeiroTextoValido(
    lotacao?.subsetor_nome,
    lotacao?.subsetor,
    lotacao?.subgrupamento_nome,
    lotacao?.subgrupamento,
    lotacao?.estrutura_intermediaria_nome,
    lotacao?.parent?.nome,
    militar?.subsetor_nome,
    militar?.subsetor,
    militar?.subgrupamento_nome,
    militar?.subgrupamento,
  );
}

function obterUnidade(militar, lotacao) {
  return primeiroTextoValido(
    lotacao?.lotacao,
    lotacao?.estrutura_nome,
    lotacao?.unidade_nome,
    lotacao?.nome,
    militar?.lotacao?.nome,
    militar?.lotacao,
    militar?.estrutura_nome,
    militar?.unidade_nome,
    TEXTO_UNIDADE_FALLBACK,
  );
}

function obterSiglaUnidade(militar, lotacao) {
  return primeiroTextoValido(lotacao?.sigla, lotacao?.estrutura_sigla, militar?.estrutura_sigla, militar?.lotacao_sigla);
}

function obterDescricaoUnidade(militar, lotacao) {
  return primeiroTextoValido(lotacao?.descricao, lotacao?.descricao_curta, lotacao?.caminho, militar?.lotacao_descricao);
}

function criarIndiceLotacoes(lotacoes = []) {
  const mapa = new Map();

  for (const lotacao of lotacoes || []) {
    const ids = [lotacao?.id, lotacao?.estrutura_id, lotacao?.lotacao_id, lotacao?.nome, lotacao?.estrutura_nome, lotacao?.sigla];

    for (const id of ids) {
      const chave = normalizarChave(id);
      if (chave && !mapa.has(chave)) mapa.set(chave, lotacao);
    }
  }

  return mapa;
}

function encontrarLotacaoDoMilitar(militar, indiceLotacoes) {
  const candidatos = [militar?.estrutura_id, militar?.lotacao_id, militar?.lotacao?.id, militar?.lotacao, militar?.estrutura_nome, militar?.unidade_nome];

  for (const candidato of candidatos) {
    const chave = normalizarChave(typeof candidato === 'object' ? candidato?.nome : candidato);
    if (chave && indiceLotacoes.has(chave)) return indiceLotacoes.get(chave);
  }

  return militar?.lotacao && typeof militar.lotacao === 'object' ? militar.lotacao : null;
}

function unicoNomeInformado(registros, campo) {
  const nomes = new Map();
  for (const registro of registros) {
    const nome = registro[campo];
    const chave = normalizarChave(nome);
    if (chave) nomes.set(chave, nome);
  }
  return nomes.size === 1 ? nomes.values().next().value : '';
}

export function resolverNomesEstrutura(militar = {}, lotacoesById = new Map()) {
  const lotacao = encontrarLotacaoDoMilitar(militar, lotacoesById);
  return {
    setorNome: obterSetor(militar, lotacao) || TEXTO_SETOR_FALLBACK,
    setorSigla: primeiroTextoValido(lotacao?.setor_sigla, lotacao?.grupamento_sigla, lotacao?.parent?.parent?.sigla),
    subsetorNome: obterSubsetor(militar, lotacao) || TEXTO_SUBSETOR_FALLBACK,
    subsetorSigla: primeiroTextoValido(lotacao?.subsetor_sigla, lotacao?.subgrupamento_sigla, lotacao?.parent?.sigla),
    unidadeNome: obterUnidade(militar, lotacao),
    unidadeSigla: obterSiglaUnidade(militar, lotacao),
    unidadeDescricao: obterDescricaoUnidade(militar, lotacao),
  };
}

export default function montarArvoreLotacaoMilitares(militares = [], lotacoes = []) {
  const indiceLotacoes = criarIndiceLotacoes(lotacoes);
  const registros = (militares || []).map((militar) => {
    const lotacao = encontrarLotacaoDoMilitar(militar, indiceLotacoes);
    return {
      militar: {
        ...militar,
        nome_guerra_resolvido: obterNomeGuerra(militar),
        posto_graduacao_resolvido: obterPostoGraduacao(militar),
      },
      setorNome: obterSetor(militar, lotacao),
      setorSigla: primeiroTextoValido(lotacao?.setor_sigla, lotacao?.grupamento_sigla, lotacao?.parent?.parent?.sigla),
      subsetorNome: obterSubsetor(militar, lotacao),
      subsetorSigla: primeiroTextoValido(lotacao?.subsetor_sigla, lotacao?.subgrupamento_sigla, lotacao?.parent?.sigla),
      unidadeNome: obterUnidade(militar, lotacao),
      unidadeSigla: obterSiglaUnidade(militar, lotacao),
      unidadeDescricao: obterDescricaoUnidade(militar, lotacao),
    };
  });

  const setorConsolidado = unicoNomeInformado(registros, 'setorNome');
  for (const registro of registros) registro.setorNome ||= setorConsolidado || TEXTO_SETOR_FALLBACK;

  const registrosPorSetor = new Map();
  for (const registro of registros) {
    const setorKey = normalizarChave(registro.setorNome);
    if (!registrosPorSetor.has(setorKey)) registrosPorSetor.set(setorKey, []);
    registrosPorSetor.get(setorKey).push(registro);
  }
  for (const registrosSetor of registrosPorSetor.values()) {
    const subsetorConsolidado = unicoNomeInformado(registrosSetor, 'subsetorNome');
    for (const registro of registrosSetor) registro.subsetorNome ||= subsetorConsolidado || TEXTO_SUBSETOR_FALLBACK;
  }

  const setoresMap = new Map();
  for (const registro of registros) {
    const setorKey = normalizarChave(registro.setorNome);
    const subsetorKey = `${setorKey}::${normalizarChave(registro.subsetorNome)}`;
    const unidadeKey = `${subsetorKey}::${normalizarChave(registro.unidadeNome)}`;

    if (!setoresMap.has(setorKey)) setoresMap.set(setorKey, { setorNome: registro.setorNome, setorSigla: registro.setorSigla, subsetoresMap: new Map() });
    const setor = setoresMap.get(setorKey);

    if (!setor.subsetoresMap.has(subsetorKey)) setor.subsetoresMap.set(subsetorKey, { subsetorNome: registro.subsetorNome, subsetorSigla: registro.subsetorSigla, unidadesMap: new Map() });
    const subsetor = setor.subsetoresMap.get(subsetorKey);

    if (!subsetor.unidadesMap.has(unidadeKey)) subsetor.unidadesMap.set(unidadeKey, { unidadeNome: registro.unidadeNome, unidadeSigla: registro.unidadeSigla, unidadeDescricao: registro.unidadeDescricao, militares: [] });
    subsetor.unidadesMap.get(unidadeKey).militares.push(registro.militar);
  }

  return Array.from(setoresMap.values())
    .map((setor) => ({
      setorNome: setor.setorNome,
      setorSigla: setor.setorSigla,
      subsetores: Array.from(setor.subsetoresMap.values())
        .map((subsetor) => ({
          subsetorNome: subsetor.subsetorNome,
          subsetorSigla: subsetor.subsetorSigla,
          unidades: Array.from(subsetor.unidadesMap.values()).sort((a, b) => a.unidadeNome.localeCompare(b.unidadeNome, 'pt-BR')),
        }))
        .sort((a, b) => a.subsetorNome.localeCompare(b.subsetorNome, 'pt-BR')),
    }))
    .sort((a, b) => a.setorNome.localeCompare(b.setorNome, 'pt-BR'));
}
