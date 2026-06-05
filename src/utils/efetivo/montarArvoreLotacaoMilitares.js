const TEXTO_SETOR_FALLBACK = 'CMB';
const TEXTO_SUBSETOR_FALLBACK = '1º GBM';
const TEXTO_UNIDADE_FALLBACK = 'Unidade não informada';

const POSTOS_OFICIAIS = new Set([
  'ASP OFICIAL',
  'ASPIRANTE',
  'ASPIRANTE A OFICIAL',
  '2º TEN',
  '2 TEN',
  '2º TENENTE',
  '2 TENENTE',
  '1º TEN',
  '1 TEN',
  '1º TENENTE',
  '1 TENENTE',
  'CAP',
  'CAPITAO',
  'MAJ',
  'MAJOR',
  'TEN CEL',
  'TENENTE CORONEL',
  'CORONEL',
]);

function normalizarTextoClassificacao(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function obterSexoMilitar(militar) {
  const sexo = normalizarTextoClassificacao(
    militar?.sexo
    || militar?.genero
    || militar?.sexo_biologico
    || militar?.dados_pessoais?.sexo,
  );

  if (['F', 'FEM', 'FEMININO', 'MULHER'].includes(sexo)) return 'F';
  if (['M', 'MASC', 'MASCULINO', 'HOMEM'].includes(sexo)) return 'M';
  return 'NI';
}

export function obterGrupoHierarquicoMilitar(militar) {
  const posto = normalizarTextoClassificacao(
    militar?.posto_graduacao_resolvido
    || militar?.posto_graduacao
    || militar?.postoGraduacao
    || militar?.posto
    || militar?.graduacao
    || militar?.pg,
  );

  // Subtenente é praça, apesar de conter o texto "tenente".
  if (posto.includes('SUBTENENTE') || posto.includes('SUB-TENENTE') || posto === 'ST' || posto === 'SUB TEN') return 'praca';
  if (POSTOS_OFICIAIS.has(posto)) return 'oficial';
  if (posto.includes('TENENTE') || posto.includes('CAPITAO') || posto.includes('MAJOR') || posto.includes('CORONEL') || posto.includes('ASP')) return 'oficial';
  return 'praca';
}

export function calcularResumoEfetivo(militares = []) {
  const resumo = { oficiais: 0, pracas: 0, homens: 0, mulheres: 0, sexoNaoInformado: 0 };

  for (const militar of militares || []) {
    if (obterGrupoHierarquicoMilitar(militar) === 'oficial') resumo.oficiais += 1;
    else resumo.pracas += 1;

    const sexo = obterSexoMilitar(militar);
    if (sexo === 'M') resumo.homens += 1;
    else if (sexo === 'F') resumo.mulheres += 1;
    else resumo.sexoNaoInformado += 1;
  }

  return resumo;
}

function textoValido(valor) {
  if (valor === null || valor === undefined || typeof valor === 'object') return '';
  const texto = String(valor).trim();
  if (!texto) return '';
  if (['nao informado', 'setor nao informado', 'subsetor nao informado', 'unidade nao informada'].includes(normalizarChaveBusca(texto))) return '';
  return texto;
}

function primeiroTextoValido(...valores) {
  for (const valor of valores) {
    const texto = textoValido(valor);
    if (texto) return texto;
  }
  return '';
}

export function normalizarChaveBusca(valor) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
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
    militar?.lotacao_nome,
    TEXTO_UNIDADE_FALLBACK,
  );
}

function obterSiglaUnidade(militar, lotacao) {
  return primeiroTextoValido(lotacao?.sigla, lotacao?.estrutura_sigla, militar?.estrutura_sigla, militar?.lotacao_sigla);
}

function obterDescricaoUnidade(militar, lotacao) {
  return primeiroTextoValido(lotacao?.descricao, lotacao?.descricao_curta, lotacao?.caminho, militar?.lotacao_descricao);
}

function coletarChavesLotacao(lotacao) {
  return [
    lotacao?.id,
    lotacao?.estrutura_id,
    lotacao?.lotacao_id,
    lotacao?.unidade_id,
    lotacao?.subgrupamento_id,
    lotacao?.grupamento_id,
    lotacao?.nome,
    lotacao?.estrutura_nome,
    lotacao?.lotacao,
    lotacao?.unidade_nome,
    lotacao?.sigla,
    lotacao?.codigo,
  ].map(normalizarChaveBusca).filter(Boolean);
}

function criarIndiceLotacoes(lotacoes = []) {
  const mapa = new Map();

  for (const lotacao of lotacoes || []) {
    for (const chave of coletarChavesLotacao(lotacao)) {
      if (!mapa.has(chave)) mapa.set(chave, lotacao);
    }
  }

  return mapa;
}

