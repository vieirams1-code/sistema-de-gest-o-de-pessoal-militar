import { calcularStatusPublicacaoLegado } from './migracaoAlteracoesLegadoStatusPublicacao.js';

export const STATUS_REVISAO_SIMPLIFICADA = Object.freeze({
  PRONTA: 'pronta',
  PENDENTE_CONFIRMACAO: 'pendente_confirmacao',
  ERRO: 'erro',
  DUPLICADA: 'duplicada',
  RECUSADA: 'recusada',
});

function limparTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

export function normalizarNumeroNota(valor) {
  return limparTexto(valor).toUpperCase().replace(/\s+/g, '');
}

export function resolverTipoFinalMigracaoLegado(linha = {}) {
  const tipoClassificado = limparTexto(linha.tipo_classificado);
  const classificacaoHistoricaId = limparTexto(linha.classificacao_historica_id || linha.transformado?.classificacao_historica_id);

  if (tipoClassificado && tipoClassificado !== '__fallback__') {
    return { tipoFinal: tipoClassificado, classificacaoPendente: false };
  }

  if (classificacaoHistoricaId) {
    const tipoLegadoParaHistorico = limparTexto(
      linha.materia_legado
        || linha.tipo_legado
        || linha.transformado?.materia_legado
        || linha.transformado?.classificacao_original_legado
        || linha.classificacao_original_legado,
    );
    return { tipoFinal: tipoLegadoParaHistorico, classificacaoPendente: false };
  }

  const tipoLegado = limparTexto(
    linha.materia_legado
      || linha.tipo_legado
      || linha.transformado?.materia_legado,
  );
  return { tipoFinal: tipoLegado, classificacaoPendente: Boolean(tipoLegado) };
}

export function resolverDataPublicacaoMigracaoLegado(linha = {}) {
  return limparTexto(linha.data_bg_br || linha.transformado?.data_bg_br || linha.data_bg);
}

function normalizarStatusPublicacaoParaSchema(status) {
  return status === 'PUBLICADO' ? 'Publicado' : 'Aguardando Publicação';
}

export function montarPayloadPublicacaoExOfficioMigracaoLegado(linha = {}) {
  const notaNormalizada = normalizarNumeroNota(linha.numero_nota);
  const textoPublicacao = limparTexto(linha.texto_publicado);
  const dataPublicacao = resolverDataPublicacaoMigracaoLegado(linha);
  const { tipoFinal, classificacaoPendente } = resolverTipoFinalMigracaoLegado(linha);

  if (!notaNormalizada) throw new Error('Número da nota é obrigatório.');
  if (!textoPublicacao) throw new Error('Texto publicado é obrigatório.');
  if (!dataPublicacao || !dataBgBrValida(dataPublicacao)) {
    if (!notaNormalizada) {
      throw new Error('Data da publicação ausente. Preencha a data do BG/BR antes de importar.');
    }
  }
  if (!tipoFinal) throw new Error('Tipo/matéria ausente. Classifique manualmente antes de importar.');

  const statusPublicacao = calcularStatusPublicacaoLegado({
    numero_nota: notaNormalizada,
    numero_bg_br: linha.numero_bg_br,
    data_bg_br: dataPublicacao,
  });

  return {
    militar_id: linha.transformado?.militar_id,
    militar_nome: linha.transformado?.militar_nome,
    militar_matricula: linha.transformado?.militar_matricula_atual || linha.transformado?.militar_matricula,
    nota_id_legado: notaNormalizada,
    numero_bg: linha.numero_bg_br,
    data_bg: linha.data_bg_br || undefined,
    data_publicacao: dataPublicacao,
    materia_legado: limparTexto(linha.materia_legado || linha.tipo_legado || linha.transformado?.materia_legado) || undefined,
    classificacao_original_legado: linha.classificacao_original_legado !== undefined
      ? String(linha.classificacao_original_legado)
      : limparTexto(linha.materia_legado || linha.tipo_legado || linha.transformado?.materia_legado || linha.transformado?.classificacao_original_legado),
    classificacao_historica_id: limparTexto(linha.classificacao_historica_id || linha.transformado?.classificacao_historica_id) || undefined,
    classificacao_historica_nome: limparTexto(linha.classificacao_historica_nome || linha.transformado?.classificacao_historica_nome) || undefined,
    tipo_bg_legado: limparTexto(linha.tipo_bg_legado || linha.transformado?.tipo_bg_legado) || undefined,
    tipo_legado: limparTexto(linha.tipo_legado) || undefined,
    tipo: tipoFinal,
    tipo_registro: tipoFinal,
    texto_publicacao: textoPublicacao,
    classificacao_pendente: classificacaoPendente,
    status: normalizarStatusPublicacaoParaSchema(statusPublicacao),
    origem_registro: 'legado',
    importado_legado: true,
  };
}

