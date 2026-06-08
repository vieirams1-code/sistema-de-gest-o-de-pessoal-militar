import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obterSexoMilitar,
  obterGrupoHierarquicoMilitar,
  calcularResumoEfetivo,
  calcularResumoTags,
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

test('obterGrupoHierarquicoMilitar identifies oficial correctly by canonical posts', () => {
  const casos = ['CAP', 'MAJOR', 'CORONEL', '2º TEN', 'ASPIRANTE'];
  for (const posto of casos) {
    assert.strictEqual(obterGrupoHierarquicoMilitar({ posto }), 'oficial', `Deveria identificar ${posto} como oficial`);
  }
});

test('obterGrupoHierarquicoMilitar identifies oficial by text contained in the name', () => {
  const casos = ['TENENTE-CORONEL', 'CAPITÃO MÉDICO', 'MAJOR DENTISTA', 'ASP OFICIAL'];
  for (const posto of casos) {
    assert.strictEqual(obterGrupoHierarquicoMilitar({ posto }), 'oficial', `Deveria identificar ${posto} como oficial`);
  }
});

test('obterGrupoHierarquicoMilitar identifies praca correctly', () => {
  const casos = ['SOLDADO', 'CABO', '3º SGT', '2º SGT', '1º SGT', 'SARGENTO'];
  for (const posto of casos) {
    assert.strictEqual(obterGrupoHierarquicoMilitar({ posto }), 'praca', `Deveria identificar ${posto} como praca`);
  }
});

test('obterGrupoHierarquicoMilitar treats Subtenente as praca even if it contains "tenente"', () => {
  const casos = ['SUBTENENTE', 'ST', 'SUB TEN', 'SUB-TENENTE'];
  for (const posto of casos) {
    assert.strictEqual(obterGrupoHierarquicoMilitar({ posto }), 'praca', `Deveria identificar ${posto} como praca`);
  }
});

test('obterGrupoHierarquicoMilitar follows priority of military fields', () => {
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

test('obterGrupoHierarquicoMilitar normalizes the post text', () => {
  assert.strictEqual(obterGrupoHierarquicoMilitar({ posto: '  capitão  ' }), 'oficial');
  assert.strictEqual(obterGrupoHierarquicoMilitar({ posto: 'maj' }), 'oficial');
  assert.strictEqual(obterGrupoHierarquicoMilitar({ posto: 'Coronel' }), 'oficial');
});

test('obterGrupoHierarquicoMilitar handles null or empty input', () => {
  assert.strictEqual(obterGrupoHierarquicoMilitar(null), 'praca');
  assert.strictEqual(obterGrupoHierarquicoMilitar(undefined), 'praca');
  assert.strictEqual(obterGrupoHierarquicoMilitar({}), 'praca');
  assert.strictEqual(obterGrupoHierarquicoMilitar({ posto: '' }), 'praca');
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

test('calcularResumoEfetivo handles malformed input in list', () => {
  const militares = [
    { posto: 'CORONEL', sexo: 'M' },
    null,
    undefined,
    {},
    "militar string",
    123
  ];

  const resumo = calcularResumoEfetivo(militares);

  // null, undefined, {}, string and number should all fallback to praca and NI
  assert.deepEqual(resumo, {
    oficiais: 1,
    pracas: 5,
    homens: 1,
    mulheres: 0,
    sexoNaoInformado: 5,
  });
});

test('calcularResumoTags aggregates tags correctly', () => {
  const militares = [
    { tags_resolvidas: [{ nome: 'TAG1' }, { nome: 'TAG2' }] },
    { tags: [{ nome: 'TAG1' }, { nome: 'TAG3' }] }, // Should be normalized since tags_resolvidas is missing
    { marcadores: ['TAG2', 'TAG4'] },
    { tags: 'TAG1; TAG4' }
  ];

  const resumo = calcularResumoTags(militares);

  // TAG1: 3 (militar 1, 2, 4)
  // TAG2: 2 (militar 1, 3)
  // TAG4: 2 (militar 3, 4)
  // TAG3: 1 (militar 2)

  assert.equal(resumo.length, 4);
  assert.strictEqual(resumo[0].nome, 'TAG1');
  assert.strictEqual(resumo[0].total, 3);

  const tag2 = resumo.find(t => t.nome === 'TAG2');
  assert.strictEqual(tag2.total, 2);

  const tag4 = resumo.find(t => t.nome === 'TAG4');
  assert.strictEqual(tag4.total, 2);

  const tag3 = resumo.find(t => t.nome === 'TAG3');
  assert.strictEqual(tag3.total, 1);
});

test('calcularResumoTags handles empty or null input', () => {
  assert.deepEqual(calcularResumoTags([]), []);
  assert.deepEqual(calcularResumoTags(null), []);
});

test('calcularResumoTags sorts by total descending and then by name', () => {
  const militares = [
    { tags: ['B', 'A', 'C'] },
    { tags: ['C', 'B'] },
    { tags: ['C'] }
  ];

  const resumo = calcularResumoTags(militares);

  // C: 3 (in all 3)
  // B: 2 (in 1 and 2)
  // A: 1 (in 1)

  assert.strictEqual(resumo[0].nome, 'C');
  assert.strictEqual(resumo[1].nome, 'B');
  assert.strictEqual(resumo[2].nome, 'A');
});
