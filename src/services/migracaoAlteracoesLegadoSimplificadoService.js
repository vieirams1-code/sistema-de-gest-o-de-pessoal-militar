import { base44 } from '@/api/base44Client';
import { strFromU8, unzipSync } from 'fflate';

/**
 * Lote 2 — Análise simplificada da planilha de Migração de Alterações Legado.
 *
 * Premissas:
 *  - Não tenta identificar militar pela planilha.
 *  - Todas as linhas pertencem ao `militarDestinoId` recebido como parâmetro.
 *  - Lê SOMENTE: numero_nota, numero_bg_br, data_bg_br, tipo_legado,
 *    tipo_classificado, texto_publicado.
 *  - Não cria importação. Apenas analisa e marca status.
 *  - Não usa Militar.list() global.
 *  - Não altera RLS, _security, entidades JSON nem permissões.
 *
 * Status por linha (Lote 2):
 *  - 'pronta'     — sem erros, pode ser importada nos próximos lotes.
 *  - 'erro'       — violação de validação bloqueante.
 *  - 'duplicada'  — numero_nota já existe para o mesmo militar em
 *                   PublicacaoExOfficio (chave militar_id + numero_nota)
 *                   OU repete dentro da própria planilha.
 */

export const STATUS_LINHA_SIMPLIFICADO = Object.freeze({
  PRONTA: 'pronta',
  ERRO: 'erro',
  DUPLICADA: 'duplicada',
});

const HEADER_ALIAS_SIMPLIFICADO = {
  numero_nota: [
    'numero_nota',
    'numero nota',
    'número nota',
    'número_nota',
    'nota',
    'nota id',
    'nota_id',
    'n nota',
    'n_nota',
  ],
  numero_bg_br: [
    'numero_bg_br',
    'numero bg br',
    'numero bg/br',
    'número bg/br',
    'numero bg',
    'número bg',
    'bg',
    'br',
    'bg/br',
    'bgbr',
  ],
  data_bg_br: [
    'data_bg_br',
    'data bg br',
    'data bg/br',
    'data bg',
    'data br',
    'data bg/br',
    'data publicacao',
    'data publicação',
    'data',
  ],
  tipo_legado: [
    'tipo_legado',
    'tipo legado',
    'tipo legado bg',
  ],
  tipo_classificado: [
    'tipo_classificado',
    'tipo classificado',
    'tipo classificacao',
    'tipo classificação',
    'classificacao',
    'classificação',
  ],
  texto_publicado: [
    'texto_publicado',
    'texto publicado',
    'publicacao',
    'publicação',
    'texto',
    'conteudo',
    'conteúdo',
    'conteudo publicado',
    'conteúdo publicado',
  ],
};

const CAMPOS_OBRIGATORIOS = ['numero_nota', 'texto_publicado'];

function limparTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

function normalizarChave(valor) {
  return limparTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizarNumeroNota(valor) {
  return limparTexto(valor).toUpperCase().replace(/\s+/g, '');
}

function parseDataBrParaIso(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const ano = valor.getUTCFullYear();
    const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(valor.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  const txt = limparTexto(valor);
  if (!txt) return null;
  const br = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const numeric = Number(txt);
  if (Number.isFinite(numeric) && numeric > 59) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + numeric * 86400000);
    if (!Number.isNaN(date.getTime())) {
      const ano = date.getUTCFullYear();
      const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(date.getUTCDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    }
  }
  return null;
}

function formatarIsoParaBr(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}

function parseCsv(texto) {
  const linhas = [];
  let atual = '';
  let linha = [];
  let emAspas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    const n = texto[i + 1];
    if (c === '"') {
      if (emAspas && n === '"') { atual += '"'; i += 1; } else { emAspas = !emAspas; }
      continue;
    }
    if (!emAspas && (c === ';' || c === ',' || c === '\t')) {
      linha.push(atual); atual = ''; continue;
    }
    if (!emAspas && (c === '\n' || c === '\r')) {
      if (c === '\r' && n === '\n') i += 1;
      linha.push(atual);
      if (linha.some((cell) => limparTexto(cell))) linhas.push(linha);
      linha = []; atual = ''; continue;
    }
    atual += c;
  }
  if (atual.length > 0 || linha.length > 0) {
    linha.push(atual);
    if (linha.some((cell) => limparTexto(cell))) linhas.push(linha);
  }
  return linhas;
}

