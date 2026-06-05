import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolverNomesEstrutura,
  TEXTO_SETOR_FALLBACK,
  TEXTO_SUBSETOR_FALLBACK,
} from '../montarArvoreLotacaoMilitares.js';

test('resolverNomesEstrutura - deve resolver nomes usando lotação do índice', () => {
  const lotacoesById = new Map([
    ['1', {
      id: '1',
      setor_nome: 'SETOR TESTE',
      setor_sigla: 'ST',
      subsetor_nome: 'SUBSETOR TESTE',
      subsetor_sigla: 'SST',
      lotacao: 'UNIDADE TESTE',
      sigla: 'UT',
      descricao: 'DESC TESTE'
    }]
  ]);

  const militar = { lotacao_id: '1' };
  const resultado = resolverNomesEstrutura(militar, lotacoesById);

  assert.strictEqual(resultado.setorNome, 'SETOR TESTE');
  assert.strictEqual(resultado.setorSigla, 'ST');
  assert.strictEqual(resultado.subsetorNome, 'SUBSETOR TESTE');
  assert.strictEqual(resultado.subsetorSigla, 'SST');
  assert.strictEqual(resultado.unidadeNome, 'UNIDADE TESTE');
  assert.strictEqual(resultado.unidadeSigla, 'UT');
  assert.strictEqual(resultado.unidadeDescricao, 'DESC TESTE');
});

test('resolverNomesEstrutura - deve resolver nomes usando lotação direta no militar', () => {
  const militar = {
    lotacao_obj: {
      setor_nome: 'SETOR DIRETO',
      setor_sigla: 'SD',
      subsetor_nome: 'SUBSETOR DIRETO',
      subsetor_sigla: 'SSD',
      lotacao: 'UNIDADE DIRETA',
      sigla: 'UD',
      descricao: 'DESC DIRETA'
    }
  };

  const resultado = resolverNomesEstrutura(militar, new Map());

  assert.strictEqual(resultado.setorNome, 'SETOR DIRETO');
  assert.strictEqual(resultado.setorSigla, 'SD');
  assert.strictEqual(resultado.subsetorNome, 'SUBSETOR DIRETO');
  assert.strictEqual(resultado.subsetorSigla, 'SSD');
  assert.strictEqual(resultado.unidadeNome, 'UNIDADE DIRETA');
  assert.strictEqual(resultado.unidadeSigla, 'UD');
  assert.strictEqual(resultado.unidadeDescricao, 'DESC DIRETA');
});

test('resolverNomesEstrutura - deve usar fallbacks do militar quando não há lotação', () => {
  const militar = {
    setor_nome: 'SETOR MILITAR',
    subsetor_nome: 'SUBSETOR MILITAR',
    unidade_nome: 'UNIDADE MILITAR',
    lotacao_sigla: 'UM',
    lotacao_descricao: 'DESC MILITAR'
  };

  const resultado = resolverNomesEstrutura(militar, new Map());

  assert.strictEqual(resultado.setorNome, 'SETOR MILITAR');
  assert.strictEqual(resultado.subsetorNome, 'SUBSETOR MILITAR');
  assert.strictEqual(resultado.unidadeNome, 'UNIDADE MILITAR');
  assert.strictEqual(resultado.unidadeSigla, 'UM');
  assert.strictEqual(resultado.unidadeDescricao, 'DESC MILITAR');
});

test('resolverNomesEstrutura - deve usar fallbacks globais quando tudo está vazio', () => {
  const resultado = resolverNomesEstrutura({}, new Map());

  assert.strictEqual(resultado.setorNome, TEXTO_SETOR_FALLBACK);
  assert.strictEqual(resultado.subsetorNome, TEXTO_SUBSETOR_FALLBACK);
  assert.strictEqual(resultado.unidadeNome, ''); // TEXTO_UNIDADE_FALLBACK é 'Unidade não informada', que é filtrado por textoValido()
  assert.strictEqual(resultado.setorSigla, '');
  assert.strictEqual(resultado.subsetorSigla, '');
  assert.strictEqual(resultado.unidadeSigla, '');
  assert.strictEqual(resultado.unidadeDescricao, '');
});

test('resolverNomesEstrutura - deve lidar com militar nulo ou indefinido', () => {
  const resultado = resolverNomesEstrutura(null, new Map());

  assert.strictEqual(resultado.setorNome, TEXTO_SETOR_FALLBACK);
  assert.strictEqual(resultado.subsetorNome, TEXTO_SUBSETOR_FALLBACK);
  assert.strictEqual(resultado.unidadeNome, ''); // TEXTO_UNIDADE_FALLBACK é filtrado
});

test('resolverNomesEstrutura - deve priorizar campos de grupamento/subgrupamento', () => {
  const lotacoesById = new Map([
    ['1', {
      id: '1',
      grupamento_nome: 'GRUPAMENTO',
      grupamento_sigla: 'GP',
      subgrupamento_nome: 'SUBGRUPAMENTO',
      subgrupamento_sigla: 'SGP'
    }]
  ]);

  const militar = { lotacao_id: '1' };
  const resultado = resolverNomesEstrutura(militar, lotacoesById);

  assert.strictEqual(resultado.setorNome, 'GRUPAMENTO');
  assert.strictEqual(resultado.setorSigla, 'GP');
  assert.strictEqual(resultado.subsetorNome, 'SUBGRUPAMENTO');
  assert.strictEqual(resultado.subsetorSigla, 'SGP');
});

test('resolverNomesEstrutura - deve resolver siglas a partir de parentes (parent.parent)', () => {
  const lotacoesById = new Map([
    ['1', {
      id: '1',
      parent: {
        sigla: 'PAI_SIGLA',
        parent: {
          sigla: 'AVO_SIGLA'
        }
      }
    }]
  ]);

  const militar = { lotacao_id: '1' };
  const resultado = resolverNomesEstrutura(militar, lotacoesById);

  assert.strictEqual(resultado.setorSigla, 'AVO_SIGLA');
  assert.strictEqual(resultado.subsetorSigla, 'PAI_SIGLA');
});
