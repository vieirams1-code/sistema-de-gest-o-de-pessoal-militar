import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TIPOS_FIXOS_MEDALHA_TEMPO,
  apurarListaMilitaresTempoServico,
  apurarMedalhaTempoServicoMilitar,
  calcularAnosTempoServico,
  criarIndicacaoAutomatica,
  deduplicarTiposMedalha,
  isImpedimentoAtivo,
  normalizarStatusMedalha,
  obterCodigoFaixaPorAnos,
  temImpedimentoAplicavel,
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
      status: 'CONCEDIDA',
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
      status: 'CONCEDIDA',
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
    { militar_id: 'm2', tipo_medalha_codigo: 'TEMPO_20', status: 'CONCEDIDA' },
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


test('apuração classifica como INCONSISTENTE quando não há cálculo válido de tempo', () => {
  const apuracao = apurarMedalhaTempoServicoMilitar({
    militar: { id: 'm10', data_inclusao: '31/02/2010' },
    medalhas: [],
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });

  assert.equal(apuracao.tempo_servico_anos, null);
  assert.equal(apuracao.situacao, 'INCONSISTENTE');
});

test('militar com mais de 10 anos aparece elegível quando cabível', () => {
  const apuracao = apurarMedalhaTempoServicoMilitar({
    militar: { id: 'm11', data_inclusao: '2010-04-20' },
    medalhas: [],
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });

  assert.equal(apuracao.situacao, 'ELEGIVEL');
  assert.equal(apuracao.medalha_devida_codigo, 'TEMPO_10');
});

test('apuracao reconhece medalha legada textual e classifica como JA_CONTEMPLADO', () => {
  const apuracao = apurarMedalhaTempoServicoMilitar({
    militar: { id: 'm12', data_inclusao: '2006-04-21' },
    medalhas: [
      {
        militar_id: 'm12',
        tipo_medalha_nome: 'Medalha de Tempo de Serviço - 20 anos',
        status: 'Concedido',
      },
    ],
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });

  assert.equal(apuracao.maior_medalha_recebida_codigo, 'TEMPO_20');
  assert.equal(apuracao.medalha_devida_codigo, 'TEMPO_20');
  assert.equal(apuracao.situacao, 'JA_CONTEMPLADO');
});

test('apuracao usa mesma camada de tempo de servico com fallback de data_ingresso', () => {
  const apuracao = apurarMedalhaTempoServicoMilitar({
    militar: { id: 'm13', data_inclusao: '', data_ingresso: '2010-04-20' },
    medalhas: [],
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });

  assert.equal(apuracao.tempo_servico_anos, 16);
  assert.equal(apuracao.medalha_devida_codigo, 'TEMPO_10');
  assert.equal(apuracao.situacao, 'ELEGIVEL');
});

test('motor reconhece codigos de medalha de tempo a partir de nomes legados textuais', () => {
  const casos = [
    { nome: 'Medalha de Tempo de Serviço - 10 anos', codigoEsperado: 'TEMPO_10' },
    { nome: 'Medalha de Tempo de Serviço - 20 anos', codigoEsperado: 'TEMPO_20' },
    { nome: 'Medalha de Tempo de Serviço - 30 anos', codigoEsperado: 'TEMPO_30' },
    { nome: 'Medalha de Tempo de Serviço - 40 anos', codigoEsperado: 'TEMPO_40' },
  ];

  for (const [index, caso] of casos.entries()) {
    const apuracao = apurarMedalhaTempoServicoMilitar({
      militar: { id: `m14-${index}`, data_inclusao: '1980-04-20' },
      medalhas: [
        {
          militar_id: `m14-${index}`,
          tipo_medalha_nome: caso.nome,
          status: 'CONCEDIDO',
        },
      ],
      tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
      referencia: new Date('2026-04-21T00:00:00Z'),
    });

    assert.equal(apuracao.maior_medalha_recebida_codigo, caso.codigoEsperado);
  }
});

test('apuração aceita data de inclusão legada em formato BR', () => {
  const apuracao = apurarMedalhaTempoServicoMilitar({
    militar: { id: 'm15', data_inclusao: '20/04/2010' },
    medalhas: [],
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });

  assert.equal(apuracao.tempo_servico_anos, 16);
  assert.equal(apuracao.situacao, 'ELEGIVEL');
});

