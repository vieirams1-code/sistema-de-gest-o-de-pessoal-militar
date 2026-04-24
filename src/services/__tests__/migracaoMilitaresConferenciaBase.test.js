import test from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import {
  __setMigracaoMilitaresClientForTests,
  conferirBaseMilitares,
  exportarConferenciaBaseExcel,
} from '../migracaoMilitaresService.js';

function createFileLike(content, name = 'conferencia.csv') {
  return {
    name,
    type: 'text/csv',
    text: async () => content,
    arrayBuffer: async () => new TextEncoder().encode(content).buffer,
  };
}

test('conferirBaseMilitares classifica casos de CPF, matrícula, nome, divergência e inexistente', async () => {
  const Militar = {
    async list() {
      return [
        { id: '1', nome_completo: 'João da Silva', nome_guerra: 'Silva', matricula: '123.456-789', cpf: '52998224725', data_inclusao: '2020-01-10', posto_graduacao: 'Soldado' },
        { id: '2', nome_completo: 'Maria Souza', nome_guerra: 'Souza', matricula: '987.654-321', cpf: '11144477735', data_inclusao: '2019-03-20', posto_graduacao: 'Cabo' },
      ];
    },
  };
  __setMigracaoMilitaresClientForTests({ entities: { Militar } });

  const file = createFileLike([
    'nome_completo;nome_guerra;matricula;cpf;data_inclusao;posto_graduacao',
    'João da Silva;Silva;123456789;52998224725;10/01/2020;SD',
    'Maria Souza;Souza;987654321;11144477735;20/03/2019;CB',
    'Maria Souza;Souza;000000000;11144477735;20/03/2019;CB',
    'João da Silva;Silva;123456789;00000000000;10/01/2020;SD',
    'Maria Souza;Souza;;;20/03/2019;CB',
    'Fulano Teste;Fulano;555666777;39053344705;01/01/2022;SD',
  ].join('\n'));

  const resultado = await conferirBaseMilitares(file);
  assert.equal(resultado.resumo.total_linhas, 6);

  const [linhaCpfMatricula, linhaCpfMatricula2, linhaCpfDivergente, linhaNomeDivergenteCpf, linhaNomePossivel, linhaNaoEncontrado] = resultado.linhas;
  assert.equal(linhaCpfMatricula.status_conferencia, 'ENCONTRADO_MULTIPLO');
  assert.equal(linhaCpfMatricula2.status_conferencia, 'ENCONTRADO_MULTIPLO');
  assert.equal(linhaCpfDivergente.status_conferencia, 'DIVERGENTE');
  assert.match(linhaCpfDivergente.divergencias.join(' '), /matrícula diferente/);
  assert.equal(linhaNomeDivergenteCpf.status_conferencia, 'DIVERGENTE');
  assert.match(linhaNomeDivergenteCpf.divergencias.join(' '), /CPF diferente/);
  assert.equal(linhaNomePossivel.status_conferencia, 'ENCONTRADO_POR_NOME');
  assert.equal(linhaNaoEncontrado.status_conferencia, 'NAO_ENCONTRADO');
});

test('exportarConferenciaBaseExcel gera planilha com status e divergências', () => {
  let download = null;
  const blobs = [];

  globalThis.URL.createObjectURL = () => 'blob:fake';
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.document = {
    body: { appendChild: () => {}, removeChild: () => {} },
    createElement: () => ({
      click: () => {},
      set href(_) {},
      set download(value) { download = value; },
    }),
  };
  globalThis.Blob = class BlobMock {
    constructor(parts) {
      blobs.push(parts[0]);
    }
  };

  exportarConferenciaBaseExcel({
    linhas: [{
      linhaNumero: 2,
      status_conferencia: 'DIVERGENTE',
      campo_match: 'CPF',
      dados_planilha: { nome_completo: 'João da Silva', matricula: '123.456-789', cpf: '529.982.247-25' },
      militar_encontrado: { id: '1', nome_completo: 'João da Silva', matricula: '111.222-333', cpf: '529.982.247-25' },
      divergencias: ['matrícula diferente'],
      observacoes: ['Conferir manualmente'],
    }],
  }, 'conferencia-teste.xlsx');

  assert.equal(download, 'conferencia-teste.xlsx');
  assert.equal(blobs.length, 1);
  const arquivos = unzipSync(new Uint8Array(blobs[0]));
  const sheetXml = strFromU8(arquivos['xl/worksheets/sheet1.xml']);
  assert.match(sheetXml, /<t>Status Conferência<\/t>/);
  assert.match(sheetXml, /<t>DIVERGENTE<\/t>/);
  assert.match(sheetXml, /<t>matrícula diferente<\/t>/);
});
