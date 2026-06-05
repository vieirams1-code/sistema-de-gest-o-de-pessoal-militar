import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obterSexoMilitar,
  obterGrupoHierarquicoMilitar,
  calcularResumoEfetivo,
  TEXTO_UNIDADE_FALLBACK,
} from '../montarArvoreLotacaoMilitares.js';

test('constants are exported correctly', () => {
  assert.equal(TEXTO_UNIDADE_FALLBACK, 'Unidade não informada');
});

test('obterSexoMilitar identifies genders correctly', () => {
  assert.equal(obterSexoMilitar({ sexo: 'M' }), 'M');
  assert.equal(obterSexoMilitar({ genero: 'FEMININO' }), 'F');
  assert.equal(obterSexoMilitar({ sexo_biologico: 'MASC' }), 'M');
  assert.equal(obterSexoMilitar({ dados_pessoais: { sexo: 'MULHER' } }), 'F');
  assert.equal(obterSexoMilitar({}), 'NI');
  assert.equal(obterSexoMilitar(null), 'NI');
  assert.equal(obterSexoMilitar({ sexo: '  feminino  ' }), 'F');
  assert.equal(obterSexoMilitar({ sexo: 'HOMEM' }), 'M');
});

test('obterGrupoHierarquicoMilitar identifies groups correctly', () => {
  assert.equal(obterGrupoHierarquicoMilitar({ posto: 'CORONEL' }), 'oficial');
  assert.equal(obterGrupoHierarquicoMilitar({ graduacao: 'SUBTENENTE' }), 'praca');
  assert.equal(obterGrupoHierarquicoMilitar({ pg: 'ST' }), 'praca');
  assert.equal(obterGrupoHierarquicoMilitar({ posto: 'SUB TEN' }), 'praca');
  assert.equal(obterGrupoHierarquicoMilitar({ posto: '2º TENENTE' }), 'oficial');
  assert.equal(obterGrupoHierarquicoMilitar({ posto: 'CAPITAO' }), 'oficial');
  assert.equal(obterGrupoHierarquicoMilitar({ posto: 'MAJOR' }), 'oficial');
  assert.equal(obterGrupoHierarquicoMilitar({ posto: 'ASPIRANTE' }), 'oficial');
  assert.equal(obterGrupoHierarquicoMilitar({ posto: '3º SGT' }), 'praca');
  assert.equal(obterGrupoHierarquicoMilitar({}), 'praca');

  // Test fallback chain
  assert.equal(obterGrupoHierarquicoMilitar({ posto_graduacao_resolvido: 'CORONEL' }), 'oficial');
  assert.equal(obterGrupoHierarquicoMilitar({ posto_graduacao: 'CORONEL' }), 'oficial');
  assert.equal(obterGrupoHierarquicoMilitar({ postoGraduacao: 'CORONEL' }), 'oficial');
});

test('calcularResumoEfetivo summarizes a list of military personnel', () => {
  const militares = [
    { posto: 'CORONEL', sexo: 'M' },        // oficial, homem
    { posto: 'MAJOR', sexo: 'F' },          // oficial, mulher
    { posto: 'SUBTENENTE', sexo: 'M' },     // praca, homem
    { posto: '1º SGT', sexo: 'F' },          // praca, mulher
    { posto: '3º SGT', sexo: 'OUTRO' },     // praca, NI
  ];

  const resumo = calcularResumoEfetivo(militares);

  assert.deepEqual(resumo, {
    oficiais: 2,
    pracas: 3,
    homens: 2,
    mulheres: 2,
    sexoNaoInformado: 1,
  });
});

test('calcularResumoEfetivo handles empty or null input', () => {
  const resumoVazio = { oficiais: 0, pracas: 0, homens: 0, mulheres: 0, sexoNaoInformado: 0 };
  assert.deepEqual(calcularResumoEfetivo([]), resumoVazio);
  assert.deepEqual(calcularResumoEfetivo(null), resumoVazio);
  assert.deepEqual(calcularResumoEfetivo(undefined), resumoVazio);
});

test('calcularResumoEfetivo handles mixed property names in list', () => {
  const militares = [
    { pg: 'CORONEL', genero: 'MASCULINO' },
    { graduacao: 'SD', sexo_biologico: 'FEM' },
  ];

  const resumo = calcularResumoEfetivo(militares);

  assert.deepEqual(resumo, {
    oficiais: 1,
    pracas: 1,
    homens: 1,
    mulheres: 1,
    sexoNaoInformado: 0,
  });
});
