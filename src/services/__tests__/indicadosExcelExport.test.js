import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { exportarIndicadosParaExcel } from '../../utils/indicadosExcelExport.js';

test('exportarIndicadosParaExcel gera xlsx com cabeçalhos na ordem selecionada', () => {
  let download = null;

  globalThis.URL.createObjectURL = () => 'blob:fake';
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.document = {
    body: { appendChild: () => {}, removeChild: () => {} },
    createElement: () => ({
      click: () => {},
      set href(value) { this._href = value; },
      set download(value) {
        download = value;
      },
    }),
  };

  const blobs = [];
  globalThis.Blob = class BlobMock {
    constructor(parts) {
      blobs.push(parts[0]);
    }
  };

  exportarIndicadosParaExcel({
    camposSelecionados: [
      { key: 'matricula', label: 'Matrícula', getValue: (row) => row.matricula },
      { key: 'nome', label: 'Nome', getValue: (row) => row.nome },
    ],
    registros: [{ matricula: '123', nome: 'João' }],
    nomeArquivo: 'indicados_dom_pedro_ii_2026-04-22.xlsx',
  });

  assert.equal(download, 'indicados_dom_pedro_ii_2026-04-22.xlsx');
  assert.equal(blobs.length, 1);

  const arquivos = unzipSync(new Uint8Array(blobs[0]));
  const sheetXml = strFromU8(arquivos['xl/worksheets/sheet1.xml']);

  assert.match(sheetXml, /<t>Matrícula<\/t>/);
  assert.match(sheetXml, /<t>Nome<\/t>/);
  assert.ok(sheetXml.indexOf('<t>Matrícula</t>') < sheetXml.indexOf('<t>Nome</t>'));
  assert.match(sheetXml, /<t>123<\/t>/);
  assert.match(sheetXml, /<t>João<\/t>/);
});