function getZipText(arquivosZip, caminho) {
  const conteudo = arquivosZip[caminho];
  if (!conteudo) return null;
  return strFromU8(conteudo);
}

function parseXml(s) {
  if (typeof DOMParser === 'undefined') {
    throw new Error('Leitura de .xlsx requer DOMParser disponível no navegador. Use CSV neste runtime.');
  }
  return new DOMParser().parseFromString(s, 'application/xml');
}

function resolverCaminho(base, destino) {
  if (!destino) return null;
  if (destino.startsWith('/')) return destino.replace(/^\//, '');
  const partes = base.split('/').slice(0, -1);
  destino.split('/').forEach((p) => {
    if (!p || p === '.') return;
    if (p === '..') { partes.pop(); return; }
    partes.push(p);
  });
  return partes.join('/');
}

function extrairSharedStrings(arquivos) {
  const xml = getZipText(arquivos, 'xl/sharedStrings.xml');
  if (!xml) return [];
  const doc = parseXml(xml);
  return Array.from(doc.getElementsByTagName('si'))
    .map((si) => Array.from(si.getElementsByTagName('t')).map((t) => t.textContent || '').join(''));
}

function indiceColuna(ref) {
  const letras = (ref.match(/[A-Z]+/) || [''])[0];
  let i = 0;
  for (let k = 0; k < letras.length; k += 1) i = i * 26 + (letras.charCodeAt(k) - 64);
  return Math.max(i - 1, 0);
}

async function lerXlsxPrimeiraAba(file) {
  const buffer = await file.arrayBuffer();
  const arquivos = unzipSync(new Uint8Array(buffer));
  const shared = extrairSharedStrings(arquivos);
  const wbXml = getZipText(arquivos, 'xl/workbook.xml');
  if (!wbXml) throw new Error('Arquivo Excel inválido: workbook.xml ausente.');
  const wbDoc = parseXml(wbXml);
  const primeira = wbDoc.getElementsByTagName('sheet')[0];
  if (!primeira) throw new Error('Arquivo Excel sem abas.');
  const relsXml = getZipText(arquivos, 'xl/_rels/workbook.xml.rels');
  if (!relsXml) throw new Error('Arquivo Excel inválido: relacionamento de workbook ausente.');
  const relsDoc = parseXml(relsXml);
  const rel = Array.from(relsDoc.getElementsByTagName('Relationship'))
    .find((r) => r.getAttribute('Id') === primeira.getAttribute('r:id'));
  if (!rel) throw new Error('Não foi possível localizar a primeira aba da planilha.');
  const caminho = resolverCaminho('xl/workbook.xml', rel.getAttribute('Target'));
  const sheetXml = getZipText(arquivos, caminho);
  if (!sheetXml) throw new Error('Não foi possível ler os dados da primeira aba.');
  const sheetDoc = parseXml(sheetXml);
  const linhasMap = new Map();
  Array.from(sheetDoc.getElementsByTagName('row')).forEach((row) => {
    const r = Number(row.getAttribute('r')) || linhasMap.size + 1;
    const linha = [];
    Array.from(row.getElementsByTagName('c')).forEach((c) => {
      const ref = c.getAttribute('r') || '';
      const idx = indiceColuna(ref);
      const tipo = c.getAttribute('t');
      const vNode = c.getElementsByTagName('v')[0];
      const isNode = c.getElementsByTagName('is')[0];
      let valor = '';
      if (tipo === 'inlineStr' && isNode) {
        valor = Array.from(isNode.getElementsByTagName('t')).map((n) => n.textContent || '').join('');
      } else if (vNode) {
        const bruto = vNode.textContent || '';
        if (tipo === 's') {
          const i = Number(bruto);
          valor = Number.isFinite(i) ? (shared[i] ?? '') : '';
        } else {
          valor = bruto;
        }
      }
      linha[idx] = valor;
    });
    linhasMap.set(r, linha);
  });
  return Array.from(linhasMap.entries()).sort((a, b) => a[0] - b[0]).map(([, l]) => l);
}

async function lerArquivoComoTabela(file) {
  const nome = String(file?.name || '').toLowerCase();
  if (nome.endsWith('.csv') || nome.endsWith('.txt')) return parseCsv(await file.text());
  if (nome.endsWith('.xlsx')) {
    return (await lerXlsxPrimeiraAba(file)).filter((linha) => linha.some((cell) => limparTexto(cell)));
  }
  if (nome.endsWith('.xls')) throw new Error('Formato .xls não suportado. Envie .xlsx ou CSV.');
  throw new Error('Formato de arquivo não suportado. Envie CSV ou Excel (.xlsx).');
}

function detectarColunas(headers = []) {
  const normalizados = headers.map((h) => normalizarChave(h));
  const indexPorCampo = {};
  Object.entries(HEADER_ALIAS_SIMPLIFICADO).forEach(([campo, aliases]) => {
    const aliasNorm = aliases.map((a) => normalizarChave(a));
    const idx = normalizados.findIndex((h) => aliasNorm.includes(h));
    if (idx >= 0) indexPorCampo[campo] = idx;
  });
  return indexPorCampo;
}

/**
 * Busca todas as PublicacaoExOfficio do militar destino para verificar
 * duplicidade por militar_id + numero_nota.
 * Lote 2: usa nota_id_legado E nota_para_bg como fontes possíveis do
 * "número da nota" (mesmo número, gravado em campos distintos no histórico).
 */
async function listarNumerosNotaExistentesPorMilitar(militarId) {
  if (!militarId) return new Set();
  const publicacoes = await base44.entities.PublicacaoExOfficio.filter(
    { militar_id: militarId },
    '-created_date',
    5000,
  );
  const conjunto = new Set();
  publicacoes.forEach((p) => {
    const candidatos = [p?.nota_id_legado, p?.numero_nota, p?.nota_para_bg];
    candidatos.forEach((c) => {
      const n = normalizarNumeroNota(c);
      if (n) conjunto.add(n);
    });
  });
  return conjunto;
}

function buildSnapshotMilitar(snapshot, militarId) {
  if (!snapshot) return { id: militarId };
  return {
    id: militarId,
    nome_completo: snapshot.nome_completo || snapshot.militar_nome || '',
    posto_graduacao: snapshot.posto_graduacao || snapshot.militar_posto || '',
    matricula: snapshot.militar_matricula_atual || snapshot.matricula || snapshot.militar_matricula || '',
    lotacao: snapshot.lotacao || snapshot.estrutura_nome || '',
  };
}

function gerarResumo(linhas) {
  return linhas.reduce((acc, l) => {
    acc.total_linhas += 1;
    if (l.status === STATUS_LINHA_SIMPLIFICADO.PRONTA) acc.total_prontas += 1;
    if (l.status === STATUS_LINHA_SIMPLIFICADO.ERRO) acc.total_erros += 1;
    if (l.status === STATUS_LINHA_SIMPLIFICADO.DUPLICADA) acc.total_duplicadas += 1;
    if (l.avisos?.length) acc.total_com_avisos += 1;
    return acc;
  }, { total_linhas: 0, total_prontas: 0, total_erros: 0, total_duplicadas: 0, total_com_avisos: 0 });
}

/**
 * Função principal — Lote 2.
 *
 * @param {File} file
 * @param {object} opts
 * @param {string} opts.militarDestinoId  ID do militar destino (obrigatório).
 * @param {object} [opts.militarDestinoSnapshot]  Snapshot mínimo do militar.
 *
 * @returns {Promise<{
 *   arquivo: { nome: string, tamanho: number, tipo: string },
 *   militarDestino: { id, nome_completo, posto_graduacao, matricula, lotacao },
 *   numerosNotaJaExistentes: string[],
 *   linhas: Array<{
 *     rowIndex: number,
 *     status: 'pronta'|'erro'|'duplicada',
 *     numero_nota: string,
 *     numero_bg_br: string,
 *     data_bg_br: string,
 *     tipo_legado: string,
 *     tipo_classificado: string,
 *     texto_publicado: string,
 *     erros: string[],
 *     avisos: string[],
 *     recusada: boolean,
 *   }>,
 *   resumo: { total_linhas, total_prontas, total_erros, total_duplicadas, total_com_avisos },
 *   versao_regra: string,
 * }>}
 */
export async function analisarArquivoMigracaoAlteracoesLegadoSimplificado(file, opts = {}) {
  const { militarDestinoId, militarDestinoSnapshot } = opts;
  if (!militarDestinoId) {
    throw new Error('Militar destino não informado para a análise simplificada.');
  }
  if (!file) throw new Error('Arquivo obrigatório para análise.');

  const tabela = await lerArquivoComoTabela(file);
  if (!tabela.length) throw new Error('Arquivo sem conteúdo válido para análise.');

  const [header, ...rows] = tabela;
  const colunas = detectarColunas(header);

  const camposAusentes = CAMPOS_OBRIGATORIOS.filter((c) => colunas[c] === undefined);
  if (camposAusentes.length) {
    throw new Error(
      `Cabeçalhos obrigatórios ausentes na planilha: ${camposAusentes.join(', ')}.`,
    );
  }

  const numerosNotaJaExistentes = await listarNumerosNotaExistentesPorMilitar(militarDestinoId);

  const contagemNotaPlanilha = new Map();
  rows.forEach((row) => {
    const n = normalizarNumeroNota(row[colunas.numero_nota]);
    if (!n) return;
    contagemNotaPlanilha.set(n, (contagemNotaPlanilha.get(n) || 0) + 1);
  });

  const linhas = rows.map((row, index) => {
    const get = (campo) => limparTexto(row[colunas[campo]]);
    const numeroNotaBruto = get('numero_nota');
    const numeroNotaNorm = normalizarNumeroNota(numeroNotaBruto);
    const textoPublicado = get('texto_publicado');
    const numeroBgBr = get('numero_bg_br');
    const dataBgBrBruta = row[colunas.data_bg_br];
    const dataBgIso = parseDataBrParaIso(dataBgBrBruta);
    const dataBgBrNormalizada = dataBgIso ? formatarIsoParaBr(dataBgIso) : limparTexto(dataBgBrBruta);
    const tipoLegado = get('tipo_legado');
    const tipoClassificado = get('tipo_classificado');

    const erros = [];
    const avisos = [];

    if (!numeroNotaNorm) erros.push('Número da nota é obrigatório.');
    if (!textoPublicado) erros.push('Texto publicado é obrigatório.');

    if (!numeroBgBr) avisos.push('Número do BG/BR ausente.');
    if (dataBgBrBruta && !dataBgIso) {
      avisos.push('Data do BG/BR inválida; valor preservado, mas precisa ser revisado.');
    } else if (!dataBgBrBruta) {
      avisos.push('Data do BG/BR ausente.');
    }
    if (!tipoLegado) avisos.push('Tipo legado ausente.');
    if (!tipoClassificado) avisos.push('Tipo classificado ausente.');

    let status = STATUS_LINHA_SIMPLIFICADO.PRONTA;
    if (erros.length) {
      status = STATUS_LINHA_SIMPLIFICADO.ERRO;
    } else if (numeroNotaNorm && numerosNotaJaExistentes.has(numeroNotaNorm)) {
      status = STATUS_LINHA_SIMPLIFICADO.DUPLICADA;
      erros.push('Nota já importada anteriormente para este militar.');
    } else if (numeroNotaNorm && (contagemNotaPlanilha.get(numeroNotaNorm) || 0) > 1) {
      status = STATUS_LINHA_SIMPLIFICADO.DUPLICADA;
      erros.push('Número da nota duplicado na própria planilha.');
    }

    return {
      rowIndex: index + 2, // +2 = cabeçalho + base 1
      status,
      numero_nota: numeroNotaBruto,
      numero_bg_br: numeroBgBr,
      data_bg_br: dataBgBrNormalizada,
      tipo_legado: tipoLegado,
      tipo_classificado: tipoClassificado,
      texto_publicado: textoPublicado,
      erros,
      avisos,
      recusada: false,
    };
  });

  return {
    arquivo: {
      nome: file?.name || 'arquivo',
      tamanho: file?.size || 0,
      tipo: file?.type || 'application/octet-stream',
    },
    militarDestino: buildSnapshotMilitar(militarDestinoSnapshot, militarDestinoId),
    numerosNotaJaExistentes: Array.from(numerosNotaJaExistentes),
    linhas,
    resumo: gerarResumo(linhas),
    versao_regra: 'lote2.v1.0.0',
  };
}
