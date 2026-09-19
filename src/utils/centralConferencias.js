const PREFIXOS = new Set(['CEL','TEN','TC','TENENTE','CORONEL','MAJ','MAJOR','CAP','CAPITAO','ASP','ASPIRANTE','ST','SUBTENENTE','SGT','SARGENTO','CB','CABO','SD','SOLDADO','BM','QPBM','QOBM','QAOBM']);

export function normalizarTextoConferencia(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizarNomeConferencia(value = '') {
  const tokens = normalizarTextoConferencia(value).split(' ').filter(Boolean);
  while (tokens.length && PREFIXOS.has(tokens[0])) tokens.shift();
  return tokens.join(' ');
}

export function extrairMatricula(value = '') {
  const rotulada = String(value).match(/(?:MATR[IÍ]CULA|MAT\.?)[\s:#-]*([0-9.\/-]{4,20})/i);
  return String(rotulada?.[1] || '').replace(/\D/g, '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0]; prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = old;
    }
  }
  return prev[b.length];
}

export function scoreNomes(a, b) {
  const x = normalizarNomeConferencia(a); const y = normalizarNomeConferencia(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const edit = 1 - (levenshtein(x, y) / Math.max(x.length, y.length));
  const ax = new Set(x.split(' ')); const by = new Set(y.split(' '));
  const inter = [...ax].filter((t) => by.has(t)).length;
  const token = inter / (new Set([...ax, ...by]).size || 1);
  return Number((edit * 0.55 + token * 0.45).toFixed(4));
}

export function prepararLinhasTexto(texto = '') {
  return String(texto).split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean).map((linha) => linha.replace(/^\s*\d+[\s.)-]+/, '').trim()).filter(Boolean);
}

function pareceCabecalhoNome(value = '') {
  const v = normalizarTextoConferencia(value);
  return ['NOME', 'NOME COMPLETO', 'MILITAR', 'NOME DO MILITAR', 'SERVIDOR', 'NOME SERVIDOR'].includes(v);
}

function pareceNomePessoa(value = '') {
  const raw = String(value || '').trim();
  if (!raw || raw.includes('@')) return false;
  const norm = normalizarTextoConferencia(raw);
  if (!norm || /^\d+$/.test(norm)) return false;
  if (norm.length < 5 || norm.length > 120) return false;
  if (/^(MS|MT|SP|PR|SC|RS|RJ|MG|ES|GO|DF|BA|PE|CE|PA|AM|RO|AC|RR|AP|TO|MA|PI|RN|PB|AL|SE)$/.test(norm)) return false;
  if (/^(CBMMS|SEJUSP|PMMS|PCMS|BOMBEIRO MILITAR|MILITAR ESTADUAL)$/.test(norm)) return false;
  const tokens = norm.split(' ').filter(Boolean);
  return tokens.length >= 2 && tokens.every((t) => /[A-Z]/.test(t));
}

export function extrairNomesPlanilha(rows = []) {
  const matriz = (rows || []).map((row) => Array.isArray(row) ? row : [row]);
  if (!matriz.length) return { linhas: [], colunaNome: -1, cabecalhoDetectado: false };

  const limiteCabecalho = Math.min(10, matriz.length);
  let headerRowIndex = -1;
  let colunaNome = -1;

  for (let r = 0; r < limiteCabecalho; r += 1) {
    for (let c = 0; c < matriz[r].length; c += 1) {
      if (pareceCabecalhoNome(matriz[r][c])) {
        headerRowIndex = r;
        colunaNome = c;
        break;
      }
    }
    if (colunaNome >= 0) break;
  }

  if (colunaNome < 0) {
    const maxCols = Math.max(...matriz.map((row) => row.length), 0);
    let melhorColuna = -1;
    let melhorScore = -1;
    for (let c = 0; c < maxCols; c += 1) {
      const valores = matriz.slice(0, 80).map((row) => row[c]).filter((v) => String(v || '').trim());
      if (!valores.length) continue;
      const nomes = valores.filter((v) => pareceNomePessoa(v)).length;
      const emails = valores.filter((v) => String(v || '').includes('@')).length;
      const numericos = valores.filter((v) => /^\s*\d+(?:[.,]\d+)?\s*$/.test(String(v || ''))).length;
      const score = (nomes / valores.length) - (emails / valores.length) - (numericos / valores.length);
      if (score > melhorScore && nomes >= Math.min(3, valores.length)) {
        melhorScore = score;
        melhorColuna = c;
      }
    }
    colunaNome = melhorColuna;
  }

  if (colunaNome >= 0) {
    const inicio = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    const linhas = matriz.slice(inicio)
      .map((row) => String(row[colunaNome] || '').trim())
      .filter((v) => pareceNomePessoa(v));
    return { linhas, colunaNome, cabecalhoDetectado: headerRowIndex >= 0 };
  }

  const linhasFallback = matriz
    .map((row) => row.map((v) => String(v || '').trim()).find((v) => pareceNomePessoa(v)) || '')
    .filter(Boolean);
  return { linhas: linhasFallback, colunaNome: -1, cabecalhoDetectado: false };
}

function nomesMilitar(m) { return [m?.nome_completo, m?.nome, m?.nome_guerra].filter(Boolean); }

export function cruzarListagem({ linhas = [], militares = [], limiarAutomatico = 0.94, limiarDuvidoso = 0.78 } = {}) {
  const usados = new Set();
  const itens = linhas.map((entrada_original, index) => {
    const matricula = extrairMatricula(entrada_original);
    const nomeEntrada = normalizarNomeConferencia(entrada_original);
    let candidato = null; let score = 0; let criterio = '';
    if (matricula) {
      candidato = militares.find((m) => String(m?.matricula || '').replace(/\D/g, '') === matricula) || null;
      if (candidato) { score = 1; criterio = 'MATRICULA_EXATA'; }
    }
    if (!candidato && nomeEntrada) {
      for (const militar of militares) {
        const melhorNome = Math.max(...nomesMilitar(militar).map((nome) => scoreNomes(nomeEntrada, nome)));
        if (melhorNome > score) { score = melhorNome; candidato = militar; }
      }
      criterio = score === 1 ? 'NOME_EXATO' : 'SIMILARIDADE_NOME';
    }
    let status = 'NAO_LOCALIZADO';
    if (candidato && score >= limiarAutomatico) status = 'ENCONTRADO';
    else if (candidato && score >= limiarDuvidoso) status = 'DUVIDOSO';
    else candidato = null;
    if (candidato && ['ENCONTRADO', 'DUVIDOSO'].includes(status)) usados.add(String(candidato.id));
    return { tipo_linha: 'ENTRADA', ordem: index + 1, entrada_original, nome_normalizado: nomeEntrada, matricula_informada: matricula,
      militar_id: candidato?.id ? String(candidato.id) : '', militar_nome: candidato?.nome_completo || candidato?.nome || '',
      militar_matricula: candidato?.matricula || '', militar_posto_graduacao: candidato?.posto_graduacao || '', status, score, criterio };
  });
  const ausentes = militares.filter((m) => !usados.has(String(m.id))).map((m, index) => ({
    tipo_linha: 'AUSENTE_UNIVERSO', ordem: itens.length + index + 1, entrada_original: '',
    nome_normalizado: normalizarNomeConferencia(m.nome_completo || m.nome || ''), matricula_informada: '',
    militar_id: String(m.id), militar_nome: m.nome_completo || m.nome || '', militar_matricula: m.matricula || '',
    militar_posto_graduacao: m.posto_graduacao || '', status: 'AUSENTE_NA_LISTA', score: 0, criterio: 'AUSENCIA_NO_UNIVERSO'
  }));
  return { itens: [...itens, ...ausentes], resumo: { totalEntrada: linhas.length, totalUniverso: militares.length,
    encontrados: itens.filter((i) => i.status === 'ENCONTRADO').length, duvidosos: itens.filter((i) => i.status === 'DUVIDOSO').length,
    naoLocalizados: itens.filter((i) => i.status === 'NAO_LOCALIZADO').length, ausentesUniverso: ausentes.length } };
}