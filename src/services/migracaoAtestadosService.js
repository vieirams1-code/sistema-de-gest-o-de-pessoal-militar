import { base44 } from '@/api/base44Client';
import { strFromU8, unzipSync } from 'fflate';

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
const HISTORICO_ENTITY_NAME = 'ImportacaoAtestados';
const HISTORICO_ENTITY_ERROR_MESSAGE = 'Falha ao acessar o histórico de importação de atestados. Verifique se a entidade ImportacaoAtestados está publicada no app.';
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

const POSTO_EQUIVALENCIAS = {
  SD: ['SOLDADO'],
  CB: ['CABO'],
  '3SGT': ['3 SARGENTO', '3º SARGENTO', 'TERCEIRO SARGENTO'],
  '2SGT': ['2 SARGENTO', '2º SARGENTO', 'SEGUNDO SARGENTO'],
  '1SGT': ['1 SARGENTO', '1º SARGENTO', 'PRIMEIRO SARGENTO'],
  ST: ['SUBTENENTE'],
  ASP: ['ASPIRANTE'],
  TEN: ['TENENTE', '2 TENENTE', '1 TENENTE', '2º TENENTE', '1º TENENTE'],
  CAP: ['CAPITAO', 'CAPITÃO'],
  MAJ: ['MAJOR'],
  TC: ['TENENTE CORONEL'],
  CEL: ['CORONEL'],
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

function isLinhaVazia(cells) {
  return !cells.some((cell) => limparTexto(cell));
}

function normalizarCelulaExcel(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor;
  if (typeof valor === 'number') return valor;
  return String(valor).trim();
}

function parseExcel(linhasPlanilha) {
  const linhas = linhasPlanilha
    .map((linha) => linha.map(normalizarCelulaExcel))
    .filter((linha) => !isLinhaVazia(linha));

  if (!linhas.length) {
    throw new Error('Planilha sem conteúdo válido para análise.');
  }

  if (isLinhaVazia(linhas[0])) {
    throw new Error('Planilha sem cabeçalhos válidos para análise.');
  }

  return linhas;
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
  return Array.from(doc.getElementsByTagName('si')).map((item) => {
    const textos = Array.from(item.getElementsByTagName('t')).map((node) => node.textContent || '');
    return textos.join('');
  });
}

function extrairIndiceColuna(celulaRef) {
  const letras = (celulaRef.match(/[A-Z]+/) || [''])[0];
  let indice = 0;
  for (let i = 0; i < letras.length; i += 1) {
    indice = (indice * 26) + (letras.charCodeAt(i) - 64);
  }
  return Math.max(indice - 1, 0);
}

function valorCelulaExcel(celula, sharedStrings) {
  const tipo = celula.getAttribute('t');
  if (tipo === 'inlineStr') {
    return Array.from(celula.getElementsByTagName('t')).map((node) => node.textContent || '').join('');
  }

  const valorNode = celula.getElementsByTagName('v')[0];
  if (!valorNode) return '';
  const valor = valorNode.textContent || '';

  if (tipo === 's') {
    const idx = Number(valor);
    return Number.isFinite(idx) ? sharedStrings[idx] || '' : '';
  }
  if (tipo === 'b') return valor === '1' ? 'TRUE' : 'FALSE';

  return valor;
}

function extrairLinhasPlanilha(sheetXml, sharedStrings) {
  const sheetDoc = parseXml(sheetXml);
  const rows = Array.from(sheetDoc.getElementsByTagName('row'));
  return rows.map((row) => {
    const cells = [];
    Array.from(row.getElementsByTagName('c')).forEach((celula) => {
      const ref = celula.getAttribute('r') || '';
      const colIdx = extrairIndiceColuna(ref);
      cells[colIdx] = normalizarCelulaExcel(valorCelulaExcel(celula, sharedStrings));
    });
    return cells.map((cell) => cell ?? '');
  });
}

function extrairPrimeiraPlanilhaComDados(arquivosZip) {
  const workbookXml = getZipText(arquivosZip, 'xl/workbook.xml');
  const relsXml = getZipText(arquivosZip, 'xl/_rels/workbook.xml.rels');
  if (!workbookXml || !relsXml) {
    throw new Error('Arquivo Excel inválido ou corrompido.');
  }

  const workbookDoc = parseXml(workbookXml);
  const relsDoc = parseXml(relsXml);
  const relMap = Array.from(relsDoc.getElementsByTagName('Relationship')).reduce((acc, rel) => {
    acc[rel.getAttribute('Id')] = rel.getAttribute('Target');
    return acc;
  }, {});
  const sharedStrings = extrairSharedStrings(arquivosZip);

  const sheets = Array.from(workbookDoc.getElementsByTagName('sheet'));
  for (const sheet of sheets) {
    const relId = sheet.getAttribute('r:id') || sheet.getAttribute('id');
    const target = relMap[relId];
    const caminhoPlanilha = resolverCaminho('xl/workbook.xml', target || '');
    const sheetXml = getZipText(arquivosZip, caminhoPlanilha);
    if (!sheetXml) continue;
    const linhas = extrairLinhasPlanilha(sheetXml, sharedStrings);
    if (linhas.some((linha) => !isLinhaVazia(linha))) return linhas;
  }

  throw new Error('Arquivo Excel sem aba válida com dados para análise.');
}

async function lerXlsxPrimeiraAbaUtil(file) {
  const buffer = await file.arrayBuffer();
  const arquivosZip = unzipSync(new Uint8Array(buffer));
  return extrairPrimeiraPlanilhaComDados(arquivosZip);
}

async function lerArquivoComoTabela(file) {
  const nomeArquivo = String(file?.name || '').toLowerCase();
  const isCsv = nomeArquivo.endsWith('.csv') || nomeArquivo.endsWith('.txt');
  const isXlsx = nomeArquivo.endsWith('.xlsx');
  const isXls = nomeArquivo.endsWith('.xls');

  if (isCsv) {
    const texto = await file.text();
    return parseCsv(texto);
  }

  if (isXls) {
    throw new Error('Formato .xls não suportado nesta versão. Envie o arquivo em .xlsx ou CSV.');
  }

  if (isXlsx) {
    const linhasPlanilha = await lerXlsxPrimeiraAbaUtil(file);
    return parseExcel(linhasPlanilha);
  }

  throw new Error('Formato de arquivo não suportado. Envie CSV ou Excel (.xlsx).');
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
  return cells[idx] ?? '';
}

function isDataValida(y, m, d) {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  if (y < 1000 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const data = new Date(Date.UTC(y, m - 1, d));
  return data.getUTCFullYear() === y && data.getUTCMonth() === (m - 1) && data.getUTCDate() === d;
}

function formatIso(y, m, d) {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseExcelSerial(numeroExcel) {
  if (!Number.isFinite(numeroExcel) || numeroExcel <= 0) return '';
  const serialInteiro = Math.floor(numeroExcel);
  if (serialInteiro <= 0) return '';
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const convertido = new Date(excelEpoch.getTime() + (serialInteiro * 86400000));
  if (Number.isNaN(convertido.getTime())) return '';
  return formatIso(convertido.getUTCFullYear(), convertido.getUTCMonth() + 1, convertido.getUTCDate());
}

function parseDataBrOuIso(valor) {
  if (valor === null || valor === undefined || valor === '') return '';

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return '';
    return formatIso(valor.getFullYear(), valor.getMonth() + 1, valor.getDate());
  }

  if (typeof valor === 'number') {
    return parseExcelSerial(valor);
  }

  const texto = limparTexto(valor);
  if (!texto) return '';

  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (br) {
    const dia = Number(br[1]);
    const mes = Number(br[2]);
    const ano = Number(br[3]);
    return isDataValida(ano, mes, dia) ? formatIso(ano, mes, dia) : '';
  }

  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (iso) {
    const ano = Number(iso[1]);
    const mes = Number(iso[2]);
    const dia = Number(iso[3]);
    return isDataValida(ano, mes, dia) ? formatIso(ano, mes, dia) : '';
  }

  const numeroExcel = Number(texto.replace(',', '.'));
  if (Number.isFinite(numeroExcel)) return parseExcelSerial(numeroExcel);

  const dateObj = new Date(texto);
  if (Number.isNaN(dateObj.getTime())) return '';
  return formatIso(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
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

function determinarStatusLinha({ erros, ignorado, revisoes, alertas }) {
  if (erros.length) return STATUS_LINHA.ERRO;
  if (ignorado) return STATUS_LINHA.IGNORADO;
  if (revisoes.length) return STATUS_LINHA.REVISAR;
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

function getHistoricoImportacaoEntity() {
  const entity = base44?.entities?.[HISTORICO_ENTITY_NAME];
  if (!entity?.create || !entity?.update) return null;
  return entity;
}

function assertHistoricoImportacaoEntity() {
  const entity = getHistoricoImportacaoEntity();
  if (!entity) throw new Error(HISTORICO_ENTITY_ERROR_MESSAGE);
  return entity;
}

function tokenizarMilitar(textoMilitar) {
  const normalizado = normalizarTextoComparacao(textoMilitar);
  if (!normalizado) return { posto: '', nome: '' };
  const partes = normalizado.split(' ').filter(Boolean);
  if (partes.length === 1) return { posto: '', nome: partes[0] };
  return {
    posto: partes[0],
    nome: partes.slice(1).join(' '),
  };
}

function obterVariantesPosto(posto) {
  const base = normalizarTextoComparacao(posto).replace(/\s+/g, '');
  if (!base) return new Set();
  const variantes = new Set([base]);

  Object.entries(POSTO_EQUIVALENCIAS).forEach(([abreviado, completos]) => {
    const ab = normalizarTextoComparacao(abreviado).replace(/\s+/g, '');
    const compNorm = completos.map((c) => normalizarTextoComparacao(c).replace(/\s+/g, ''));
    if (base === ab || compNorm.includes(base)) {
      variantes.add(ab);
      compNorm.forEach((c) => variantes.add(c));
    }
  });

  return variantes;
}

function resolverMilitarPorTexto(textoMilitar, militares) {
  const texto = limparTexto(textoMilitar);
  if (!texto) return { militar: null, candidatos: [] };

  const { posto, nome } = tokenizarMilitar(texto);
  const nomeNorm = normalizarTextoComparacao(nome || texto);
  const postoVariantes = obterVariantesPosto(posto);

  const candidatos = militares.filter((m) => {
    const postoMilitar = normalizarTextoComparacao(m.posto_graduacao).replace(/\s+/g, '');
    const nomeGuerra = normalizarTextoComparacao(m.nome_guerra);
    const nomeCompleto = normalizarTextoComparacao(m.nome_completo);

    const postoOk = postoVariantes.size === 0 || postoVariantes.has(postoMilitar);
    const nomeBase = nomeNorm || normalizarTextoComparacao(texto);

    const nomeGuerraOk = nomeBase && (nomeGuerra === nomeBase || nomeGuerra.includes(nomeBase) || nomeBase.includes(nomeGuerra));
    const nomeCompletoOk = nomeBase && (nomeCompleto === nomeBase || nomeCompleto.includes(nomeBase) || nomeBase.includes(nomeCompleto));

    return postoOk && (nomeGuerraOk || nomeCompletoOk);
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

function chaveDuplicidade({ militar_id, medico, tipo_afastamento, cid_10, data_inicio, data_termino }) {
  if (!militar_id || !tipo_afastamento || !data_inicio || !data_termino) return '';
  return [
    limparTexto(militar_id),
    normalizarTextoComparacao(medico),
    normalizarTextoComparacao(tipo_afastamento),
    normalizarTextoComparacao(cid_10),
    data_inicio,
    data_termino,
  ].join('|');
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
  const parsed = await lerArquivoComoTabela(file);
  if (parsed.length < 2) throw new Error('Arquivo sem dados suficientes para análise.');

  const headerMap = mapHeaders(parsed[0]);
  const militares = await listarMilitares();
  const linhas = [];

  for (let i = 1; i < parsed.length; i += 1) {
    const cells = parsed[i];
    const linhaNumero = i + 1;
    const alertas = [];
    const erros = [];
    const revisoes = [];
    const observacoes = [];
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
      if (candidatos.length === 0) revisoes.push('Militar não localizado para vínculo automático.');
      if (candidatos.length > 1) revisoes.push('Múltiplos militares possíveis para vínculo automático.');
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
    const retornoOriginal = parseDataBrOuIso(valorLinha(cells, headerMap, 'retorno'));

    if (dataInicio && dataTermino && calculado !== null && Number.isFinite(dias)) {
      if (dataInicio > dataTermino || dias !== calculado) {
        revisoes.push('Incoerência entre datas e dias do atestado.');
      }
      if (retornoOriginal && retornoOriginal !== dataRetorno) {
        revisoes.push('Incoerência entre data de retorno informada e período do atestado.');
      }
    }

    if ((numeroBg && !dataBg) || (!numeroBg && dataBg)) {
      revisoes.push('Publicação histórica incompleta: BG sem data ou data sem BG.');
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
      revisoes,
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
      suspeitaDuplicidade: false,
    };

    linha.status = determinarStatusLinha({ erros, ignorado, revisoes, alertas });
    linhas.push(linha);
  }

  const mapaDuplicidadePreview = new Map();
  linhas.forEach((linha) => {
    const chave = chaveDuplicidade(linha.transformado);
    if (!chave) return;
    const lista = mapaDuplicidadePreview.get(chave) || [];
    lista.push(linha);
    mapaDuplicidadePreview.set(chave, lista);
  });

  mapaDuplicidadePreview.forEach((duplicadas) => {
    if (duplicadas.length < 2) return;
    duplicadas.forEach((linha) => {
      linha.suspeitaDuplicidade = true;
      if (!linha.revisoes.includes('Suspeita de duplicidade dentro do arquivo de prévia.')) {
        linha.revisoes.push('Suspeita de duplicidade dentro do arquivo de prévia.');
      }
      linha.status = determinarStatusLinha({
        erros: linha.erros,
        ignorado: linha.status === STATUS_LINHA.IGNORADO,
        revisoes: linha.revisoes,
        alertas: linha.alertas,
      });
    });
  });

  for (const linha of linhas) {
    if (linha.status === STATUS_LINHA.IGNORADO || linha.status === STATUS_LINHA.ERRO) continue;
    const chave = chaveDuplicidade(linha.transformado);
    if (!chave) continue;

    // eslint-disable-next-line no-await-in-loop
    const duplicadoExistente = await existeDuplicacao({
      militar_id: linha.transformado.militar_id,
      medico: linha.transformado.medico,
      tipo_afastamento: linha.transformado.tipo_afastamento,
      cid_10: linha.transformado.cid_10,
      data_inicio: linha.transformado.data_inicio,
      data_termino: linha.transformado.data_termino,
    });

    if (duplicadoExistente) {
      linha.suspeitaDuplicidade = true;
      if (!linha.revisoes.includes('Suspeita de duplicidade com registro já existente.')) {
        linha.revisoes.push('Suspeita de duplicidade com registro já existente.');
      }
      linha.status = determinarStatusLinha({
        erros: linha.erros,
        ignorado: linha.status === STATUS_LINHA.IGNORADO,
        revisoes: linha.revisoes,
        alertas: linha.alertas,
      });
    }
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
  const historicoEntity = assertHistoricoImportacaoEntity();
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
      revisoes: analise.linhas.flatMap((l) => l.revisoes || []),
      erros: analise.linhas.flatMap((l) => l.erros),
      ajustes_manuais_militar: analise.linhas.filter((l) => l.ajusteMilitarManual).map((l) => l.linhaNumero),
      ids_criados: [],
    }),
    observacoes: 'Lote registrado apenas como análise inicial.',
    oculto_no_historico: false,
  };

  try {
    return await historicoEntity.create(payload);
  } catch (error) {
    if (String(error?.message || '').includes(`Entity schema ${HISTORICO_ENTITY_NAME} not found in app`)) {
      throw new Error(HISTORICO_ENTITY_ERROR_MESSAGE);
    }
    throw error;
  }
}

export function atualizarMilitarLinhaAnalise(analise, linhaNumero, militar) {
  const novasLinhas = analise.linhas.map((linha) => {
    if (linha.linhaNumero !== linhaNumero) return linha;

    const revisoesFiltradas = (linha.revisoes || []).filter(
      (r) => !r.includes('Militar não localizado') && !r.includes('Múltiplos militares possíveis'),
    );

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
      revisoes: revisoesFiltradas,
    };

    atualizado.status = determinarStatusLinha({
      erros: atualizado.erros,
      ignorado: linha.status === STATUS_LINHA.IGNORADO,
      revisoes: atualizado.revisoes,
      alertas: atualizado.alertas,
    });
    return atualizado;
  });

  return { ...analise, linhas: novasLinhas, resumo: montarResumo(novasLinhas) };
}

export async function importarAnaliseAtestados({ analise, incluirAlertas, historicoId, usuario }) {
  const historicoEntity = assertHistoricoImportacaoEntity();
  const agora = new Date();
  const hojeIso = agora.toISOString().slice(0, 10);

  try {
    await historicoEntity.update(historicoId, {
      status_importacao: STATUS_IMPORTACAO.IMPORTANDO,
      importar_linhas_com_alerta: incluirAlertas,
    });
  } catch (error) {
    if (String(error?.message || '').includes(`Entity schema ${HISTORICO_ENTITY_NAME} not found in app`)) {
      throw new Error(HISTORICO_ENTITY_ERROR_MESSAGE);
    }
    throw error;
  }

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
        revisoes: linha.revisoes || [],
        erros: linha.erros,
        ajuste_manual_militar: linha.ajusteMilitarManual,
        publicacao_migrada: linha.publicacaoMigrada,
        id_atestado_criado: linha.idAtestadoCriado,
      })),
      alertas: analise.linhas.flatMap((x) => x.alertas),
      revisoes: analise.linhas.flatMap((x) => x.revisoes || []),
      erros: analise.linhas.flatMap((x) => x.erros),
      ajustes_manuais_militar: analise.linhas.filter((x) => x.ajusteMilitarManual).map((x) => x.linhaNumero),
      ids_criados: idsCriados,
      importado_por: usuario?.full_name || usuario?.email || '',
      importado_em: agora.toISOString(),
      linhas_nao_importadas: naoImportadas,
    };

    await historicoEntity.update(historicoId, {
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
    try {
      await historicoEntity.update(historicoId, {
        status_importacao: STATUS_IMPORTACAO.FALHOU,
        observacoes: error?.message || 'Falha durante a importação do lote.',
      });
    } catch (updateError) {
      if (String(updateError?.message || '').includes(`Entity schema ${HISTORICO_ENTITY_NAME} not found in app`)) {
        console.warn('[ImportacaoAtestados] Não foi possível atualizar status de falha no histórico.');
      }
    }
    if (String(error?.message || '').includes(`Entity schema ${HISTORICO_ENTITY_NAME} not found in app`)) {
      throw new Error(HISTORICO_ENTITY_ERROR_MESSAGE);
    }
    throw error;
  }
}

export function exportarRelatorioMigracaoAtestados(relatorio, nomeArquivo = 'relatorio-migracao-atestados.json') {
  const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
