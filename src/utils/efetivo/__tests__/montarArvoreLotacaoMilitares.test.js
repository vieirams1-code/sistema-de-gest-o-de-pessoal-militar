import test from 'node:test';
import assert from 'node:assert/strict';

import { obterSexoMilitar } from '../montarArvoreLotacaoMilitares.js';

test('obterSexoMilitar mapeia corretamente para Feminino (F)', () => {
  const casos = [
    { sexo: 'F' },
    { sexo: 'FEM' },
    { sexo: 'FEMININO' },
    { sexo: 'MULHER' },
    { sexo: 'feminino' },
    { sexo: '  fem  ' },
    { sexo: 'Feminino' },
    { sexo: 'FÊMININO' }, // Com acento
  ];

  for (const militar of casos) {
    assert.equal(obterSexoMilitar(militar), 'F', `Falhou para: ${JSON.stringify(militar)}`);
  }
});

test('obterSexoMilitar mapeia corretamente para Masculino (M)', () => {
  const casos = [
    { sexo: 'M' },
    { sexo: 'MASC' },
    { sexo: 'MASCULINO' },
    { sexo: 'HOMEM' },
    { sexo: 'masculino' },
    { sexo: '  masc  ' },
    { sexo: 'Masculino' },
    { sexo: 'MÁSCULINO' }, // Com acento
  ];

  for (const militar of casos) {
    assert.equal(obterSexoMilitar(militar), 'M', `Falhou para: ${JSON.stringify(militar)}`);
  }
});

test('obterSexoMilitar respeita a prioridade dos campos', () => {
  // Prioridade: sexo > genero > sexo_biologico > dados_pessoais.sexo
  assert.equal(obterSexoMilitar({ sexo: 'F', genero: 'M' }), 'F');
  assert.equal(obterSexoMilitar({ genero: 'F', sexo_biologico: 'M' }), 'F');
  assert.equal(obterSexoMilitar({ sexo_biologico: 'F', dados_pessoais: { sexo: 'M' } }), 'F');
  assert.equal(obterSexoMilitar({ dados_pessoais: { sexo: 'F' } }), 'F');
});

test('obterSexoMilitar retorna NI para valores desconhecidos ou vazios', () => {
  const casos = [
    {},
    { sexo: null },
    { sexo: undefined },
    { sexo: '' },
    { sexo: 'NÃO INFORMADO' },
    { sexo: 'OUTRO' },
    null,
    undefined,
  ];

  for (const militar of casos) {
    assert.equal(obterSexoMilitar(militar), 'NI', `Falhou para: ${JSON.stringify(militar)}`);
  }
});