function encontrarLotacaoDoMilitar(militar, indiceLotacoes) {
  if (!militar) return null;

  const lotacaoObjeto = militar.lotacao_obj
    || militar.lotacaoObjeto
    || militar.lotacao_atual
    || militar.lotacaoAtual
    || militar.estrutura
    || militar.unidade
    || (typeof militar.lotacao === 'object' ? militar.lotacao : null);

  if (lotacaoObjeto && typeof lotacaoObjeto === 'object') return lotacaoObjeto;

  const candidatos = [
    militar?.estrutura_id,
    militar?.lotacao_id,
    militar?.unidade_id,
    militar?.subgrupamento_id,
    militar?.grupamento_id,
    militar?.estrutura_nome,
    militar?.lotacao,
    militar?.unidade_nome,
    militar?.subgrupamento_nome,
    militar?.grupamento_nome,
    militar?.estrutura_sigla,
    militar?.lotacao_sigla,
  ];

  for (const candidato of candidatos) {
    const chave = normalizarChaveBusca(candidato);
    if (chave && indiceLotacoes.has(chave)) return indiceLotacoes.get(chave);
  }

  return null;
}

export function normalizarTagsMilitar(militar) {
  const fontes = [
    militar?.tags_resolvidas,
    militar?.tags,
    militar?.marcadores,
    militar?.tags_operacionais,
    militar?.tagsOperacionais,
    militar?.tags_militar,
    militar?.tagsMilitar,
    militar?.tag_ids,
    militar?.tagIds,
    militar?.funcoes,
    militar?.funcoes_institucionais,
    militar?.funcoesInstitucionais,
    militar?.marcadores_operacionais,
    militar?.marcadoresOperacionais,
    militar?.metadata?.tags,
    militar?.extras?.tags,
  ];
  const tags = [];

  for (const fonte of fontes) {
    if (!fonte) continue;

    if (Array.isArray(fonte)) {
      for (const item of fonte) {
        if (!item) continue;

        if (typeof item === 'string') {
          const nome = item.trim();
          if (nome) tags.push({ id: normalizarChaveBusca(nome), nome });
          continue;
        }

        if (typeof item === 'object') {
          const nome = primeiroTextoValido(item.nome, item.label, item.titulo, item.name, item.tag, item.codigo, item.sigla, item.descricao);
          if (nome) {
            tags.push({
              id: item.id || item.tag_id || item.codigo || normalizarChaveBusca(nome),
              nome,
              cor: item.cor || item.color || item.backgroundColor,
            });
          }
        }
      }
    }

    if (typeof fonte === 'string') {
      fonte.split(/[;,|]/).map((item) => item.trim()).filter(Boolean).forEach((nome) => tags.push({ id: normalizarChaveBusca(nome), nome }));
    }

    if (typeof fonte === 'object' && !Array.isArray(fonte)) {
      for (const [chave, valor] of Object.entries(fonte)) {
        if (valor === true || valor === 'true' || valor === 1) tags.push({ id: normalizarChaveBusca(chave), nome: chave });
      }
    }
  }

  const deduplicadas = new Map();
  for (const tag of tags) {
    const chave = normalizarChaveBusca(tag.id || tag.nome);
    if (chave && !deduplicadas.has(chave)) deduplicadas.set(chave, tag);
  }
  return Array.from(deduplicadas.values());
}

function criarResumoVazio() {
  return { oficiais: 0, pracas: 0, homens: 0, mulheres: 0, sexoNaoInformado: 0 };
}

function somarResumoEfetivo(destino, origem) {
  const resumo = destino || criarResumoVazio();
  const item = origem || criarResumoVazio();
  resumo.oficiais += item.oficiais || 0;
  resumo.pracas += item.pracas || 0;
  resumo.homens += item.homens || 0;
  resumo.mulheres += item.mulheres || 0;
  resumo.sexoNaoInformado += item.sexoNaoInformado || 0;
  return resumo;
}

