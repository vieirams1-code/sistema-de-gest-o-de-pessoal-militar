import { base44 } from '@/api/base44Client';

export const STATUS_LINHA = {
  APTO: 'APTO',
  APTO_COM_ALERTA: 'APTO_COM_ALERTA',
  REVISAR: 'REVISAR',
  IGNORADO: 'IGNORADO',
  ERRO: 'ERRO',
};

const STATUS_IMPORTACAO = {
  ANALISADO: 'Analisado',
  IMPORTANDO: 'Importando',
  IMPORTADO: 'Importado',
  IMPORTADO_PARCIAL: 'Importado Parcial',
  FALHOU: 'Falhou',
};

const REGRA_VERSAO = 'v1.0.0';
const TIPOS_ACEITOS = new Set(['Afastamento Total', 'Esforço Físico']);

const HEADER_ALIAS = {
  militar: ['militar', 'posto e nome de guerra', 'posto_nome_guerra'],
  tipo: ['tipo', 'tipo de atestado', 'tipo afastamento'],
  medico: ['medico', 'médico'],
  cid: ['cid'],
  data_inicio: ['data inicio', 'data início'],
  data_termino: ['data termino', 'data término'],
  dias: ['dias'],
  retorno: ['retorno'],
  status_legado: ['status'],
  nota_para_bg: ['nota para bg', 'nota bg'],
  texto_publicacao: ['texto para publicacao', 'texto para publicação'],
  numero_bg: ['bg', 'numero bg', 'número bg'],
  data_bg: ['data bg', 'data do bg'],
  arquivo: ['arquivo'],
};

const LIMIAR_DIAS_JISO = 15;

function limparTexto(valor) {
  return String(valor ?? '').trim();
}

function normalizarChave(valor) {
  return limparTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseCsv(texto) {
  const linhas = [];
  let atual = '';
  let linha = [];
  let emAspas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const char = texto[i];
    const prox = texto[i + 1];

    if (char === '"') {
      if (emAspas && prox === '"') {
        atual += '"';
        i += 1;
      } else {
        emAspas = !emAspas;
      }
      continue;
    }

    if (!emAspas && (char === ';' || char === ',' || char === '\t')) {
      linha.push(atual);
      atual = '';
      continue;
    }

    if (!emAspas && (char === '\n' || char === '\r')) {
      if (char === '\r' && prox === '\n') i += 1;
      linha.push(atual);
      if (linha.some((cell) => limparTexto(cell))) linhas.push(linha);
      linha = [];
      atual = '';
      continue;
    }

    atual += char;
  }

  if (atual.length > 0 || linha.length > 0) {
    linha.push(atual);
    if (linha.some((cell) => limparTexto(cell))) linhas.push(linha);
  }

  return linhas;
}

function mapHeaders(cabecalho = []) {
  const normalizados = cabecalho.map((h) => normalizarChave(h));
  return Object.entries(HEADER_ALIAS).reduce((acc, [campo, aliases]) => {
    const idx = aliases
      .map((alias) => normalizarChave(alias))
      .map((aliasNorm) => normalizados.indexOf(aliasNorm))
      .find((index) => index >= 0);
    if (idx >= 0) acc[campo] = idx;
    return acc;
  }, {});
}

function valorLinha(cells, map, campo) {
  const idx = map[campo];
  if (idx === undefined) return '';
  return limparTexto(cells[idx]);
}

