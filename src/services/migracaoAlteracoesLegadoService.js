import { base44 } from '@/api/base44Client';
import { strFromU8, unzipSync } from 'fflate';
import { atualizarHistoricoImportacaoAlteracoesLegado, criarHistoricoImportacaoAlteracoesLegado } from '@/services/importacaoAlteracoesLegadoService';
import { getTiposRPFiltrados } from '@/components/rp/rpTiposConfig';

export const STATUS_LINHA = {
  APTO: 'APTO',
  APTO_COM_ALERTA: 'APTO_COM_ALERTA',
  REVISAR: 'REVISAR',
  IGNORADO: 'IGNORADO',
  ERRO: 'ERRO',
  EXCLUIDO_DO_LOTE: 'EXCLUIDO_DO_LOTE',
};

const STATUS_IMPORTACAO = {
  ANALISADO: 'Analisado',
  IMPORTANDO: 'Importando',
  IMPORTADO: 'Importado',
  IMPORTADO_PARCIAL: 'Importado Parcial',
  FALHOU: 'Falhou',
};

const REGRA_VERSAO = 'v1.0.0';
const TIPO_NEUTRO_LEGADO = 'LEGADO_NAO_CLASSIFICADO';
const MAPEAMENTO_CLASSIFICACAO_MINIMA = [
  { materia: 'HOMOLOGAÇÃO DE ATESTADO MÉDICO', tipo: 'Homologação de Atestado' },
  { materia: 'ATA DE INSPEÇÃO DE SAÚDE', tipo: 'Ata JISO' },
  { materia: 'MELHORIA DE COMPORTAMENTO', tipo: 'Melhoria de Comportamento' },
  { materia: 'ELOGIO INDIVIDUAL', tipo: 'Elogio Individual' },
  { materia: 'DESIGNAÇÃO DE FUNÇÃO', tipo: 'Designação de Função' },
  { materia: 'LUTO', tipo: 'Luto' },
  { materia: 'CERTIFICADO DE CURSO', tipo: 'Cursos / Estágios / Capacitações' },
];

export const DESTINO_FINAL = {
  IMPORTAR: 'IMPORTAR',
  PENDENTE_CLASSIFICACAO: 'PENDENTE_CLASSIFICACAO',
  IGNORAR: 'IGNORAR',
  EXCLUIDO_DO_LOTE: 'EXCLUIDO_DO_LOTE',
};

const HEADER_ALIAS = {
  nota_id_legado: ['nota id', 'nota_id', 'nota', 'numero_nota'],
  cargo_legado: ['cargo'],
  nome_guerra_legado: ['nome guerra', 'nome_de_guerra'],
  nome_completo_legado: ['nome completo', 'nome'],
  matricula_legado: ['matricula', 'matrícula'],
  lotacao_legado: ['lotacao', 'lotação'],
  tipo_bg_legado: ['tipo bg', 'tipo_boletim'],
  materia_legado: ['materia', 'matéria'],
  submateria_legado: ['submateria', 'submatéria'],
  status_legado: ['status'],
  link_download_legado: ['link', 'link download', 'download'],
  conteudo_trecho_legado: [
    'conteudo (trecho)',
    'conteúdo (trecho)',
    'conteudotrecho',
    'conteudo_trecho',
    'conteudo trecho',
    'conteudo',
    'conteúdo',
    'trecho',
    'texto',
  ],
  numero_bg: ['numero bg', 'número bg', 'bg numero', 'bg'],
  data_publicacao: ['data publicacao', 'data publicação', 'data bg', 'data'],
  tipo_publicacao_sugerido: ['tipo_publicacao_sugerido', 'tipo publicacao sugerido', 'tipo publicação sugerido'],
  confianca_classificacao: ['confianca_classificacao', 'confiança_classificacao', 'confianca classificacao', 'confiança classificação'],
  revisao_manual: ['revisao_manual', 'revisão_manual', 'revisao manual', 'revisão manual'],
  motivo_classificacao: ['motivo_classificacao', 'motivo classificacao', 'motivo classificação'],
  regra_usada: ['regra_usada', 'regra usada'],
  observacao_classificacao: ['observacao_classificacao', 'observação_classificacao', 'observacao classificacao', 'observação classificação'],
  destino_sugerido: ['destino_sugerido', 'destino sugerido'],
  motivo_destino: ['motivo_destino', 'motivo destino'],
};

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