export function calcularResumoTags(militares = []) {
  const mapa = new Map();
  for (const militar of militares || []) {
    for (const tag of normalizarTagsMilitar(militar)) {
      const chave = normalizarChaveBusca(tag.nome || tag);
      if (!chave) continue;
      const existente = mapa.get(chave) || { id: chave, nome: tag.nome || String(tag), total: 0 };
      existente.total += 1;
      mapa.set(chave, existente);
    }
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function unicoNomeInformado(registros, campo) {
  const nomes = new Map();
  for (const registro of registros) {
    const nome = registro[campo];
    const chave = normalizarChaveBusca(nome);
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
  if (!Array.isArray(militares) && militares && typeof militares === 'object') {
    lotacoes = militares.lotacoes || [];
    militares = militares.militares || [];
  }

  const indiceLotacoes = criarIndiceLotacoes(lotacoes);
  const registros = (militares || []).map((militar) => {
    const lotacao = encontrarLotacaoDoMilitar(militar, indiceLotacoes);
    return {
      militar: {
        ...militar,
        nome_guerra_resolvido: obterNomeGuerra(militar),
        posto_graduacao_resolvido: obterPostoGraduacao(militar),
        tags_resolvidas: normalizarTagsMilitar(militar),
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
    const setorKey = normalizarChaveBusca(registro.setorNome);
    if (!registrosPorSetor.has(setorKey)) registrosPorSetor.set(setorKey, []);
    registrosPorSetor.get(setorKey).push(registro);
  }
  for (const registrosSetor of registrosPorSetor.values()) {
    const subsetorConsolidado = unicoNomeInformado(registrosSetor, 'subsetorNome');
    for (const registro of registrosSetor) registro.subsetorNome ||= subsetorConsolidado || TEXTO_SUBSETOR_FALLBACK;
  }

  const setoresMap = new Map();
  for (const registro of registros) {
    const setorKey = normalizarChaveBusca(registro.setorNome);
    const subsetorKey = `${setorKey}::${normalizarChaveBusca(registro.subsetorNome)}`;
    const unidadeKey = `${subsetorKey}::${normalizarChaveBusca(registro.unidadeNome)}`;
    if (!setoresMap.has(setorKey)) setoresMap.set(setorKey, { setorNome: registro.setorNome, setorSigla: registro.setorSigla, subsetoresMap: new Map() });
    const setor = setoresMap.get(setorKey);
    if (!setor.subsetoresMap.has(subsetorKey)) setor.subsetoresMap.set(subsetorKey, { subsetorNome: registro.subsetorNome, subsetorSigla: registro.subsetorSigla, unidadesMap: new Map() });
    const subsetor = setor.subsetoresMap.get(subsetorKey);
    if (!subsetor.unidadesMap.has(unidadeKey)) subsetor.unidadesMap.set(unidadeKey, { unidadeNome: registro.unidadeNome, unidadeSigla: registro.unidadeSigla, unidadeDescricao: registro.unidadeDescricao, militares: [] });
    subsetor.unidadesMap.get(unidadeKey).militares.push(registro.militar);
  }

  const resultado = Array.from(setoresMap.values()).map((setor) => {
    const subsetores = Array.from(setor.subsetoresMap.values()).map((subsetor) => {
      const unidades = Array.from(subsetor.unidadesMap.values()).map((unidade) => {
        const militaresDaUnidade = unidade.militares || [];
        return {
          ...unidade,
          total: militaresDaUnidade.length,
          resumoEfetivo: calcularResumoEfetivo(militaresDaUnidade),
          resumoTags: calcularResumoTags(militaresDaUnidade),
          militares: militaresDaUnidade,
          oficiais: militaresDaUnidade.filter((militar) => obterGrupoHierarquicoMilitar(militar) === 'oficial'),
          pracas: militaresDaUnidade.filter((militar) => obterGrupoHierarquicoMilitar(militar) !== 'oficial'),
        };
      }).sort((a, b) => a.unidadeNome.localeCompare(b.unidadeNome, 'pt-BR'));
      const resumoEfetivo = criarResumoVazio();
      const todosMilitares = [];
      for (const unidade of unidades) {
        somarResumoEfetivo(resumoEfetivo, unidade.resumoEfetivo);
        todosMilitares.push(...unidade.militares);
      }
      return { subsetorNome: subsetor.subsetorNome, subsetorSigla: subsetor.subsetorSigla, total: todosMilitares.length, resumoEfetivo, resumoTags: calcularResumoTags(todosMilitares), unidades };
    }).sort((a, b) => a.subsetorNome.localeCompare(b.subsetorNome, 'pt-BR'));
    const resumoEfetivo = criarResumoVazio();
    const todosMilitares = [];
    for (const subsetor of subsetores) {
      somarResumoEfetivo(resumoEfetivo, subsetor.resumoEfetivo);
      for (const unidade of subsetor.unidades) todosMilitares.push(...unidade.militares);
    }
    return { setorNome: setor.setorNome, setorSigla: setor.setorSigla, total: todosMilitares.length, resumoEfetivo, resumoTags: calcularResumoTags(todosMilitares), subsetores };
  }).sort((a, b) => a.setorNome.localeCompare(b.setorNome, 'pt-BR'));

  const totalArvore = resultado.reduce((totalSetores, setor) => totalSetores + setor.subsetores.reduce((totalSubsetores, subsetor) => totalSubsetores + subsetor.unidades.reduce((totalUnidades, unidade) => totalUnidades + (unidade.militares?.length || 0), 0), 0), 0);
  if (import.meta.env?.MODE !== 'production' && totalArvore !== militares.length) console.warn(`Total da árvore (${totalArvore}) difere do total de militares carregados (${militares.length}).`);
  return resultado;
}