function dataBgBrValida(valor) {
  const texto = limparTexto(valor);
  if (!texto) return true;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dia, mes, ano] = texto.split('/').map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split('-').map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
  }
  return false;
}

function sincronizarTransformado(linha) {
  const statusPublicacao = calcularStatusPublicacaoLegado({
    numero_nota: linha.numero_nota,
    numero_bg_br: linha.numero_bg_br,
    data_bg_br: resolverDataPublicacaoMigracaoLegado(linha),
  });
  return {
    ...linha.transformado,
    nota_id_legado: linha.numero_nota,
    numero_bg: linha.numero_bg_br,
    data_bg_br: resolverDataPublicacaoMigracaoLegado(linha),
    materia_legado: linha.materia_legado || linha.tipo_legado || linha.transformado?.materia_legado,
    classificacao_original_legado: linha.classificacao_original_legado !== undefined
      ? String(linha.classificacao_original_legado)
      : (linha.transformado?.classificacao_original_legado || linha.materia_legado || linha.tipo_legado || ''),
    classificacao_historica_id: linha.classificacao_historica_id || linha.transformado?.classificacao_historica_id || '',
    classificacao_historica_nome: linha.classificacao_historica_nome || linha.transformado?.classificacao_historica_nome || '',
    tipo_bg_legado: linha.tipo_bg_legado || linha.transformado?.tipo_bg_legado,
    tipo_publicacao_sugerido: resolverTipoFinalMigracaoLegado(linha).tipoFinal,
    tipo_publicacao_confirmado: resolverTipoFinalMigracaoLegado(linha).tipoFinal,
    conteudo_trecho_legado: linha.texto_publicado,
    status_publicacao: statusPublicacao,
    destino_final: linha.recusada ? 'IGNORAR' : 'IMPORTAR',
  };
}

export function gerarResumoRevisaoSimplificada(linhas) {
  return linhas.reduce((resumo, linha) => {
    resumo.total_linhas += 1;
    if (linha.status === STATUS_REVISAO_SIMPLIFICADA.PRONTA) resumo.total_aptas += 1;
    if (linha.status === STATUS_REVISAO_SIMPLIFICADA.PENDENTE_CONFIRMACAO) resumo.total_pendentes_confirmacao += 1;
    if (linha.status === STATUS_REVISAO_SIMPLIFICADA.ERRO) resumo.total_erros += 1;
    if (linha.status === STATUS_REVISAO_SIMPLIFICADA.DUPLICADA) {
      resumo.total_revisar += 1;
      resumo.total_duplicidades += 1;
    }
    if (linha.status === STATUS_REVISAO_SIMPLIFICADA.RECUSADA) resumo.total_ignoradas += 1;
    if (linha.avisos?.length) resumo.total_alertas += 1;
    return resumo;
  }, {
    total_linhas: 0,
    total_aptas: 0,
    total_aptas_com_alerta: 0,
    total_revisar: 0,
    total_ignoradas: 0,
    total_erros: 0,
    total_excluidas_lote: 0,
    total_pendentes_classificacao: 0,
    total_pendentes_confirmacao: 0,
    total_alertas: 0,
    total_duplicidades: 0,
  });
}

