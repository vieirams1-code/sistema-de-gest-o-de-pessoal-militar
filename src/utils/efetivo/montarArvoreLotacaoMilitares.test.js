import test from 'node:test';
import assert from 'node:assert/strict';
import { obterGrupoHierarquicoMilitar } from './montarArvoreLotacaoMilitares.js';

test('obterGrupoHierarquicoMilitar identifica oficiais corretamente por postos canônicos', () => {
  const casos = ['CAP', 'MAJOR', 'CORONEL', '2º TEN', 'ASPIRANTE'];
  for (const posto of casos) {
    assert.strictEqual(obterGrupoHierarquicoMilitar({ posto }), 'oficial', `Deveria identificar ${posto} como oficial`);
  }
});

test('obterGrupoHierarquicoMilitar identifica oficiais por texto contido no nome do posto', () => {
  const casos = ['TENENTE-CORONEL', 'CAPITÃO MÉDICO', 'MAJOR DENTISTA', 'ASP OFICIAL'];
  for (const posto of casos) {
    assert.strictEqual(obterGrupoHierarquicoMilitar({ posto }), 'oficial', `Deveria identificar ${posto} como oficial`);
  }
});

test('obterGrupoHierarquicoMilitar identifica praças corretamente', () => {
  const casos = ['SOLDADO', 'CABO', '3º SGT', '2º SGT', '1º SGT', 'SARGENTO'];
  for (const posto of casos) {
    assert.strictEqual(obterGrupoHierarquicoMilitar({ posto }), 'praca', `Deveria identificar ${posto} como praca`);
  }
});

test('obterGrupoHierarquicoMilitar trata Subtenente como praça mesmo contendo "tenente"', () => {
  const casos = ['SUBTENENTE', 'ST', 'SUB TEN', 'SUB-TENENTE'];
  for (const posto of casos) {
    assert.strictEqual(obterGrupoHierarquicoMilitar({ posto }), 'praca', `Deveria identificar ${posto} como praca`);
  }
});

test('obterGrupoHierarquicoMilitar segue a prioridade dos campos do militar', () => {
  const militar = {
    pg: 'SOLDADO',
    graduacao: 'CABO',
    posto: 'SARGENTO',
    postoGraduacao: 'SUBTENENTE',
    posto_graduacao: 'TENENTE',
    posto_graduacao_resolvido: 'CAPITAO',
  };

  assert.strictEqual(obterGrupoHierarquicoMilitar(militar), 'oficial'); // CAPITAO

  delete militar.posto_graduacao_resolvido;
  assert.strictEqual(obterGrupoHierarquicoMilitar(militar), 'oficial'); // TENENTE

  delete militar.posto_graduacao;
  assert.strictEqual(obterGrupoHierarquicoMilitar(militar), 'praca'); // SUBTENENTE

  delete militar.postoGraduacao;
  assert.strictEqual(obterGrupoHierarquicoMilitar(militar), 'praca'); // SARGENTO

  delete militar.posto;
  assert.strictEqual(obterGrupoHierarquicoMilitar(militar), 'praca'); // CABO

  delete militar.graduacao;
  assert.strictEqual(obterGrupoHierarquicoMilitar(militar), 'praca'); // SOLDADO
});

test('obterGrupoHierarquicoMilitar normaliza o texto do posto', () => {
  assert.strictEqual(obterGrupoHierarquicoMilitar({ posto: '  capitão  ' }), 'oficial');
  assert.strictEqual(obterGrupoHierarquicoMilitar({ posto: 'maj' }), 'oficial');
  assert.strictEqual(obterGrupoHierarquicoMilitar({ posto: 'Coronel' }), 'oficial');
});

test('obterGrupoHierarquicoMilitar lida com entradas nulas ou vazias', () => {
  assert.strictEqual(obterGrupoHierarquicoMilitar(null), 'praca');
  assert.strictEqual(obterGrupoHierarquicoMilitar(undefined), 'praca');
  assert.strictEqual(obterGrupoHierarquicoMilitar({}), 'praca');
  assert.strictEqual(obterGrupoHierarquicoMilitar({ posto: '' }), 'praca');
});