function parseDataBrOuIso(valor) {
  const texto = limparTexto(valor);
  if (!texto) return '';

  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dateObj = new Date(texto);
  if (Number.isNaN(dateObj.getTime())) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDataBr(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = String(iso).split('-');
  if (!ano || !mes || !dia) return '';
  return `${dia}/${mes}/${ano}`;
}

function diffDiasInclusivo(inicio, termino) {
  if (!inicio || !termino) return null;
  const a = new Date(`${inicio}T00:00:00`);
  const b = new Date(`${termino}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
}

function adicionarDias(iso, dias) {
  if (!iso || !dias) return '';
  const data = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(data.getTime())) return '';
  data.setDate(data.getDate() + Number(dias));
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function splitMedico(valor, alertas) {
  const texto = limparTexto(valor);
  if (!texto) return { medico: '', crm: '' };
  const match = texto.match(/^(.+?)\s*-\s*(CRM[^\s]*)$/i);
  if (match) return { medico: limparTexto(match[1]), crm: limparTexto(match[2]) };
  alertas.push('CRM não pôde ser separado automaticamente do nome do médico. Campo CRM deixado em branco para revisão.');
  return { medico: texto, crm: '' };
}

function splitCid(valor, alertas) {
  const texto = limparTexto(valor);
  if (!texto) return { cid_10: '', cid_descricao: '' };

  const comHifen = texto.match(/^([A-Za-z]\d{1,2}(?:\.\d)?)\s*-\s*(.+)$/);
  if (comHifen) {
    return { cid_10: comHifen[1].toUpperCase(), cid_descricao: limparTexto(comHifen[2]) };
  }

  const soCodigo = texto.match(/^([A-Za-z]\d{1,2}(?:\.\d)?)$/);
  if (soCodigo) return { cid_10: soCodigo[1].toUpperCase(), cid_descricao: '' };

  alertas.push('CID não pôde ser separado automaticamente. Conteúdo mantido para revisão.');
  return { cid_10: '', cid_descricao: texto };
}

function interpretarStatusPublicacao({ nota_para_bg, numero_bg, data_bg }) {
  if (numero_bg && data_bg) return 'Publicado';
  if (nota_para_bg && (!numero_bg || !data_bg)) return 'Aguardando Publicação';
  return '';
}

function determinarStatusLinha({ erros, ignorado, revisar, alertas }) {
  if (erros.length) return STATUS_LINHA.ERRO;
  if (ignorado) return STATUS_LINHA.IGNORADO;
  if (revisar) return STATUS_LINHA.REVISAR;
  if (alertas.length) return STATUS_LINHA.APTO_COM_ALERTA;
  return STATUS_LINHA.APTO;
}

async function gerarHashArquivo(file) {
  const content = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', content);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function listarMilitares() {
  return base44.entities.Militar.list('-created_date', 10000);
}

function resolverMilitarPorTexto(textoMilitar, militares) {
  const texto = limparTexto(textoMilitar).toUpperCase();
  if (!texto) return { militar: null, candidatos: [] };

  const candidatos = militares.filter((m) => {
    const composto = `${limparTexto(m.posto_graduacao)} ${limparTexto(m.nome_guerra)}`.trim().toUpperCase();
    return composto && (composto === texto || composto.includes(texto) || texto.includes(composto));
  });

  if (candidatos.length === 1) return { militar: candidatos[0], candidatos };
  return { militar: null, candidatos };
}

async function existeDuplicacao(payload) {
  const itens = await base44.entities.Atestado.filter({
    militar_id: payload.militar_id,
    medico: payload.medico,
    tipo_afastamento: payload.tipo_afastamento,
    cid_10: payload.cid_10,
    data_inicio: payload.data_inicio,
    data_termino: payload.data_termino,
  });
  return itens.length > 0;
}

function montarResumo(linhas) {
  return {
    total_linhas: linhas.length,
    total_aptas: linhas.filter((x) => x.status === STATUS_LINHA.APTO).length,
    total_aptas_com_alerta: linhas.filter((x) => x.status === STATUS_LINHA.APTO_COM_ALERTA).length,
    total_revisar: linhas.filter((x) => x.status === STATUS_LINHA.REVISAR).length,
    total_ignoradas: linhas.filter((x) => x.status === STATUS_LINHA.IGNORADO).length,
    total_erros: linhas.filter((x) => x.status === STATUS_LINHA.ERRO).length,
  };
}

function montarPayloadAtestado({ linha, militar, dataImportacaoIso }) {
  const retornoJaPassou = linha.transformado.data_retorno && linha.transformado.data_retorno < dataImportacaoIso;
  const dias = Number(linha.transformado.dias || 0);
  const ehJiso = dias > LIMIAR_DIAS_JISO;

  return {
    militar_id: militar.id,
    militar_nome: militar.nome_completo || militar.nome_guerra || linha.transformado.militar_nome,
    militar_posto: militar.posto_graduacao || '',
    militar_matricula: militar.matricula || '',
    medico: linha.transformado.medico,
    arquivo_atestado: '',
    tipo_afastamento: linha.transformado.tipo_afastamento,
    cid_10: linha.transformado.cid_10,
    cid_descricao: linha.transformado.cid_descricao,
    acompanhado: false,
    grau_parentesco: '',
    data_inicio: linha.transformado.data_inicio,
    dias,
    data_termino: linha.transformado.data_termino,
    data_retorno: linha.transformado.data_retorno,
    status: retornoJaPassou ? 'Encerrado' : 'Ativo',
    fluxo_homologacao: ehJiso ? 'jiso' : 'comandante',
    necessita_jiso: ehJiso,
    homologado_comandante: false,
    encaminhado_jiso: ehJiso,
    data_jiso_agendada: '',
    observacoes: linha.transformado.observacoes,
    nota_para_bg: linha.transformado.nota_para_bg,
    texto_publicacao: linha.transformado.texto_publicacao,
    numero_bg: linha.transformado.numero_bg,
    data_bg: linha.transformado.data_bg,
    status_publicacao: linha.transformado.status_publicacao,
  };
}

export async function analisarArquivoMigracaoAtestados(file) {
  const texto = await file.text();
  const parsed = parseCsv(texto);
  if (parsed.length < 2) throw new Error('Arquivo sem dados suficientes para análise.');

  const headerMap = mapHeaders(parsed[0]);
  const militares = await listarMilitares();
  const linhas = [];

  for (let i = 1; i < parsed.length; i += 1) {
    const cells = parsed[i];
    const linhaNumero = i + 1;
    const alertas = [];
    const erros = [];
    const observacoes = [];
    let revisar = false;
    let ignorado = false;

    const militarOriginal = valorLinha(cells, headerMap, 'militar');
    const tipoOriginal = valorLinha(cells, headerMap, 'tipo');
    const medicoOriginal = valorLinha(cells, headerMap, 'medico');
    const cidOriginal = valorLinha(cells, headerMap, 'cid');
    const notaParaBg = limparTexto(valorLinha(cells, headerMap, 'nota_para_bg'));
    const textoPublicacao = limparTexto(valorLinha(cells, headerMap, 'texto_publicacao'));
    const numeroBg = limparTexto(valorLinha(cells, headerMap, 'numero_bg'));
    const dataBg = parseDataBrOuIso(valorLinha(cells, headerMap, 'data_bg'));
    const referenciaArquivoAntigo = limparTexto(valorLinha(cells, headerMap, 'arquivo'));

    const { militar, candidatos } = resolverMilitarPorTexto(militarOriginal, militares);
    if (!militar) {
      revisar = true;
      if (candidatos.length === 0) erros.push('Militar não encontrado para vínculo automático.');
      if (candidatos.length > 1) erros.push('Mais de um militar possível para vínculo automático.');
    }

    const tipoNormalizado = limparTexto(tipoOriginal);
    if (!tipoNormalizado) {
      erros.push('Tipo inválido.');
    } else if (tipoNormalizado.toUpperCase() === 'LTSPF') {
      ignorado = true;
      observacoes.push('Registro LTSPF excluído da migração automática. Lançamento deverá ser feito manualmente.');
    } else if (!TIPOS_ACEITOS.has(tipoNormalizado)) {
      erros.push('Tipo inválido.');
    }

    const dataInicio = parseDataBrOuIso(valorLinha(cells, headerMap, 'data_inicio'));
    const dataTermino = parseDataBrOuIso(valorLinha(cells, headerMap, 'data_termino'));
    const dias = Number(limparTexto(valorLinha(cells, headerMap, 'dias')));

    if (!dataInicio) erros.push('Data de início inválida.');
    if (!dataTermino) erros.push('Data de término inválida.');
    if (!Number.isFinite(dias) || dias <= 0) erros.push('Dias inválidos.');

    const calculado = diffDiasInclusivo(dataInicio, dataTermino);
    const dataRetorno = dataTermino ? adicionarDias(dataTermino, 1) : '';

    if (dataInicio && dataTermino && calculado !== null) {
      if (dataInicio > dataTermino || (Number.isFinite(dias) && dias !== calculado)) {
        revisar = true;
        erros.push('Inconsistência entre datas, duração e retorno do atestado. Revisão manual necessária.');
      }
    }

    if ((numeroBg && !dataBg) || (!numeroBg && dataBg)) {
      revisar = true;
      erros.push('BG e Data do BG vieram preenchidos de forma incompleta. Revisão manual necessária.');
    }

    const { medico, crm } = splitMedico(medicoOriginal, alertas);
    const { cid_10, cid_descricao } = splitCid(cidOriginal, alertas);
    const status_publicacao = interpretarStatusPublicacao({ nota_para_bg: notaParaBg, numero_bg: numeroBg, data_bg: dataBg });

    if (referenciaArquivoAntigo) {
      alertas.push('Arquivo do sistema antigo não foi migrado automaticamente. Apenas a referência foi preservada.');
      observacoes.push(`Arquivo legado: ${referenciaArquivoAntigo}`);
    }

    const linha = {
      linhaNumero,
      status: STATUS_LINHA.APTO,
      original: {
        militar: militarOriginal,
        tipo: tipoOriginal,
        medico: medicoOriginal,
        cid: cidOriginal,
        data_inicio: valorLinha(cells, headerMap, 'data_inicio'),
        data_termino: valorLinha(cells, headerMap, 'data_termino'),
        dias: valorLinha(cells, headerMap, 'dias'),
        retorno: valorLinha(cells, headerMap, 'retorno'),
        status_legado: valorLinha(cells, headerMap, 'status_legado'),
        nota_para_bg: notaParaBg,
        texto_publicacao: textoPublicacao,
        numero_bg: numeroBg,
        data_bg: valorLinha(cells, headerMap, 'data_bg'),
        arquivo: referenciaArquivoAntigo,
      },
      transformado: {
        militar_id: militar?.id || '',
        militar_nome: militar?.nome_completo || militar?.nome_guerra || '',
        militar_posto: militar?.posto_graduacao || '',
        militar_matricula: militar?.matricula || '',
        medico,
        crm_medico: crm,
        tipo_afastamento: tipoNormalizado,
        cid_10,
        cid_descricao,
        data_inicio: dataInicio,
        data_inicio_br: formatDataBr(dataInicio),
        data_termino: dataTermino,
        data_termino_br: formatDataBr(dataTermino),
        data_retorno: dataRetorno,
        data_retorno_br: formatDataBr(dataRetorno),
        dias: Number.isFinite(dias) ? dias : '',
        nota_para_bg: notaParaBg,
        texto_publicacao: textoPublicacao,
        numero_bg: numeroBg,
        data_bg: dataBg,
        data_bg_br: formatDataBr(dataBg),
        status_publicacao,
        observacoes: observacoes.join('\n'),
      },
      alertas,
      erros,
      candidatosMilitar: candidatos.map((m) => ({
        id: m.id,
        nome_completo: m.nome_completo,
        nome_guerra: m.nome_guerra,
        posto_graduacao: m.posto_graduacao,
        matricula: m.matricula,
      })),
      ajusteMilitarManual: false,
      publicacaoMigrada: Boolean(status_publicacao),
      idAtestadoCriado: null,
    };

    linha.status = determinarStatusLinha({ erros, ignorado, revisar, alertas });
    linhas.push(linha);
  }

  const resumo = montarResumo(linhas);
  return {
    arquivo: {
      nome: file.name,
      tipo: file.type || 'text/csv',
      hash: await gerarHashArquivo(file),
    },
    resumo,
    linhas,
    versao_regra_migracao: REGRA_VERSAO,
  };
}

export async function salvarAnaliseHistoricoAtestados(analise, usuario) {
  const payload = {
    nome_arquivo: analise.arquivo.nome,
    tipo_arquivo: analise.arquivo.tipo,
    hash_arquivo: analise.arquivo.hash,
    data_importacao: new Date().toISOString().slice(0, 10),
    importado_por: usuario?.id || '',
    importado_por_nome: usuario?.full_name || usuario?.email || '',
    ...analise.resumo,
    total_importadas: 0,
    total_nao_importadas: analise.resumo.total_linhas,
    status_importacao: STATUS_IMPORTACAO.ANALISADO,
    importar_linhas_com_alerta: false,
    versao_regra_migracao: analise.versao_regra_migracao,
    relatorio_json: JSON.stringify({
      arquivo: analise.arquivo,
      resumo: analise.resumo,
      linhas: analise.linhas,
      alertas: analise.linhas.flatMap((l) => l.alertas),
      erros: analise.linhas.flatMap((l) => l.erros),
      ids_criados: [],
    }),
    observacoes: 'Lote registrado apenas como análise inicial.',
  };

  return base44.entities.ImportacaoAtestados.create(payload);
}

export function atualizarMilitarLinhaAnalise(analise, linhaNumero, militar) {
  const novasLinhas = analise.linhas.map((linha) => {
    if (linha.linhaNumero !== linhaNumero) return linha;

    const errosFiltrados = linha.erros.filter((e) => !e.includes('Militar não encontrado') && !e.includes('Mais de um militar possível'));
    const alertas = [...linha.alertas];
    if (!alertas.includes('Militar ajustado manualmente na prévia de importação.')) {
      alertas.push('Militar ajustado manualmente na prévia de importação.');
    }

    const atualizado = {
      ...linha,
      transformado: {
        ...linha.transformado,
        militar_id: militar.id,
        militar_nome: militar.nome_completo || militar.nome_guerra || '',
        militar_posto: militar.posto_graduacao || '',
        militar_matricula: militar.matricula || '',
        observacoes: [linha.transformado.observacoes, 'Militar ajustado manualmente na prévia de importação.']
          .filter(Boolean)
          .join('\n'),
      },
      ajusteMilitarManual: true,
      alertas,
      erros: errosFiltrados,
    };

    const revisar = atualizado.erros.some((e) => e.includes('Inconsistência') || e.includes('BG e Data do BG'));
    atualizado.status = determinarStatusLinha({ erros: atualizado.erros, ignorado: linha.status === STATUS_LINHA.IGNORADO, revisar, alertas: atualizado.alertas });
    return atualizado;
  });

  return { ...analise, linhas: novasLinhas, resumo: montarResumo(novasLinhas) };
}

export async function importarAnaliseAtestados({ analise, incluirAlertas, historicoId, usuario }) {
  const agora = new Date();
  const hojeIso = agora.toISOString().slice(0, 10);

  await base44.entities.ImportacaoAtestados.update(historicoId, {
    status_importacao: STATUS_IMPORTACAO.IMPORTANDO,
    importar_linhas_com_alerta: incluirAlertas,
  });

  const idsCriados = [];
  const naoImportadas = [];

  try {
    for (const linha of analise.linhas) {
      const elegivel = linha.status === STATUS_LINHA.APTO || (incluirAlertas && linha.status === STATUS_LINHA.APTO_COM_ALERTA);
      if (!elegivel) {
        naoImportadas.push(linha.linhaNumero);
        continue;
      }

      if (!linha.transformado.militar_id) {
        naoImportadas.push(linha.linhaNumero);
        continue;
      }

      const militar = (await base44.entities.Militar.filter({ id: linha.transformado.militar_id }))[0];
      if (!militar) {
        naoImportadas.push(linha.linhaNumero);
        continue;
      }

      if ((linha.transformado.numero_bg && !linha.transformado.data_bg) || (!linha.transformado.numero_bg && linha.transformado.data_bg)) {
        naoImportadas.push(linha.linhaNumero);
        continue;
      }

      const duplicado = await existeDuplicacao({
        militar_id: militar.id,
        medico: linha.transformado.medico,
        tipo_afastamento: linha.transformado.tipo_afastamento,
        cid_10: linha.transformado.cid_10,
        data_inicio: linha.transformado.data_inicio,
        data_termino: linha.transformado.data_termino,
      });
      if (duplicado) {
        naoImportadas.push(linha.linhaNumero);
        continue;
      }

      const payload = montarPayloadAtestado({ linha, militar, dataImportacaoIso: hojeIso });
      const criado = await base44.entities.Atestado.create(payload);
      idsCriados.push(criado.id);
      linha.idAtestadoCriado = criado.id;
    }

    const totalImportadas = idsCriados.length;
    const totalNaoImportadas = analise.linhas.length - totalImportadas;

    const statusImportacao = totalImportadas === 0
      ? STATUS_IMPORTACAO.FALHOU
      : totalNaoImportadas > 0
        ? STATUS_IMPORTACAO.IMPORTADO_PARCIAL
        : STATUS_IMPORTACAO.IMPORTADO;

    const relatorio = {
      arquivo: analise.arquivo,
      resumo: {
        ...analise.resumo,
        total_importadas: totalImportadas,
        total_nao_importadas: totalNaoImportadas,
      },
      linhas: analise.linhas.map((linha) => ({
        numero_linha: linha.linhaNumero,
        militar_original: linha.original.militar,
        militar_final_vinculado: linha.transformado.militar_nome,
        tipo_original: linha.original.tipo,
        tipo_final: linha.transformado.tipo_afastamento,
        medico_original: linha.original.medico,
        medico_final: linha.transformado.medico,
        cid_original: linha.original.cid,
        cid_final: [linha.transformado.cid_10, linha.transformado.cid_descricao].filter(Boolean).join(' - '),
        periodo: `${linha.transformado.data_inicio_br} a ${linha.transformado.data_termino_br}`,
        status_linha: linha.status,
        alertas: linha.alertas,
        erros: linha.erros,
        ajuste_manual_militar: linha.ajusteMilitarManual,
        publicacao_migrada: linha.publicacaoMigrada,
        id_atestado_criado: linha.idAtestadoCriado,
      })),
      alertas: analise.linhas.flatMap((x) => x.alertas),
      erros: analise.linhas.flatMap((x) => x.erros),
      ids_criados: idsCriados,
      importado_por: usuario?.full_name || usuario?.email || '',
      importado_em: agora.toISOString(),
      linhas_nao_importadas: naoImportadas,
    };

    await base44.entities.ImportacaoAtestados.update(historicoId, {
      ...analise.resumo,
      total_importadas: totalImportadas,
      total_nao_importadas: totalNaoImportadas,
      status_importacao: statusImportacao,
      importar_linhas_com_alerta: incluirAlertas,
      relatorio_json: JSON.stringify(relatorio),
      observacoes: totalNaoImportadas > 0
        ? 'Importação parcial concluída. Nem todas as linhas elegíveis foram importadas após revalidação.'
        : 'Importação concluída com sucesso.',
    });

    return {
      statusImportacao,
      totalImportadas,
      totalNaoImportadas,
      relatorio,
    };
  } catch (error) {
    await base44.entities.ImportacaoAtestados.update(historicoId, {
      status_importacao: STATUS_IMPORTACAO.FALHOU,
      observacoes: error?.message || 'Falha durante a importação do lote.',
    });
    throw error;
  }
}

export function exportarRelatorioMigracaoAtestados(relatorio, nomeArquivo) {
  const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = nomeArquivo || `relatorio-migracao-atestados-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