export function revalidarLinhasRevisaoSimplificada(linhas) {
  const contagemNotasAtivas = new Map();
  linhas.forEach((linha) => {
    if (linha.recusada) return;
    const numeroNota = normalizarNumeroNota(linha.numero_nota);
    if (numeroNota) contagemNotasAtivas.set(numeroNota, (contagemNotasAtivas.get(numeroNota) || 0) + 1);
  });

  return linhas.map((linha) => {
    if (linha.recusada) {
      return {
        ...linha,
        statusSimplificado: STATUS_REVISAO_SIMPLIFICADA.RECUSADA,
        status: STATUS_REVISAO_SIMPLIFICADA.RECUSADA,
        status_publicacao: calcularStatusPublicacaoLegado(linha),
        erros: [],
        avisos: [],
        transformado: sincronizarTransformado(linha),
      };
    }

    const numeroNota = normalizarNumeroNota(linha.numero_nota);
    const erros = [];
    const avisos = [];
    if (!numeroNota) erros.push('Número da nota é obrigatório.');
    if (!limparTexto(linha.texto_publicado)) erros.push('Texto publicado é obrigatório.');
    if (!limparTexto(linha.numero_bg_br)) {
      avisos.push('Nota informada. A publicação em BG ainda está pendente.');
      avisos.push('Este registro poderá ser importado como aguardando publicação.');
    }
    const dataPublicacao = resolverDataPublicacaoMigracaoLegado(linha);
    if (!dataPublicacao || !dataBgBrValida(dataPublicacao)) {
      if (numeroNota) {
        if (!avisos.includes('Nota informada. A publicação em BG ainda está pendente.')) {
          avisos.push('Nota informada. A publicação em BG ainda está pendente.');
        }
        if (!avisos.includes('Este registro poderá ser importado como aguardando publicação.')) {
          avisos.push('Este registro poderá ser importado como aguardando publicação.');
        }
      } else {
        erros.push('Data da publicação ausente. Preencha a data do BG/BR antes de importar.');
      }
    }
    const { tipoFinal } = resolverTipoFinalMigracaoLegado(linha);
    if (!tipoFinal) erros.push('Tipo/matéria ausente. Classifique manualmente antes de importar.');
    if (!limparTexto(linha.tipo_legado) && !limparTexto(linha.materia_legado) && !limparTexto(linha.transformado?.materia_legado)) avisos.push('Tipo legado ausente.');
    const possuiClassificacaoManual = (limparTexto(linha.tipo_classificado) && linha.tipo_classificado !== '__fallback__')
      || (limparTexto(linha.classificacao_historica_id) || limparTexto(linha.transformado?.classificacao_historica_id));

    if (!possuiClassificacaoManual) {
      if (tipoFinal) avisos.push('Classificação manual ausente; usando tipo legado como fallback.');
    }

    let status = erros.length ? STATUS_REVISAO_SIMPLIFICADA.ERRO : STATUS_REVISAO_SIMPLIFICADA.PRONTA;

    if (status === STATUS_REVISAO_SIMPLIFICADA.PRONTA && !linha.classificacao_confirmada) {
      status = STATUS_REVISAO_SIMPLIFICADA.PENDENTE_CONFIRMACAO;
    }
    if (!erros.length && numeroNota && linha.numerosNotaImportados?.some((nota) => normalizarNumeroNota(nota) === numeroNota)) {
      status = STATUS_REVISAO_SIMPLIFICADA.DUPLICADA;
      erros.push('Nota já importada anteriormente para este militar.');
    } else if (!erros.length && numeroNota && (contagemNotasAtivas.get(numeroNota) || 0) > 1) {
      status = STATUS_REVISAO_SIMPLIFICADA.DUPLICADA;
      erros.push('Número da nota duplicado na própria análise.');
    }

    const statusPublicacao = calcularStatusPublicacaoLegado({
      numero_nota: linha.numero_nota,
      numero_bg_br: linha.numero_bg_br,
      data_bg_br: resolverDataPublicacaoMigracaoLegado(linha),
    });
    const proxima = {
      ...linha,
      status,
      statusSimplificado: status,
      status_publicacao: statusPublicacao,
      erros,
      avisos
    };
    return { ...proxima, transformado: sincronizarTransformado(proxima) };
  });
}

export function atualizarLinhaRevisaoSimplificada(linhas, linhaNumero, alteracoes) {
  return revalidarLinhasRevisaoSimplificada(linhas.map((linha) => {
    if (linha.linhaNumero !== linhaNumero) return linha;
    return { ...linha, ...alteracoes };
  }));
}
