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
