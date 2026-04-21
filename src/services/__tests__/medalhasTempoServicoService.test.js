import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TIPOS_FIXOS_MEDALHA_TEMPO,
  apurarListaMilitaresTempoServico,
  apurarMedalhaTempoServicoMilitar,
  calcularAnosTempoServico,
  obterCodigoFaixaPorAnos,
} from '../medalhasTempoServicoService.js';

test('calcula faixa alcançada por tempo de serviço', () => {
  assert.equal(obterCodigoFaixaPorAnos(9), null);
  assert.equal(obterCodigoFaixaPorAnos(10), 'TEMPO_10');
  assert.equal(obterCodigoFaixaPorAnos(20), 'TEMPO_20');
  assert.equal(obterCodigoFaixaPorAnos(30), 'TEMPO_30');
  assert.equal(obterCodigoFaixaPorAnos(40), 'TEMPO_40');
});

test('militar com 20 anos e sem medalha prévia é indicado para TEMPO_20', () => {
  const militar = { id: 'm1', data_inclusao: '2006-04-21' };
  const apuracao = apurarMedalhaTempoServicoMilitar({
    militar,
    medalhas: [],
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });

  assert.equal(apuracao.tempo_servico_anos, 20);
  assert.equal(apuracao.medalha_devida_codigo, 'TEMPO_20');
  assert.equal(apuracao.situacao, 'ELEGIVEL');
});

test('militar com 30 anos já contemplado com TEMPO_30 não aparece como elegível', () => {
  const militar = { id: 'm2', data_inclusao: '1996-04-21' };
  const medalhas = [
    {
      militar_id: 'm2',
      tipo_medalha_codigo: 'TEMPO_30',
      status: 'CONCEDIDO',
    },
  ];

  const apuracao = apurarMedalhaTempoServicoMilitar({
    militar,
    medalhas,
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });

  assert.equal(apuracao.medalha_devida_codigo, 'TEMPO_30');
  assert.equal(apuracao.situacao, 'JA_CONTEMPLADO');
});

test('militar com medalha inferior e tempo maior permanece elegível para a faixa correta', () => {
  const militar = { id: 'm3', data_inclusao: '1996-04-21' };
  const medalhas = [
    {
      militar_id: 'm3',
      tipo_medalha_codigo: 'TEMPO_20',
      status: 'CONCEDIDO',
    },
  ];

  const apuracao = apurarMedalhaTempoServicoMilitar({
    militar,
    medalhas,
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });

  assert.equal(apuracao.medalha_devida_codigo, 'TEMPO_30');
  assert.equal(apuracao.maior_medalha_recebida_codigo, 'TEMPO_20');
  assert.equal(apuracao.situacao, 'ELEGIVEL');
});

test('apuração em lista retorna militares processados', () => {
  const militares = [
    { id: 'm1', data_inclusao: '2018-01-01' },
    { id: 'm2', data_inclusao: '1990-01-01' },
  ];
  const medalhas = [
    { militar_id: 'm2', tipo_medalha_codigo: 'TEMPO_20', status: 'CONCEDIDO' },
  ];

  const lista = apurarListaMilitaresTempoServico({
    militares,
    medalhas,
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });

  assert.equal(lista.length, 2);
  assert.equal(lista[0].situacao, 'SEM_DIREITO');
  assert.equal(lista[1].situacao, 'ELEGIVEL');
});

test('calcularAnosTempoServico retorna null sem data base válida', () => {
  assert.equal(calcularAnosTempoServico({ id: 'm9' }), null);
});