function normalizarTextoComparacao(valor) {
  return limparTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function somenteNumeros(valor) {
  return limparTexto(valor).replace(/\D/g, '');
}

function listarMatriculasMilitar(militar = {}) {
  const candidatas = [
    militar?.matricula_atual,
    militar?.matricula,
    ...(Array.isArray(militar?.matriculas_historico) ? militar.matriculas_historico.map((item) => item?.matricula || item?.matricula_normalizada) : []),
  ];

  return Array.from(new Set(candidatas.map(somenteNumeros).filter(Boolean)));
}

function nomeMilitarNormalizado(militar = {}) {
  return normalizarTextoComparacao(militar?.nome_completo || militar?.nome_guerra);
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

function normalizarCelulaExcel(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor;
  if (typeof valor === 'number') return valor;
  return String(valor).trim();
}

function parseXml(xmlString) {
  return new DOMParser().parseFromString(xmlString, 'application/xml');
}

function getZipText(arquivosZip, caminho) {
  const conteudo = arquivosZip[caminho];
  if (!conteudo) return null;
  return strFromU8(conteudo);
}

function resolverCaminho(base, destino) {
  if (!destino) return null;
  if (destino.startsWith('/')) return destino.replace(/^\//, '');
  const partesBase = base.split('/').slice(0, -1);
  destino.split('/').forEach((parte) => {
    if (!parte || parte === '.') return;
    if (parte === '..') {
      partesBase.pop();
      return;
    }
    partesBase.push(parte);
  });
  return partesBase.join('/');
}

function extrairSharedStrings(arquivosZip) {
  const xml = getZipText(arquivosZip, 'xl/sharedStrings.xml');
  if (!xml) return [];
  const doc = parseXml(xml);
  return Array.from(doc.getElementsByTagName('si')).map((item) => Array.from(item.getElementsByTagName('t')).map((node) => node.textContent || '').join(''));
}

function extrairIndiceColuna(celulaRef) {
  const letras = (celulaRef.match(/[A-Z]+/) || [''])[0];
  let indice = 0;
  for (let i = 0; i < letras.length; i += 1) indice = (indice * 26) + (letras.charCodeAt(i) - 64);
  return Math.max(indice - 1, 0);
}

function extrairNumeroLinha(celulaRef) {
  const numero = Number((celulaRef.match(/\d+/) || ['0'])[0]);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function extrairPlanilhaXml(arquivosZip) {
  const workbookXml = getZipText(arquivosZip, 'xl/workbook.xml');
  if (!workbookXml) throw new Error('Arquivo Excel inválido: workbook.xml ausente.');

  const workbookDoc = parseXml(workbookXml);
  const primeiraSheet = workbookDoc.getElementsByTagName('sheet')[0];
  if (!primeiraSheet) throw new Error('Arquivo Excel sem abas.');

  const relId = primeiraSheet.getAttribute('r:id');
  const relsXml = getZipText(arquivosZip, 'xl/_rels/workbook.xml.rels');
  if (!relsXml) throw new Error('Arquivo Excel inválido: relacionamento de workbook ausente.');

  const relsDoc = parseXml(relsXml);
  const relation = Array.from(relsDoc.getElementsByTagName('Relationship')).find((node) => node.getAttribute('Id') === relId);
  if (!relation) throw new Error('Não foi possível localizar a primeira aba da planilha.');

  const target = relation.getAttribute('Target');
  const caminho = resolverCaminho('xl/workbook.xml', target);
  const sheetXml = getZipText(arquivosZip, caminho);
  if (!sheetXml) throw new Error('Não foi possível ler os dados da primeira aba da planilha.');

  return sheetXml;
}

async function lerXlsxPrimeiraAbaUtil(file) {
  const buffer = await file.arrayBuffer();
  const arquivosZip = unzipSync(new Uint8Array(buffer));
  const sharedStrings = extrairSharedStrings(arquivosZip);
  const sheetXml = extrairPlanilhaXml(arquivosZip);
  const sheetDoc = parseXml(sheetXml);

  const linhasMap = new Map();

  Array.from(sheetDoc.getElementsByTagName('row')).forEach((rowNode) => {
    const linhaRef = Number(rowNode.getAttribute('r')) || null;
    const linhaAtual = [];

    Array.from(rowNode.getElementsByTagName('c')).forEach((cellNode) => {
      const celulaRef = cellNode.getAttribute('r') || '';
      const colunaIndex = extrairIndiceColuna(celulaRef);
      const tipo = cellNode.getAttribute('t');
      const valorNode = cellNode.getElementsByTagName('v')[0];
      const inlineNode = cellNode.getElementsByTagName('is')[0];
      let valor = '';

      if (tipo === 'inlineStr' && inlineNode) {
        valor = Array.from(inlineNode.getElementsByTagName('t')).map((n) => n.textContent || '').join('');
      } else if (valorNode) {
        const bruto = valorNode.textContent || '';
        if (tipo === 's') {
          const indiceShared = Number(bruto);
          valor = Number.isFinite(indiceShared) ? (sharedStrings[indiceShared] ?? '') : '';
        } else {
          valor = bruto;
        }
      }

      linhaAtual[colunaIndex] = normalizarCelulaExcel(valor);
    });

    const numeroLinha = linhaRef || extrairNumeroLinha(rowNode.getAttribute('r') || '') || linhasMap.size + 1;
    linhasMap.set(numeroLinha, linhaAtual);
  });

  return Array.from(linhasMap.entries()).sort((a, b) => a[0] - b[0]).map(([, linha]) => linha);
}

async function lerArquivoComoTabela(file) {
  const nomeArquivo = String(file?.name || '').toLowerCase();
  if (nomeArquivo.endsWith('.csv') || nomeArquivo.endsWith('.txt')) return parseCsv(await file.text());
  if (nomeArquivo.endsWith('.xlsx')) return (await lerXlsxPrimeiraAbaUtil(file)).filter((linha) => linha.some((cell) => limparTexto(cell)));
  if (nomeArquivo.endsWith('.xls')) throw new Error('Formato .xls não suportado nesta versão. Envie o arquivo em .xlsx ou CSV.');
  throw new Error('Formato de arquivo não suportado. Envie CSV ou Excel (.xlsx).');
}

function detectarColunas(headers = []) {
  const indexPorCampo = {};
  const normalized = headers.map((h) => normalizarChave(h));

  Object.entries(HEADER_ALIAS).forEach(([campo, alias]) => {
    const aliasesNormalizados = alias.map((a) => normalizarChave(a));
    const idx = normalized.findIndex((item) => aliasesNormalizados.includes(item));
    if (idx >= 0) indexPorCampo[campo] = idx;
  });

  return indexPorCampo;
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const ano = value.getUTCFullYear();
    const mes = String(value.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(value.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  const txt = limparTexto(value);
  if (!txt) return null;

  const brMatch = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

  const isoMatch = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const numeric = Number(txt);
  if (Number.isFinite(numeric) && numeric > 59) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = numeric * 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + ms);
    if (!Number.isNaN(date.getTime())) {
      const ano = date.getUTCFullYear();
      const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(date.getUTCDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    }
  }

  return null;
}

function formatDateBr(dateIso) {
  if (!dateIso) return '';
  const [ano, mes, dia] = dateIso.split('-');
  if (!ano || !mes || !dia) return dateIso;
  return `${dia}/${mes}/${ano}`;
}

function statusEhPublicadoLegado(status) {
  const s = normalizarTextoComparacao(status);
  return ['PUBLICADO', 'PUBLICADA', 'PUBLICACAO', 'PUBLICAÇÃO'].includes(s) || s.includes('PUBLICAD');
}

function calcularStatusLinha({ erros, revisoes, ignorado, alertas, destinoFinal }) {
  if (destinoFinal === DESTINO_FINAL.EXCLUIDO_DO_LOTE) return STATUS_LINHA.EXCLUIDO_DO_LOTE;
  if (erros.length) return STATUS_LINHA.ERRO;
  if (ignorado || destinoFinal === DESTINO_FINAL.IGNORAR) return STATUS_LINHA.IGNORADO;
  if (revisoes.length) return STATUS_LINHA.REVISAR;
  if (alertas.length) return STATUS_LINHA.APTO_COM_ALERTA;
  return STATUS_LINHA.APTO;
}

function construirChaveDuplicidade(transformado) {
  return [
    normalizarTextoComparacao(transformado.nota_id_legado),
    normalizarTextoComparacao(transformado.matricula_legado),
    normalizarTextoComparacao(transformado.materia_legado),
    normalizarTextoComparacao(transformado.numero_bg),
    normalizarTextoComparacao(transformado.data_bg),
    normalizarTextoComparacao(transformado.tipo_bg_legado),
  ].join('|');
}

function mapLinhaOriginal(headers, row) {
  const original = {};
  headers.forEach((header, index) => {
    original[normalizarChave(header || `coluna_${index + 1}`)] = limparTexto(row[index]);
  });
  return original;
}

function mapCamposTransformados(row, colunas) {
  const valor = (campo) => limparTexto(row[colunas[campo]]);
  const dataBg = parseDate(row[colunas.data_publicacao]);
  const bg = valor('numero_bg');

  return {
    nota_id_legado: valor('nota_id_legado'),
    cargo_legado: valor('cargo_legado'),
    nome_guerra_legado: valor('nome_guerra_legado'),
    nome_completo_legado: valor('nome_completo_legado'),
    matricula_legado: valor('matricula_legado'),
    lotacao_legado: valor('lotacao_legado'),
    tipo_bg_legado: valor('tipo_bg_legado'),
    materia_legado: valor('materia_legado'),
    submateria_legado: valor('submateria_legado'),
    status_legado: valor('status_legado'),
    link_download_legado: valor('link_download_legado'),
    conteudo_trecho_legado: valor('conteudo_trecho_legado'),
    numero_bg: bg,
    data_bg: dataBg,
    data_bg_br: formatDateBr(dataBg),
    tipo_publicacao: TIPO_NEUTRO_LEGADO,
    tipo_publicacao_sugerido: valor('tipo_publicacao_sugerido'),
    confianca_classificacao: valor('confianca_classificacao'),
    revisao_manual: valor('revisao_manual'),
    motivo_classificacao: valor('motivo_classificacao'),
    regra_usada: valor('regra_usada'),
    observacao_classificacao: valor('observacao_classificacao'),
    destino_sugerido: valor('destino_sugerido'),
    motivo_destino: valor('motivo_destino'),
    destino_final: '',
    tipo_publicacao_confirmado: '',
    tipo_publicacao_confirmado_manualmente: false,
    status_publicacao: 'Publicado',
    origem_registro: 'legado',
    importado_legado: true,
  };
}

function resolverTiposPublicacaoValidos(tiposCustom = []) {
  const tipos = getTiposRPFiltrados({ tiposCustom });
  const map = new Map();
  tipos.forEach((tipo) => {
    const value = limparTexto(tipo?.value);
    const label = limparTexto(tipo?.label || tipo?.value);
    if (!value) return;
    const canonico = label || value;
    map.set(normalizarTextoComparacao(value), canonico);
    map.set(normalizarTextoComparacao(label), canonico);
  });
  return map;
}

function resolverTipoClassificacaoMinima(transformado, tiposValidosMap) {
  const materiaNorm = normalizarTextoComparacao(transformado.materia_legado);
  if (!materiaNorm) return null;

  const correspondencia = MAPEAMENTO_CLASSIFICACAO_MINIMA.find((item) => normalizarTextoComparacao(item.materia) === materiaNorm);
  if (!correspondencia) return null;

  const tipoValido = tiposValidosMap.get(normalizarTextoComparacao(correspondencia.tipo));
  if (!tipoValido) return null;

  return {
    tipoPublicacao: tipoValido,
    regraUsada: `EQ_MATERIA:${correspondencia.materia}`,
  };
}


function resolverDestinoFinal(destinoSugerido, fallback = DESTINO_FINAL.IMPORTAR) {
  const normalizado = normalizarTextoComparacao(destinoSugerido);
  if (!normalizado) return fallback;
  if (normalizado === DESTINO_FINAL.IMPORTAR) return DESTINO_FINAL.IMPORTAR;
  if (normalizado === DESTINO_FINAL.PENDENTE_CLASSIFICACAO) return DESTINO_FINAL.PENDENTE_CLASSIFICACAO;
  if (normalizado === DESTINO_FINAL.IGNORAR) return DESTINO_FINAL.IGNORAR;
  if (normalizado === DESTINO_FINAL.EXCLUIDO_DO_LOTE) return DESTINO_FINAL.EXCLUIDO_DO_LOTE;
  return fallback;
}

function atualizarLinhaComStatus(linha) {
  const destinoFinal = linha.transformado.destino_final || DESTINO_FINAL.IMPORTAR;
  const status = calcularStatusLinha({
    erros: linha.erros || [],
    revisoes: linha.revisoes || [],
    alertas: linha.alertas || [],
    ignorado: false,
    destinoFinal,
  });

  return {
    ...linha,
    transformado: {
      ...linha.transformado,
      classificacao_pendente: destinoFinal === DESTINO_FINAL.PENDENTE_CLASSIFICACAO,
      tipo_publicacao: destinoFinal === DESTINO_FINAL.PENDENTE_CLASSIFICACAO
        ? TIPO_NEUTRO_LEGADO
        : (linha.transformado.tipo_publicacao_confirmado || TIPO_NEUTRO_LEGADO),
    },
    status,
  };
}

function resolverMilitar(transformado, indicesMilitares) {
  const matriculaNorm = somenteNumeros(transformado.matricula_legado);
  const nomeNorm = normalizarTextoComparacao(transformado.nome_completo_legado || transformado.nome_guerra_legado);

  if (matriculaNorm && indicesMilitares.byMatricula.has(matriculaNorm)) {
    const candidatosMatricula = indicesMilitares.byMatricula.get(matriculaNorm);
    if (candidatosMatricula.length === 1) return { militar: candidatosMatricula[0], metodo: 'MATRICULA_EXATA' };

    const filtradosNome = candidatosMatricula.filter((m) => nomeNorm && nomeMilitarNormalizado(m) === nomeNorm);
    if (filtradosNome.length === 1) return { militar: filtradosNome[0], metodo: 'MATRICULA_COM_NOME' };

    return { candidatos: candidatosMatricula, metodo: 'AMBIGUO_MATRICULA' };
  }

  if (nomeNorm && indicesMilitares.byNome.has(nomeNorm)) {
    const candidatosNome = indicesMilitares.byNome.get(nomeNorm);
    if (candidatosNome.length === 1) return { militar: candidatosNome[0], metodo: 'NOME_EXATO' };
    return { candidatos: candidatosNome, metodo: 'AMBIGUO_NOME' };
  }

  return { metodo: 'NAO_LOCALIZADO' };
}

function buildMilitarIndices(militares = []) {
  const byMatricula = new Map();
  const byNome = new Map();

  militares.forEach((militar) => {
    const matriculas = listarMatriculasMilitar(militar);
    const nome = nomeMilitarNormalizado(militar);

    matriculas.forEach((matricula) => {
      if (!byMatricula.has(matricula)) byMatricula.set(matricula, []);
      byMatricula.get(matricula).push(militar);
    });

    if (nome) {
      if (!byNome.has(nome)) byNome.set(nome, []);
      byNome.get(nome).push(militar);
    }
  });

  return { byMatricula, byNome };
}

function criarHashArquivo(file) {
  return [file?.name || 'arquivo', file?.size || 0, file?.lastModified || 0].join(':');
}

function gerarResumo(linhas) {
  return linhas.reduce((acc, linha) => {
    acc.total_linhas += 1;
    if (linha.status === STATUS_LINHA.APTO) acc.total_aptas += 1;
    if (linha.status === STATUS_LINHA.APTO_COM_ALERTA) acc.total_aptas_com_alerta += 1;
    if (linha.status === STATUS_LINHA.REVISAR) acc.total_revisar += 1;
    if (linha.status === STATUS_LINHA.IGNORADO) acc.total_ignoradas += 1;
    if (linha.status === STATUS_LINHA.ERRO) acc.total_erros += 1;
    if (linha.status === STATUS_LINHA.EXCLUIDO_DO_LOTE) acc.total_excluidas_lote += 1;
    if (linha.transformado?.destino_final === DESTINO_FINAL.PENDENTE_CLASSIFICACAO) acc.total_pendentes_classificacao += 1;
    if (linha.alertas?.length) acc.total_alertas += 1;
    if (linha.revisoes?.some((r) => r.includes('duplicidade'))) acc.total_duplicidades += 1;
    return acc;
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

export async function analisarArquivoMigracaoAlteracoesLegado(file) {
  const tabela = await lerArquivoComoTabela(file);
  if (!tabela.length) throw new Error('Arquivo sem conteúdo válido para análise.');

  const [header, ...rows] = tabela;
  const colunas = detectarColunas(header);

  const camposObrigatorios = ['nome_completo_legado', 'matricula_legado', 'materia_legado', 'numero_bg', 'data_publicacao'];
  const ausentes = camposObrigatorios.filter((campo) => colunas[campo] === undefined);
  if (ausentes.length) {
    throw new Error(`Cabeçalhos obrigatórios ausentes na planilha: ${ausentes.join(', ')}.`);
  }

  const [militares, publicacoesLegadoExistentes, tiposPublicacaoCustom] = await Promise.all([
    base44.entities.Militar.list('-created_date', 10000),
    base44.entities.PublicacaoExOfficio.filter({ importado_legado: true }, '-created_date'),
    base44.entities.TipoPublicacaoCustom.list('-created_date').catch(() => []),
  ]);
  const tiposValidosMap = resolverTiposPublicacaoValidos(tiposPublicacaoCustom);
  const tiposPublicacaoValidos = Array.from(new Set(Array.from(tiposValidosMap.values()))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const militarIndices = buildMilitarIndices(militares);
  const duplicidadeExistente = new Set(publicacoesLegadoExistentes.map((item) => construirChaveDuplicidade({
    nota_id_legado: item.nota_id_legado,
    matricula_legado: item.matricula_legado || item.militar_matricula,
    materia_legado: item.materia_legado,
    numero_bg: item.numero_bg,
    data_bg: item.data_bg,
    tipo_bg_legado: item.tipo_bg_legado,
  })));

  const duplicidadeArquivo = new Map();
  const linhas = rows.map((row, index) => {
    const linhaNumero = index + 2;
    const original = mapLinhaOriginal(header, row);
    const transformado = mapCamposTransformados(row, colunas);
    const erros = [];
    const alertas = [];
    const revisoes = [];
    let ignorado = false;

    if (!transformado.materia_legado && !transformado.nota_id_legado) {
      erros.push('Matéria legado ausente sem identificador mínimo alternativo (Nota ID).');
    }

    const classificacaoMinima = resolverTipoClassificacaoMinima(transformado, tiposValidosMap);
    if (classificacaoMinima) {
      transformado.tipo_publicacao_sugerido = classificacaoMinima.tipoPublicacao;
      transformado.tipo_publicacao_confirmado = classificacaoMinima.tipoPublicacao;
      transformado.tipo_publicacao = classificacaoMinima.tipoPublicacao;
      transformado.confianca_classificacao = 'ALTA';
      transformado.regra_usada = classificacaoMinima.regraUsada;
      transformado.motivo_classificacao = 'Correspondência exata e inequívoca da matéria legado para tipo atual.';
      transformado.destino_sugerido = DESTINO_FINAL.IMPORTAR;
      transformado.destino_final = DESTINO_FINAL.IMPORTAR;
    } else {
      transformado.tipo_publicacao_confirmado = '';
      transformado.tipo_publicacao = TIPO_NEUTRO_LEGADO;
      transformado.destino_sugerido = DESTINO_FINAL.PENDENTE_CLASSIFICACAO;
      transformado.destino_final = DESTINO_FINAL.PENDENTE_CLASSIFICACAO;
      transformado.motivo_destino = limparTexto(transformado.motivo_destino) || 'Sem equivalência segura para classificação automática mínima.';
      if (transformado.destino_final !== DESTINO_FINAL.PENDENTE_CLASSIFICACAO) {
        revisoes.push('Tipo de publicação pendente: sugestão ausente/inválida ou LEGADO_NAO_CLASSIFICADO.');
      }
    }

    if (transformado.destino_final === DESTINO_FINAL.PENDENTE_CLASSIFICACAO) {
      transformado.classificacao_pendente = true;
      transformado.tipo_publicacao_confirmado = '';
      transformado.tipo_publicacao = TIPO_NEUTRO_LEGADO;
    }

    if (!transformado.numero_bg) erros.push('Número do BG obrigatório ausente.');
    if (!transformado.data_bg) erros.push('Data de publicação/BG inválida ou ausente.');

    if (!statusEhPublicadoLegado(transformado.status_legado || 'Publicado')) {
      erros.push('Status legado não publicado. Apenas registros já publicados podem ser importados.');
    }

    const resolucao = resolverMilitar(transformado, militarIndices);
    if (resolucao.militar) {
      const matriculaAtualMilitar = resolucao.militar.matricula_atual || resolucao.militar.matricula || '';
      transformado.militar_id = resolucao.militar.id;
      transformado.militar_nome = resolucao.militar.nome_completo || resolucao.militar.nome_guerra || '';
      transformado.militar_matricula = matriculaAtualMilitar;
      transformado.militar_matricula_atual = matriculaAtualMilitar;
      transformado.militar_matricula_vinculo = transformado.matricula_legado || '';
      transformado.vinculo_automatico_metodo = resolucao.metodo;

      const matriculaLegadoNorm = somenteNumeros(transformado.matricula_legado);
      const matriculaAtualNorm = somenteNumeros(matriculaAtualMilitar);
      if (matriculaLegadoNorm && matriculaAtualNorm && matriculaLegadoNorm !== matriculaAtualNorm) {
        alertas.push('Matrícula legado difere da matrícula atual do militar vinculado; registro legado foi preservado.');
      }
    } else if (resolucao.metodo === 'AMBIGUO_MATRICULA' || resolucao.metodo === 'AMBIGUO_NOME') {
      revisoes.push('Múltiplos militares possíveis para vínculo automático; revisar manualmente.');
    } else {
      revisoes.push('Militar não localizado para vínculo automático.');
    }

    const chave = construirChaveDuplicidade(transformado);
    if (duplicidadeExistente.has(chave)) revisoes.push('Suspeita de duplicidade contra registros legado já importados.');
    const prev = duplicidadeArquivo.get(chave) || 0;
    duplicidadeArquivo.set(chave, prev + 1);

    if (!transformado.conteudo_trecho_legado) {
      alertas.push('Trecho de conteúdo legado ausente; registro será importado com texto mínimo.');
    }

    if (!transformado.link_download_legado) {
      alertas.push('Link de download legado não informado.');
    }

    if (!transformado.nota_id_legado) {
      alertas.push('Nota ID legado ausente; preservação parcial de rastreabilidade.');
    }

    if (!limparTexto(row.join(''))) {
      ignorado = true;
    }

    return {
      linhaNumero,
      chave_duplicidade: chave,
      status: STATUS_LINHA.APTO,
      original,
      transformado,
      erros,
      alertas,
      revisoes,
      observacoes: [],
      ajustes_manuais: [],
    };
  });

  linhas.forEach((linha) => {
    if ((duplicidadeArquivo.get(linha.chave_duplicidade) || 0) > 1) {
      linha.revisoes.push('Suspeita de duplicidade dentro do arquivo atual.');
    }
    const linhaAtualizada = atualizarLinhaComStatus(linha);
    linha.status = linhaAtualizada.status;
    linha.transformado = linhaAtualizada.transformado;
  });

  const resumo = gerarResumo(linhas);

  return {
    arquivo: {
      nome: file?.name || 'arquivo',
      tipo: file?.type || 'application/octet-stream',
      tamanho: file?.size || 0,
      hash: criarHashArquivo(file),
    },
    versao_regra_migracao: REGRA_VERSAO,
    tipo_publicacao_neutro: TIPO_NEUTRO_LEGADO,
    tipos_publicacao_validos: tiposPublicacaoValidos,
    linhas,
    resumo,
  };
}

export function atualizarMilitarLinhaAnalise(analise, linhaNumero, militar) {
  if (!analise) return analise;

  const linhasAtualizadas = analise.linhas.map((linha) => {
    if (linha.linhaNumero !== linhaNumero) return linha;

    const revisoes = (linha.revisoes || []).filter((r) => !r.includes('Militar'));
    const transformado = {
      ...linha.transformado,
      militar_id: militar?.id || '',
      militar_nome: militar?.nome_completo || militar?.nome_guerra || '',
      militar_matricula: militar?.matricula_atual || militar?.matricula || '',
      militar_matricula_atual: militar?.matricula_atual || militar?.matricula || '',
      militar_matricula_vinculo: linha.transformado.matricula_legado || '',
      vinculo_automatico_metodo: militar?.id ? 'AJUSTE_MANUAL' : linha.transformado.vinculo_automatico_metodo,
    };

    const ajustes = [...(linha.ajustes_manuais || [])];
    ajustes.push({
      tipo: 'MILITAR',
      antes: linha.transformado.militar_id || null,
      depois: militar?.id || null,
      timestamp: new Date().toISOString(),
    });

    return atualizarLinhaComStatus({
      ...linha,
      revisoes,
      transformado,
      ajustes_manuais: ajustes,
    });
  });

  return {
    ...analise,
    linhas: linhasAtualizadas,
    resumo: gerarResumo(linhasAtualizadas),
  };
}

export function atualizarTipoPublicacaoLinhaAnalise(analise, linhaNumero, tipoPublicacaoConfirmado) {
  if (!analise) return analise;

  const tipoMap = new Map((analise.tipos_publicacao_validos || []).map((tipo) => [normalizarTextoComparacao(tipo), tipo]));
  const valorSelecionado = limparTexto(tipoPublicacaoConfirmado);
  const tipoValido = tipoMap.get(normalizarTextoComparacao(valorSelecionado)) || '';

  const linhasAtualizadas = analise.linhas.map((linha) => {
    if (linha.linhaNumero !== linhaNumero) return linha;

    const revisoes = (linha.revisoes || []).filter((r) => !r.includes('Tipo de publicação pendente'));
    const transformado = {
      ...linha.transformado,
      tipo_publicacao_confirmado: tipoValido,
      tipo_publicacao_confirmado_manualmente: true,
      tipo_publicacao: tipoValido || TIPO_NEUTRO_LEGADO,
    };

    if (!tipoValido) revisoes.push('Tipo de publicação pendente: sugestão ausente/inválida ou LEGADO_NAO_CLASSIFICADO.');

    const ajustes = [...(linha.ajustes_manuais || [])];
    ajustes.push({
      tipo: 'TIPO_PUBLICACAO',
      antes: linha.transformado.tipo_publicacao_confirmado || null,
      depois: tipoValido || null,
      timestamp: new Date().toISOString(),
    });

    return atualizarLinhaComStatus({
      ...linha,
      revisoes,
      transformado,
      ajustes_manuais: ajustes,
    });
  });

  return {
    ...analise,
    linhas: linhasAtualizadas,
    resumo: gerarResumo(linhasAtualizadas),
  };
}


export function atualizarDestinoLinhaAnalise(analise, linhaNumero, destinoFinal) {
  if (!analise) return analise;

  const destinoNormalizado = resolverDestinoFinal(destinoFinal, DESTINO_FINAL.IMPORTAR);

  const linhasAtualizadas = analise.linhas.map((linha) => {
    if (linha.linhaNumero !== linhaNumero) return linha;

    const revisoesBase = (linha.revisoes || []).filter((r) => !r.includes('Tipo de publicação pendente') && !r.includes('Motivo obrigatório'));
    const revisoes = [...revisoesBase];

    const transformado = {
      ...linha.transformado,
      destino_final: destinoNormalizado,
    };

    if (destinoNormalizado === DESTINO_FINAL.PENDENTE_CLASSIFICACAO) {
      transformado.tipo_publicacao_confirmado = '';
      transformado.tipo_publicacao = TIPO_NEUTRO_LEGADO;
    } else if (!transformado.tipo_publicacao_confirmado) {
      revisoes.push('Tipo de publicação pendente: sugestão ausente/inválida ou LEGADO_NAO_CLASSIFICADO.');
    }
    if ([DESTINO_FINAL.IGNORAR, DESTINO_FINAL.EXCLUIDO_DO_LOTE].includes(destinoNormalizado) && !limparTexto(transformado.motivo_destino)) {
      revisoes.push('Motivo obrigatório para destino IGNORAR ou EXCLUIDO_DO_LOTE.');
    }

    const ajustes = [...(linha.ajustes_manuais || [])];
    ajustes.push({
      tipo: 'DESTINO_FINAL',
      antes: linha.transformado.destino_final || DESTINO_FINAL.IMPORTAR,
      depois: destinoNormalizado,
      timestamp: new Date().toISOString(),
    });

    return atualizarLinhaComStatus({
      ...linha,
      revisoes,
      transformado,
      ajustes_manuais: ajustes,
    });
  });

  return {
    ...analise,
    linhas: linhasAtualizadas,
    resumo: gerarResumo(linhasAtualizadas),
  };
}

export function atualizarMotivoDestinoLinhaAnalise(analise, linhaNumero, motivoDestino) {
  if (!analise) return analise;

  const linhasAtualizadas = analise.linhas.map((linha) => {
    if (linha.linhaNumero !== linhaNumero) return linha;

    const transformado = {
      ...linha.transformado,
      motivo_destino: limparTexto(motivoDestino),
    };
    const revisoes = (linha.revisoes || []).filter((r) => !r.includes('Motivo obrigatório'));
    if (
      [DESTINO_FINAL.IGNORAR, DESTINO_FINAL.EXCLUIDO_DO_LOTE].includes(transformado.destino_final)
      && !transformado.motivo_destino
    ) {
      revisoes.push('Motivo obrigatório para destino IGNORAR ou EXCLUIDO_DO_LOTE.');
    }

    const ajustes = [...(linha.ajustes_manuais || [])];
    ajustes.push({
      tipo: 'MOTIVO_DESTINO',
      antes: linha.transformado.motivo_destino || null,
      depois: transformado.motivo_destino || null,
      timestamp: new Date().toISOString(),
    });

    return atualizarLinhaComStatus({
      ...linha,
      revisoes,
      transformado,
      ajustes_manuais: ajustes,
    });
  });

  return {
    ...analise,
    linhas: linhasAtualizadas,
    resumo: gerarResumo(linhasAtualizadas),
  };
}

function buildPayloadPublicacaoLegado(linha, historicoId, usuario) {
  const t = linha.transformado;
  const textoPrincipal = t.conteudo_trecho_legado || t.materia_legado || `Registro legado importado (Nota ID: ${t.nota_id_legado || 'N/I'})`;
  const tipoFinal = t.destino_final === DESTINO_FINAL.PENDENTE_CLASSIFICACAO
    ? TIPO_NEUTRO_LEGADO
    : (t.tipo_publicacao_confirmado || t.tipo_publicacao_sugerido || t.tipo_publicacao || TIPO_NEUTRO_LEGADO);
  const rastreabilidadeClassificacao = {
    tipo_publicacao_sugerido: t.tipo_publicacao_sugerido || '',
    tipo_publicacao_confirmado: t.tipo_publicacao_confirmado || '',
    confianca_classificacao: t.confianca_classificacao || '',
    revisao_manual: t.revisao_manual || '',
    motivo_classificacao: t.motivo_classificacao || '',
    regra_usada: t.regra_usada || '',
    observacao_classificacao: t.observacao_classificacao || '',
    destino_sugerido: t.destino_sugerido || '',
    destino_final: t.destino_final || DESTINO_FINAL.IMPORTAR,
    motivo_destino: t.motivo_destino || '',
  };

  return {
    militar_id: t.militar_id,
    militar_nome: t.militar_nome,
    militar_matricula: t.militar_matricula,
    militar_matricula_atual: t.militar_matricula_atual || t.militar_matricula || '',
    militar_matricula_vinculo: t.militar_matricula_vinculo || t.matricula_legado || '',
    tipo: tipoFinal,
    status: 'Publicado',
    status_publicacao: 'Publicado',
    numero_bg: t.numero_bg,
    data_bg: t.data_bg,
    data_publicacao: t.data_bg,
    nota_para_bg: `LEGADO - Nota ID ${t.nota_id_legado || 'N/I'}`,
    texto_publicacao: textoPrincipal,
    texto_base: textoPrincipal,
    texto: textoPrincipal,
    observacoes: [
      'Registro importado de base legada.',
      `Histórico de lote: ${historicoId || 'N/I'}.`,
      t.materia_legado ? `Matéria legado: ${t.materia_legado}` : '',
      `Classificação legado (JSON): ${JSON.stringify(rastreabilidadeClassificacao)}`,
    ].filter(Boolean).join(' '),
    origem_registro: 'legado',
    importado_legado: true,
    importacao_legado_id: historicoId || null,
    importado_por_legado_id: usuario?.id || usuario?.email || '',
    importado_por_legado_nome: usuario?.full_name || usuario?.name || usuario?.email || '',
    importado_em_legado: new Date().toISOString(),
    tipo_publicacao_original_legado: t.tipo_publicacao,
    tipo_publicacao_sugerido: t.tipo_publicacao_sugerido || '',
    tipo_publicacao_confirmado: t.tipo_publicacao_confirmado || '',
    confianca_classificacao: t.confianca_classificacao || '',
    motivo_classificacao: t.motivo_classificacao || '',
    regra_usada: t.regra_usada || '',
    observacao_classificacao: t.observacao_classificacao || '',
    destino_sugerido: t.destino_sugerido || '',
    destino_final: t.destino_final || DESTINO_FINAL.IMPORTAR,
    motivo_destino: t.motivo_destino || '',
    classificacao_pendente: t.destino_final === DESTINO_FINAL.PENDENTE_CLASSIFICACAO,
    nota_id_legado: t.nota_id_legado,
    cargo_legado: t.cargo_legado,
    nome_guerra_legado: t.nome_guerra_legado,
    nome_completo_legado: t.nome_completo_legado,
    matricula_legado: t.matricula_legado,
    lotacao_legado: t.lotacao_legado,
    tipo_bg_legado: t.tipo_bg_legado,
    materia_legado: t.materia_legado,
    submateria_legado: t.submateria_legado,
    status_legado: t.status_legado || 'Publicado',
    link_download_legado: t.link_download_legado,
    conteudo_trecho_legado: t.conteudo_trecho_legado,
  };
}

export async function salvarAnaliseHistoricoAlteracoesLegado(analise, usuario) {
  const payload = {
    nome_arquivo: analise.arquivo.nome,
    tipo_arquivo: analise.arquivo.tipo,
    hash_arquivo: analise.arquivo.hash,
    data_importacao: new Date().toISOString(),
    importado_por: usuario?.email || usuario?.id || 'desconhecido',
    importado_por_nome: usuario?.full_name || usuario?.name || usuario?.email || 'Desconhecido',
    ...analise.resumo,
    total_importadas: 0,
    total_nao_importadas: analise.resumo.total_linhas,
    status_importacao: STATUS_IMPORTACAO.ANALISADO,
    importar_linhas_com_alerta: false,
    versao_regra_migracao: analise.versao_regra_migracao || REGRA_VERSAO,
    relatorio_json: JSON.stringify({ analise }),
    observacoes: 'Lote analisado de migração de alterações legado.',
  };

  const historico = await criarHistoricoImportacaoAlteracoesLegado(payload);
  if (!historico?.id) {
    throw new Error('Falha ao salvar histórico da análise: resposta sem ID válido.');
  }
  return historico;
}


function linhaTemSomenteRevisaoTipo(linha) {
  const revisoes = linha.revisoes || [];
  if (!revisoes.length) return true;
  return revisoes.every((r) => r.includes('Tipo de publicação pendente'));
}

export async function importarAnaliseAlteracoesLegado({ analise, incluirAlertas = false, incluirPendentesClassificacao = false, historicoId, usuario }) {
  if (!analise?.linhas?.length) throw new Error('Análise inválida para importação.');
  const avisosHistorico = [];
  let historicoImportando = null;

  if (historicoId) {
    historicoImportando = await atualizarHistoricoImportacaoAlteracoesLegado(historicoId, {
      status_importacao: STATUS_IMPORTACAO.IMPORTANDO,
      importar_linhas_com_alerta: !!incluirAlertas,
      importar_linhas_pendentes_classificacao: !!incluirPendentesClassificacao,
    });
  }

  const importaveis = analise.linhas.filter((linha) => {
    const destino = linha.transformado?.destino_final || DESTINO_FINAL.IMPORTAR;
    if (linha.status === STATUS_LINHA.ERRO || linha.status === STATUS_LINHA.EXCLUIDO_DO_LOTE || destino === DESTINO_FINAL.IGNORAR || destino === DESTINO_FINAL.EXCLUIDO_DO_LOTE) return false;
    if (destino === DESTINO_FINAL.PENDENTE_CLASSIFICACAO) return !!incluirPendentesClassificacao && !linha.erros?.length && linhaTemSomenteRevisaoTipo(linha);
    if (linha.status === STATUS_LINHA.APTO) return true;
    if (linha.status === STATUS_LINHA.APTO_COM_ALERTA) return !!incluirAlertas;
    return false;
  });
  const naoImportadas = analise.linhas.filter((linha) => !importaveis.includes(linha));

  const resultado = {
    totalImportadas: 0,
    totalNaoImportadas: naoImportadas.length,
    erros: [],
    idsPublicacoes: [],
  };

  for (const linha of importaveis) {
    try {
      const payload = buildPayloadPublicacaoLegado(linha, historicoId, usuario);
      const criado = await base44.entities.PublicacaoExOfficio.create(payload);
      resultado.totalImportadas += 1;
      resultado.idsPublicacoes.push(criado.id);
    } catch (error) {
      resultado.erros.push({ linhaNumero: linha.linhaNumero, mensagem: error?.message || 'Falha ao criar publicação legado.' });
    }
  }

  const statusFinal = resultado.erros.length
    ? (resultado.totalImportadas > 0 ? STATUS_IMPORTACAO.IMPORTADO_PARCIAL : STATUS_IMPORTACAO.FALHOU)
    : STATUS_IMPORTACAO.IMPORTADO;

  const relatorio = {
    arquivo: analise.arquivo,
    resumoAnalise: analise.resumo,
    totalImportadas: resultado.totalImportadas,
    totalNaoImportadas: resultado.totalNaoImportadas,
    errosImportacao: resultado.erros,
    incluirAlertas,
    incluirPendentesClassificacao,
    historicoId,
    finalizadoEm: new Date().toISOString(),
  };

  let historicoFinal = null;
  if (historicoId) {
    historicoFinal = await atualizarHistoricoImportacaoAlteracoesLegado(historicoId, {
      ...analise.resumo,
      total_importadas: resultado.totalImportadas,
      total_nao_importadas: resultado.totalNaoImportadas,
      ajustes_manuais: analise.linhas.reduce((acc, linha) => acc + (linha.ajustes_manuais?.length || 0), 0),
      status_importacao: statusFinal,
      importar_linhas_com_alerta: !!incluirAlertas,
      importar_linhas_pendentes_classificacao: !!incluirPendentesClassificacao,
      relatorio_json: JSON.stringify(relatorio),
      observacoes: resultado.erros.length ? `Importação com ${resultado.erros.length} erro(s) em linhas específicas.` : 'Importação concluída com sucesso.',
    });
  }

  return {
    historicoInicial: historicoImportando,
    historicoFinal,
    avisosHistorico,
    statusImportacao: statusFinal,
    totalImportadas: resultado.totalImportadas,
    totalNaoImportadas: resultado.totalNaoImportadas,
    relatorio,
  };
}

export function exportarRelatorioMigracaoAlteracoesLegado(relatorio, nomeArquivo = 'relatorio-migracao-alteracoes-legado.json') {
  const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


export async function listarPublicacoesLegadoPendentesClassificacao() {
  return base44.entities.PublicacaoExOfficio.filter({
    origem_registro: 'legado',
    classificacao_pendente: true,
    tipo: TIPO_NEUTRO_LEGADO,
  }, '-created_date');
}

export async function classificarPublicacaoLegadoPendente({ publicacaoId, tipoPublicacaoConfirmado, usuario, tiposPublicacaoCustom = [] }) {
  const tiposValidosMap = resolverTiposPublicacaoValidos(tiposPublicacaoCustom);
  const tipoValido = tiposValidosMap.get(normalizarTextoComparacao(tipoPublicacaoConfirmado || ''));
  if (!tipoValido) {
    throw new Error('Tipo de publicação inválido para classificação posterior.');
  }

  return base44.entities.PublicacaoExOfficio.update(publicacaoId, {
    tipo: tipoValido,
    tipo_publicacao_confirmado: tipoValido,
    classificacao_pendente: false,
    destino_final: DESTINO_FINAL.IMPORTAR,
    classificado_posteriormente_por_id: usuario?.id || usuario?.email || '',
    classificado_posteriormente_por_nome: usuario?.full_name || usuario?.name || usuario?.email || '',
    classificado_posteriormente_em: new Date().toISOString(),
  });
}