test('apuração considera medalha concedida legada por tipo_medalha_id', () => {
  const apuracao = apurarMedalhaTempoServicoMilitar({
    militar: { id: 'm16', data_inclusao: '2006-04-21' },
    medalhas: [
      {
        militar_id: 'm16',
        tipo_medalha_id: 'tipo20',
        status: 'PUBLICADA',
      },
    ],
    tiposMedalha: [...TIPOS_FIXOS_MEDALHA_TEMPO, { id: 'tipo20', codigo: 'TEMPO_20', categoria: 'TEMPO_SERVICO', ordem_hierarquica: 20 }],
    referencia: new Date('2026-04-21T00:00:00Z'),
  });

  assert.equal(apuracao.maior_medalha_recebida_codigo, 'TEMPO_20');
  assert.equal(apuracao.situacao, 'JA_CONTEMPLADO');
});

test('impedimento ativo aplicável classifica militar como IMPEDIDO', () => {
  const apuracao = apurarMedalhaTempoServicoMilitar({
    militar: { id: 'm17', data_inclusao: '2006-04-21' },
    medalhas: [],
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    impedimentos: [
      { militar_id: 'm17', ativo: true, tipo_medalha_codigo: 'TEMPO_20', data_inicio: '2026-01-01' },
    ],
    referencia: new Date('2026-04-21T00:00:00Z'),
  });

  assert.equal(apuracao.medalha_devida_codigo, 'TEMPO_20');
  assert.equal(apuracao.situacao, 'IMPEDIDO');
});

test('remoção/desativação do impedimento volta a permitir indicação', () => {
  const bloqueado = temImpedimentoAplicavel({
    militarId: 'm18',
    medalhaDevidaCodigo: 'TEMPO_20',
    referencia: new Date('2026-04-21T00:00:00Z'),
    impedimentos: [{ militar_id: 'm18', ativo: true, tipo_medalha_codigo: 'TEMPO_20' }],
  });
  const liberado = temImpedimentoAplicavel({
    militarId: 'm18',
    medalhaDevidaCodigo: 'TEMPO_20',
    referencia: new Date('2026-04-21T00:00:00Z'),
    impedimentos: [{ militar_id: 'm18', ativo: false, tipo_medalha_codigo: 'TEMPO_20' }],
  });

  assert.equal(bloqueado, true);
  assert.equal(liberado, false);
});

test('ação de indicar monta payload em status INDICADA', () => {
  const payload = criarIndicacaoAutomatica({
    militar: { id: 'm19', nome_completo: 'Fulano', posto_graduacao: 'CB', matricula: '123' },
    medalhaDevida: 'TEMPO_20',
    tipoMedalha: { id: 'tipo20', nome: 'Medalha de Tempo de Serviço - 20 anos' },
  });

  assert.equal(payload.status, 'INDICADA');
  assert.equal(payload.militar_id, 'm19');
  assert.equal(payload.tipo_medalha_id, 'tipo20');
  assert.equal(payload.tipo_medalha_codigo, 'TEMPO_20');
});

test('isImpedimentoAtivo respeita vigência', () => {
  assert.equal(isImpedimentoAtivo({ ativo: true, data_inicio: '2026-01-01', data_fim: '2026-12-31' }, new Date('2026-04-21')), true);
  assert.equal(isImpedimentoAtivo({ ativo: true, data_inicio: '2027-01-01' }, new Date('2026-04-21')), false);
});

test('deduplica tipos de medalha por código/nome técnico', () => {
  const tipos = deduplicarTiposMedalha([
    { id: '1', codigo: 'TEMPO_20', nome: 'Medalha de Tempo de Serviço - 20 anos' },
    { id: '2', codigo: 'TEMPO_20', nome: 'Medalha de Tempo de Serviço - 20 anos (duplicada)' },
    { id: '3', nome: 'Medalha Dom Pedro II' },
    { id: '4', nome: ' Medalha   Dom Pedro II ' },
  ]);

  assert.equal(tipos.length, 2);
});

test('normaliza status da medalha para fluxo indicada > concedida > cancelada', () => {
  assert.equal(normalizarStatusMedalha('INDICADO'), 'INDICADA');
  assert.equal(normalizarStatusMedalha('Concedido'), 'CONCEDIDA');
  assert.equal(normalizarStatusMedalha('PUBLICADO'), 'CONCEDIDA');
  assert.equal(normalizarStatusMedalha('Negado'), 'CANCELADA');
});
