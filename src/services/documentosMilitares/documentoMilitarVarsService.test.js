import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MODULO_DOCUMENTOS_MILITARES,
  formatarDataDocumentoMilitar,
  montarVariaveisDocumentoMilitar,
} from './documentoMilitarVarsService.js';

test('expõe a categoria lógica canônica para templates de documentos militares', () => {
  assert.equal(MODULO_DOCUMENTOS_MILITARES, 'DocumentosMilitares');
});

test('monta variáveis amplas formatando datas e calculando o tempo de serviço', () => {
  const variaveis = montarVariaveisDocumentoMilitar({
    nome_completo: '  Maria da Silva  ',
    nome_guerra: ' SILVA ',
    posto_graduacao: 'Capitão',
    quadro: 'QOBM',
    matricula: '123456',
    cpf: '111.222.333-44',
    rg: '987654',
    data_nascimento: '1990-05-20',
    data_inclusao: '2010-06-01',
    lotacao: { nome: '1º GBM' },
    unidade_nome: 'CBMDF',
    situacao: 'Ativo',
    comportamento_atual: 'Ótimo',
    data_promocao_atual: '2024-01-15T12:00:00.000Z',
    endereco: { cidade: 'Brasília' },
  }, {
    dataReferencia: '2026-06-02',
  });

  assert.deepEqual(variaveis, {
    nome_completo: 'Maria da Silva',
    nome_guerra: 'SILVA',
    posto_graduacao: 'Capitão',
    quadro: 'QOBM',
    matricula: '123456',
    cpf: '111.222.333-44',
    rg: '987654',
    data_nascimento: '20/05/1990',
    data_inclusao: '01/06/2010',
    lotacao: '1º GBM',
    unidade: 'CBMDF',
    situacao: 'Ativo',
    comportamento_atual: 'Ótimo',
    data_promocao_atual: '15/01/2024',
    tempo_servico: '16 anos',
    data_atual: '02/06/2026',
    cidade: 'Brasília',
  });
});


test('resolve aliases defensivos para nascimento, unidade, situação e promoção atual', () => {
  const variaveis = montarVariaveisDocumentoMilitar({
    nascimento: '1985-03-04',
    lotacao_unidade: '2º GBM',
    situacao_funcional: 'Agregado',
    data_ultima_promocao: '2023-12-10',
  }, { dataReferencia: '2026-06-02' });

  assert.equal(variaveis.data_nascimento, '04/03/1985');
  assert.equal(variaveis.unidade, '2º GBM');
  assert.equal(variaveis.situacao, 'Agregado');
  assert.equal(variaveis.data_promocao_atual, '10/12/2023');
});

test('retorna strings vazias quando o militar ou seus dados não estão disponíveis', () => {
  assert.deepEqual(montarVariaveisDocumentoMilitar(null, { dataReferencia: null }), {
    nome_completo: '',
    nome_guerra: '',
    posto_graduacao: '',
    quadro: '',
    matricula: '',
    cpf: '',
    rg: '',
    data_nascimento: '',
    data_inclusao: '',
    lotacao: '',
    unidade: '',
    situacao: '',
    comportamento_atual: '',
    data_promocao_atual: '',
    tempo_servico: '',
    data_atual: '',
    cidade: '',
  });
});

test('formatação de data é defensiva para valores inválidos', () => {
  assert.equal(formatarDataDocumentoMilitar('data inválida'), '');
});

test('substitui data_nascimento quando o dado chega no alias camelCase', () => {
  const variaveis = montarVariaveisDocumentoMilitar({
    dataNascimento: '1991-08-09',
  }, { dataReferencia: '2026-06-02' });

  assert.equal(variaveis.data_nascimento, '09/08/1991');
});

test('substitui unidade quando o dado chega por lotação atual enriquecida', () => {
  const variaveis = montarVariaveisDocumentoMilitar({
    lotacao_atual: '3º GBM',
  }, { dataReferencia: '2026-06-02' });

  assert.equal(variaveis.unidade, '3º GBM');
});

test('substitui data_promocao_atual quando o dado chega no alias camelCase', () => {
  const variaveis = montarVariaveisDocumentoMilitar({
    dataPromocaoAtual: '2022-11-30',
  }, { dataReferencia: '2026-06-02' });

  assert.equal(variaveis.data_promocao_atual, '30/11/2022');
});

test('substitui variáveis residuais quando aliases enriquecidos existem', () => {
  const variaveis = montarVariaveisDocumentoMilitar({
    data_de_nascimento: { data: '1992-07-14' },
    unidadeAtual: { sigla: '4º GBM' },
    promocao_atual: { data: '2020-02-29' },
  }, { dataReferencia: '2026-06-02' });

  assert.equal(variaveis.data_nascimento, '14/07/1992');
  assert.equal(variaveis.unidade, '4º GBM');
  assert.equal(variaveis.data_promocao_atual, '29/02/2020');
});
