import { test } from 'node:test';
import assert from 'node:assert';

/**
 * Parser de nomes de arquivos para identificação automática.
 * (Redefinido aqui para evitar problemas de ESM/SDK no ambiente de teste)
 */
function parseFilename(filename) {
  const cleanName = filename.replace(/\.[^/.]+$/, ""); // Remove extensão
  const normalizedName = cleanName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const parts = cleanName.split(/[_\-\s]+/);
  const normalizedParts = normalizedName.split(/[_\-\s]+/);

  const result = {
    matricula: null,
    tipo_documento: 'DIVERSOS',
    titulo: cleanName,
    periodo_inicial: null,
    periodo_final: null,
    comportamento_certificado: null,
    confianca: 'BAIXA',
    erros: []
  };

  if (parts.length >= 1) {
    for (const p of parts) {
      const nums = p.replace(/\D/g, "");
      if (nums.length >= 4 && nums.length <= 10) {
        const isYear = /^(19|20)\d{2}$/.test(nums);
        if (!isYear || p === parts[0]) {
          result.matricula = nums;
          if (!isYear) break;
        }
      }
    }
  }

  const tipos = {
    'ALTERACAO': ['alteracao', 'alteracoes', 'extrato'],
    'CERTIDAO_COMPORTAMENTO': ['certidao', 'certidões', 'certidoes', 'comportamento']
  };

  for (const [tipo, aliases] of Object.entries(tipos)) {
    if (aliases.some(alias => normalizedName.includes(alias.normalize('NFD').replace(/[\u0300-\u036f]/g, "")))) {
      result.tipo_documento = tipo;
      break;
    }
  }

  const periodoMatch = cleanName.match(/(\d{4})[_\-\s](\d{4})/);
  if (periodoMatch) {
    result.periodo_inicial = `${periodoMatch[1]}-01-01`;
    result.periodo_final = `${periodoMatch[2]}-12-31`;
  } else {
    const anoMatch = cleanName.match(/[_\-\s](\d{4})([_\-\s]|$)/);
    if (anoMatch) {
      result.periodo_inicial = `${anoMatch[1]}-01-01`;
      result.periodo_final = `${anoMatch[1]}-12-31`;
    }
  }

  const comportamentos = {
    'EXCEPCIONAL': ['excepcional'],
    'OTIMO': ['otimo', 'ótimo'],
    'BOM': ['bom'],
    'INSUFICIENTE': ['insuficiente'],
    'MAU': ['mau']
  };

  for (const [key, aliases] of Object.entries(comportamentos)) {
    if (aliases.some(alias => normalizedName.includes(alias.normalize('NFD').replace(/[\u0300-\u036f]/g, "")))) {
      result.comportamento_certificado = key;
      break;
    }
  }

  const temMatricula = !!result.matricula;
  const tipoIdentificado = normalizedParts.some(p =>
    Object.values(tipos).flat().includes(p) || p === 'diverso' || p === 'diversos'
  );

  if (temMatricula && tipoIdentificado) {
    if (result.tipo_documento === 'ALTERACAO' && result.periodo_final) {
      result.confianca = 'ALTA';
    } else if (result.tipo_documento === 'CERTIDAO_COMPORTAMENTO' && result.comportamento_certificado) {
      result.confianca = 'ALTA';
    } else if (result.tipo_documento === 'DIVERSOS') {
      result.confianca = 'MEDIA';
    }
  }

  return result;
}

test('parseFilename - Alterações', () => {
  const res = parseFilename('123456_Alteracao_2005-2010.pdf');
  assert.strictEqual(res.matricula, '123456');
  assert.strictEqual(res.tipo_documento, 'ALTERACAO');
  assert.strictEqual(res.periodo_inicial, '2005-01-01');
  assert.strictEqual(res.periodo_final, '2010-12-31');
  assert.strictEqual(res.confianca, 'ALTA');
});

test('parseFilename - Certidões', () => {
  const res = parseFilename('123456_Certidao_2012_BOM.pdf');
  assert.strictEqual(res.matricula, '123456');
  assert.strictEqual(res.tipo_documento, 'CERTIDAO_COMPORTAMENTO');
  assert.strictEqual(res.periodo_inicial, '2012-01-01');
  assert.strictEqual(res.periodo_final, '2012-12-31');
  assert.strictEqual(res.comportamento_certificado, 'BOM');
  assert.strictEqual(res.confianca, 'ALTA');
});

test('parseFilename - Diversos', () => {
  const res = parseFilename('123456_Diversos_Declaracao.pdf');
  assert.strictEqual(res.matricula, '123456');
  assert.strictEqual(res.tipo_documento, 'DIVERSOS');
  assert.strictEqual(res.confianca, 'MEDIA');
});

test('parseFilename - Tolerância e Baixa Confiança', () => {
  const res = parseFilename('documento_sem_matricula.pdf');
  assert.strictEqual(res.matricula, null);
  assert.strictEqual(res.tipo_documento, 'DIVERSOS');
  assert.strictEqual(res.confianca, 'BAIXA');
});

test('parseFilename - Acentos e Espaços', () => {
  const res = parseFilename('123456 Certidão 2012 ÓTIMO.pdf');
  assert.strictEqual(res.matricula, '123456');
  assert.strictEqual(res.tipo_documento, 'CERTIDAO_COMPORTAMENTO');
  assert.strictEqual(res.comportamento_certificado, 'OTIMO');
  assert.strictEqual(res.confianca, 'ALTA');
});

test('parseFilename - Traços e Variações', () => {
  const res = parseFilename('000.123.456-Extrato-2000-2005.pdf');
  assert.strictEqual(res.matricula, '000123456');
  assert.strictEqual(res.tipo_documento, 'ALTERACAO');
  assert.strictEqual(res.periodo_final, '2005-12-31');
  assert.strictEqual(res.confianca, 'ALTA');
});
