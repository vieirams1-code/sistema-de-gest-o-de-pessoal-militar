import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mock STATUS_LINHA_MEDALHA
const STATUS_LINHA_MEDALHA = Object.freeze({
  PRONTO: 'Pronto',
  MILITAR_NAO_ENCONTRADO: 'Militar não encontrado',
  DOEMS_INVALIDO: 'DOEMS inválido',
  DATA_INVALIDA: 'Data inválida',
  JA_IMPORTADO: 'Já importado',
  DUPLICADO_PLANILHA: 'Duplicado na planilha',
  ERRO: 'Erro',
  ERRO_IMPORTACAO: 'Erro na importação',
});

// Pure logic functions to test (redefined for isolated test runner)
function limparTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

function normalizarNome(valor) {
  return limparTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarDoems(valor) {
  const txt = limparTexto(valor).toUpperCase();
  if (!txt) return '';
  const match = txt.match(/(?:BG|DOEMS|DO|Nº|N)\s*([0-9./-]+)/i);
  if (match) return match[1];
  const soNumeros = txt.replace(/[^0-9./-]/g, '');
  return soNumeros || txt;
}

function ehInformacaoDP(valor) {
  const txt = normalizarNome(valor);
  return txt === 'nao localizado' || txt === 'informacao dp' || txt === '-';
}

function parseDataExcel(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const ano = valor.getUTCFullYear();
    const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(valor.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  const txt = limparTexto(valor);
  if (!txt) return null;

  const br = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const d = br[1].padStart(2, '0');
    const m = br[2].padStart(2, '0');
    return `${br[3]}-${m}-${d}`;
  }

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

function analisarLinhaImportacaoMedalha({
  nomeBruto,
  doemsBruto,
  dataBruta,
  medalhaCodigo,
  mapaMilitares,
  setMedalhasMilitarIdAtivas,
  contagemPlanilha,
}) {
  const nomeNorm = normalizarNome(nomeBruto);
  const isInformacaoDP = ehInformacaoDP(doemsBruto) || ehInformacaoDP(dataBruta);
  const doemsNorm = isInformacaoDP ? null : normalizarDoems(doemsBruto);
  const dataIso = parseDataExcel(dataBruta);

  let status = STATUS_LINHA_MEDALHA.PRONTO;
  const erros = [];
  const militaresEncontrados = mapaMilitares.get(nomeNorm) || [];

  if (!nomeNorm) {
    status = STATUS_LINHA_MEDALHA.ERRO;
    erros.push('Nome do militar ausente.');
  } else if (militaresEncontrados.length === 0) {
    status = STATUS_LINHA_MEDALHA.MILITAR_NAO_ENCONTRADO;
  } else if (militaresEncontrados.length > 1) {
    status = STATUS_LINHA_MEDALHA.ERRO;
    erros.push('Múltiplos militares encontrados com este nome.');
  }

  if (status === STATUS_LINHA_MEDALHA.PRONTO || status === STATUS_LINHA_MEDALHA.MILITAR_NAO_ENCONTRADO) {
    if (!isInformacaoDP) {
      if (!doemsNorm) {
        status = STATUS_LINHA_MEDALHA.DOEMS_INVALIDO;
      }
      if (!dataIso) {
        status = STATUS_LINHA_MEDALHA.DATA_INVALIDA;
      }
    }
  }

  const militar = militaresEncontrados[0] || null;

  // Duplicidade na planilha
  const chaveUnicaPlanilha = isInformacaoDP ? `${nomeNorm}|INFORMACAO_DP` : `${nomeNorm}|${doemsNorm}|${dataIso}`;
  if (contagemPlanilha.has(chaveUnicaPlanilha)) {
    status = STATUS_LINHA_MEDALHA.DUPLICADO_PLANILHA;
  } else {
    contagemPlanilha.set(chaveUnicaPlanilha, true);
  }

  // Já importado (na Base44)
  if (status === STATUS_LINHA_MEDALHA.PRONTO && militar && setMedalhasMilitarIdAtivas.has(String(militar.id))) {
    status = STATUS_LINHA_MEDALHA.JA_IMPORTADO;
  }

  return {
    militar_id: militar?.id || null,
    militar,
    militar_nome: militar?.nome_completo || nomeBruto,
    militar_matricula: militar?.matricula || '',
    militar_posto: militar?.posto_graduacao || '',
    doems_numero: doemsNorm,
    data_concessao: dataIso,
    status,
    erros,
    is_informacao_dp: isInformacaoDP,
    podeImportar: status === STATUS_LINHA_MEDALHA.PRONTO,
  };
}

test('analisarLinhaImportacaoMedalha - cenário básico OK', () => {
  const mapaMilitares = new Map([['joao silva', [{ id: 1, nome_completo: 'João Silva' }]]]);
  const setMedalhasMilitarIdAtivas = new Set();
  const contagemPlanilha = new Map();

  const res = analisarLinhaImportacaoMedalha({
    nomeBruto: 'João Silva',
    doemsBruto: '123',
    dataBruta: '2023-01-01',
    medalhaCodigo: 'TEMPO_10',
    mapaMilitares,
    setMedalhasMilitarIdAtivas,
    contagemPlanilha,
  });

  assert.strictEqual(res.status, STATUS_LINHA_MEDALHA.PRONTO);
  assert.strictEqual(res.podeImportar, true);
  assert.strictEqual(res.militar_id, 1);
});

test('analisarLinhaImportacaoMedalha - JA_IMPORTADO se militar já possui medalha ativa', () => {
  const mapaMilitares = new Map([['joao silva', [{ id: 1, nome_completo: 'João Silva' }]]]);
  const setMedalhasMilitarIdAtivas = new Set(['1']);
  const contagemPlanilha = new Map();

  const res = analisarLinhaImportacaoMedalha({
    nomeBruto: 'João Silva',
    doemsBruto: '123',
    dataBruta: '2023-01-01',
    medalhaCodigo: 'TEMPO_10',
    mapaMilitares,
    setMedalhasMilitarIdAtivas,
    contagemPlanilha,
  });

  assert.strictEqual(res.status, STATUS_LINHA_MEDALHA.JA_IMPORTADO);
  assert.strictEqual(res.podeImportar, false);
});

test('analisarLinhaImportacaoMedalha - DUPLICADO_PLANILHA se repetido no mesmo lote', () => {
  const mapaMilitares = new Map([['joao silva', [{ id: 1, nome_completo: 'João Silva' }]]]);
  const setMedalhasMilitarIdAtivas = new Set();
  const contagemPlanilha = new Map();

  // Primeira vez
  analisarLinhaImportacaoMedalha({
    nomeBruto: 'João Silva',
    doemsBruto: '123',
    dataBruta: '2023-01-01',
    medalhaCodigo: 'TEMPO_10',
    mapaMilitares,
    setMedalhasMilitarIdAtivas,
    contagemPlanilha,
  });

  // Segunda vez
  const res = analisarLinhaImportacaoMedalha({
    nomeBruto: 'João Silva',
    doemsBruto: '123',
    dataBruta: '2023-01-01',
    medalhaCodigo: 'TEMPO_10',
    mapaMilitares,
    setMedalhasMilitarIdAtivas,
    contagemPlanilha,
  });

  assert.strictEqual(res.status, STATUS_LINHA_MEDALHA.DUPLICADO_PLANILHA);
  assert.strictEqual(res.podeImportar, false);
});

test('analisarLinhaImportacaoMedalha - Informação DP bypassa DOEMS/Data', () => {
  const mapaMilitares = new Map([['joao silva', [{ id: 1, nome_completo: 'João Silva' }]]]);
  const setMedalhasMilitarIdAtivas = new Set();
  const contagemPlanilha = new Map();

  const res = analisarLinhaImportacaoMedalha({
    nomeBruto: 'João Silva',
    doemsBruto: 'Informação DP',
    dataBruta: '-',
    medalhaCodigo: 'TEMPO_10',
    mapaMilitares,
    setMedalhasMilitarIdAtivas,
    contagemPlanilha,
  });

  assert.strictEqual(res.status, STATUS_LINHA_MEDALHA.PRONTO);
  assert.strictEqual(res.podeImportar, true);
  assert.strictEqual(res.is_informacao_dp, true);
});

test('analisarLinhaImportacaoMedalha - Militar não encontrado', () => {
  const mapaMilitares = new Map();
  const setMedalhasMilitarIdAtivas = new Set();
  const contagemPlanilha = new Map();

  const res = analisarLinhaImportacaoMedalha({
    nomeBruto: 'Inexistente',
    doemsBruto: '123',
    dataBruta: '2023-01-01',
    medalhaCodigo: 'TEMPO_10',
    mapaMilitares,
    setMedalhasMilitarIdAtivas,
    contagemPlanilha,
  });

  assert.strictEqual(res.status, STATUS_LINHA_MEDALHA.MILITAR_NAO_ENCONTRADO);
  assert.strictEqual(res.podeImportar, false);
});
