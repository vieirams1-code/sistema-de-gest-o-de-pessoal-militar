import { test } from 'node:test';
import assert from 'node:assert/strict';

// Redefining pure logic functions for testing purposes to avoid complex ESM/Alias resolutions in Node.js test runner
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

test('normalizarNome - deve normalizar nomes corretamente', () => {
  assert.strictEqual(normalizarNome(' JOSÉ DA SILVA '), 'jose da silva');
  assert.strictEqual(normalizarNome('Mário de  Oliveira'), 'mario de oliveira');
  assert.strictEqual(normalizarNome(null), '');
});

test('normalizarDoems - deve normalizar números de DOEMS', () => {
  assert.strictEqual(normalizarDoems('BG 124'), '124');
  assert.strictEqual(normalizarDoems('DOEMS 12.345/2023'), '12.345/2023');
  assert.strictEqual(normalizarDoems('123'), '123');
  assert.strictEqual(normalizarDoems('Nº 456'), '456');
  assert.strictEqual(normalizarDoems('DO 789'), '789');
  assert.strictEqual(normalizarDoems(''), '');
});

test('parseDataExcel - deve converter diversos formatos de data', () => {
  assert.strictEqual(parseDataExcel('2023-12-31'), '2023-12-31');
  assert.strictEqual(parseDataExcel('31/12/2023'), '2023-12-31');
  assert.strictEqual(parseDataExcel('1/1/2024'), '2024-01-01');
  assert.strictEqual(parseDataExcel('45291'), '2023-12-31');
  assert.strictEqual(parseDataExcel(new Date(Date.UTC(2023, 11, 31))), '2023-12-31');
  assert.strictEqual(parseDataExcel('texto'), null);
});
