export const STATUS_REVISAO_SIMPLIFICADA = Object.freeze({
  PRONTA: 'pronta',
  ERRO: 'erro',
  DUPLICADA: 'duplicada',
  RECUSADA: 'recusada',
});

function limparTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

function normalizarNumeroNota(valor) {
  return limparTexto(valor).toUpperCase().replace(/\s+/g, '');
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
  return {
    ...linha.transformado,
    nota_id_legado: linha.numero_nota,
    numero_bg: linha.numero_bg_br,
    data_bg_br: linha.data_bg_br,
    materia_legado: linha.tipo_legado,
    tipo_publicacao_sugerido: linha.tipo_classificado || linha.tipo_legado,
    tipo_publicacao_confirmado: linha.tipo_classificado || linha.tipo_legado,
    conteudo_trecho_legado: linha.texto_publicado,
    destino_final: linha.recusada ? 'IGNORAR' : 'IMPORTAR',
  };
}

export function gerarResumoRevisaoSimplificada(linhas) {
  return linhas.reduce((resumo, linha) => {
    resumo.total_linhas += 1;
    if (linha.status === STATUS_REVISAO_SIMPLIFICADA.PRONTA) resumo.total_aptas += 1;
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
        status: STATUS_REVISAO_SIMPLIFICADA.RECUSADA,
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
    if (!limparTexto(linha.numero_bg_br)) avisos.push('Número do BG/BR ausente.');
    if (!limparTexto(linha.data_bg_br)) avisos.push('Data do BG/BR ausente.');
    else if (!dataBgBrValida(linha.data_bg_br)) avisos.push('Data do BG/BR inválida; valor preservado, mas precisa ser revisado.');
    if (!limparTexto(linha.tipo_legado)) avisos.push('Tipo legado ausente.');
    if (!limparTexto(linha.tipo_classificado)) avisos.push('Tipo classificado ausente; usando tipo legado como fallback.');

    let status = erros.length ? STATUS_REVISAO_SIMPLIFICADA.ERRO : STATUS_REVISAO_SIMPLIFICADA.PRONTA;
    if (!erros.length && numeroNota && linha.numerosNotaImportados?.includes(numeroNota)) {
      status = STATUS_REVISAO_SIMPLIFICADA.DUPLICADA;
      erros.push('Nota já importada anteriormente para este militar.');
    } else if (!erros.length && numeroNota && (contagemNotasAtivas.get(numeroNota) || 0) > 1) {
      status = STATUS_REVISAO_SIMPLIFICADA.DUPLICADA;
      erros.push('Número da nota duplicado na própria análise.');
    }

    const proxima = { ...linha, status, erros, avisos };
    return { ...proxima, transformado: sincronizarTransformado(proxima) };
  });
}

export function atualizarLinhaRevisaoSimplificada(linhas, linhaNumero, alteracoes) {
  return revalidarLinhasRevisaoSimplificada(linhas.map((linha) => {
    if (linha.linhaNumero !== linhaNumero) return linha;
    return { ...linha, ...alteracoes };
  }));
}
