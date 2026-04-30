import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOM_PEDRO_II_ANOS_MINIMOS_PADRAO,
  TIPOS_FIXOS_MEDALHA_TEMPO,
  apurarListaMilitaresDomPedroII,
  apurarListaMilitaresTempoServico,
  apurarMedalhaDomPedroIIMilitar,
  apurarMedalhaTempoServicoMilitar,
  calcularAnosTempoServico,
  criarIndicacaoAutomatica,
  deduplicarTiposMedalha,
  filtrarIndicacoesTempoResetaveis,
  filtrarIndicacoesDomPedroResetaveis,
  isImpedimentoAtivo,
  indicarMedalhaPorCodigo,
  normalizarStatusMedalha,
  obterEstadoCelulaTempoServico,
  obterTipoMedalhaPorCodigo,
  obterCodigoFaixaPorAnos,
  garantirCatalogoFixoMedalhaTempo,
  resolverCodigoTipoMedalha,
  resolverOuGarantirTipoMedalha,
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

test('resolução por código encontra tipo mesmo com catálogo misto', () => {
  const tipo = obterTipoMedalhaPorCodigo('TEMPO_10', [{ id: 'fixo10', codigo: 'TEMPO_10', nome: 'Medalha de Tempo de Serviço - 10 anos' }]);
  assert.equal(tipo.id, 'fixo10');
  assert.equal(resolverCodigoTipoMedalha('Medalha de Tempo de Serviço - 20 anos'), 'TEMPO_20');
});

test('apuração Dom Pedro II é separada da apuração de tempo e não exige tempo mínimo', () => {
  const apuracao = apurarMedalhaDomPedroIIMilitar({
    militar: { id: 'm20', data_inclusao: '2024-04-21', posto_graduacao: 'Capitão', comportamento: 'Insuficiente' },
    medalhas: [],
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
    anosMinimos: DOM_PEDRO_II_ANOS_MINIMOS_PADRAO,
  });

  assert.equal(apuracao.medalha_devida_codigo, 'DOM_PEDRO_II');
  assert.equal(apuracao.situacao, 'ELEGIVEL');
});

test('apuração Dom Pedro II exige comportamento Bom/Ótimo/Excepcional para praças', () => {
  const inabilitado = apurarMedalhaDomPedroIIMilitar({
    militar: { id: 'm20b', data_inclusao: '2024-04-21', posto_graduacao: 'Soldado', comportamento: 'Mau' },
    medalhas: [],
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });
  assert.equal(inabilitado.situacao, 'SEM_DIREITO');

  const elegivel = apurarMedalhaDomPedroIIMilitar({
    militar: { id: 'm20c', data_inclusao: '2024-04-21', posto_graduacao: 'Cabo', comportamento: 'Ótimo' },
    medalhas: [],
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });
  assert.equal(elegivel.situacao, 'ELEGIVEL');
});

test('apuração Dom Pedro II marca já contemplado e impedido sem misturar faixas de tempo', () => {
  const jaContemplado = apurarMedalhaDomPedroIIMilitar({
    militar: { id: 'm21', data_inclusao: '1990-04-21' },
    medalhas: [{ militar_id: 'm21', tipo_medalha_nome: 'Medalha Dom Pedro II', status: 'CONCEDIDA' }],
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });
  assert.equal(jaContemplado.situacao, 'JA_CONTEMPLADO');

  const impedido = apurarMedalhaDomPedroIIMilitar({
    militar: { id: 'm22', data_inclusao: '1990-04-21' },
    medalhas: [],
    impedimentos: [{ militar_id: 'm22', ativo: true, tipo_medalha_codigo: 'DOM_PEDRO_II' }],
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });
  assert.equal(impedido.situacao, 'IMPEDIDO');
});

test('lista Dom Pedro II retorna mesma quantidade de militares processados', () => {
  const lista = apurarListaMilitaresDomPedroII({
    militares: [
      { id: 'm23', data_inclusao: '1990-04-21', posto_graduacao: 'Capitão', comportamento: 'Insuficiente' },
      { id: 'm24', data_inclusao: '2022-04-21', posto_graduacao: 'Soldado', comportamento: 'Mau' },
    ],
    medalhas: [],
    tiposMedalha: TIPOS_FIXOS_MEDALHA_TEMPO,
    referencia: new Date('2026-04-21T00:00:00Z'),
  });
  assert.equal(lista.length, 2);
  assert.equal(lista[0].medalha_devida_codigo, 'DOM_PEDRO_II');
  assert.equal(lista[1].situacao, 'SEM_DIREITO');
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

test('estado de célula retorna INDICAR para faixa habilitada e CONTEMPLADO para concedida', () => {
  const base = { militar_id: 'm30', medalha_devida_codigo: 'TEMPO_20', situacao: 'ELEGIVEL' };
  assert.equal(obterEstadoCelulaTempoServico({ apuracao: base, codigoFaixa: 'TEMPO_20' }), 'INDICAR');
  assert.equal(obterEstadoCelulaTempoServico({
    apuracao: { ...base, situacao: 'JA_CONTEMPLADO' },
    codigoFaixa: 'TEMPO_20',
    registroMedalha: { status: 'CONCEDIDA' },
  }), 'CONTEMPLADO');
});

test('estado de célula respeita medalha indicada e impedimento ativo', () => {
  assert.equal(obterEstadoCelulaTempoServico({
    apuracao: { militar_id: 'm31', medalha_devida_codigo: 'TEMPO_20', situacao: 'ELEGIVEL' },
    codigoFaixa: 'TEMPO_20',
    registroMedalha: { status: 'INDICADA' },
  }), 'INDICADO');

  assert.equal(obterEstadoCelulaTempoServico({
    apuracao: { militar_id: 'm31', medalha_devida_codigo: 'TEMPO_20', situacao: 'ELEGIVEL' },
    codigoFaixa: 'TEMPO_20',
    impedimentos: [{ militar_id: 'm31', ativo: true, tipo_medalha_codigo: 'TEMPO_20' }],
  }), 'IMPEDIDO');
});

test('reset geral considera somente indicações de medalhas de tempo', () => {
  const resultado = filtrarIndicacoesTempoResetaveis([
    { id: '1', tipo_medalha_codigo: 'TEMPO_20', status: 'INDICADA' },
    { id: '2', tipo_medalha_codigo: 'TEMPO_20', status: 'CONCEDIDA' },
    { id: '3', tipo_medalha_codigo: 'DOM_PEDRO_II', status: 'INDICADA' },
  ]);
  assert.deepEqual(resultado.map((item) => item.id), ['1']);
});

test('reset Dom Pedro II considera apenas indicações pendentes INDICADA', () => {
  const resultado = filtrarIndicacoesDomPedroResetaveis([
    { id: '1', tipo_medalha_codigo: 'DOM_PEDRO_II', status: 'INDICADA' },
    { id: '2', tipo_medalha_codigo: 'DOM_PEDRO_II', status: 'CONCEDIDA' },
    { id: '3', tipo_medalha_codigo: 'TEMPO_30', status: 'INDICADA' },
    { id: '4', tipo_medalha_nome: 'Medalha Dom Pedro II', status: 'indicado' },
  ]);

  assert.deepEqual(resultado.map((item) => item.id), ['1', '4']);
});

test('garantirCatalogoFixoMedalhaTempo é idempotente e reconcilia tipo legado sem duplicar', async () => {
  const tiposPersistidos = [{
    id: 'legado20',
    codigo: '',
    nome: 'Medalha de Tempo de Serviço - 20 anos',
    categoria: '',
    ordem_hierarquica: null,
    anos_minimos: null,
    ativo: null,
  }];

  const base44Mock = {
    entities: {
      TipoMedalha: {
        list: async () => tiposPersistidos,
        create: async (payload) => {
          const criado = { id: `novo-${tiposPersistidos.length + 1}`, ...payload };
          tiposPersistidos.push(criado);
          return criado;
        },
        update: async (id, payload) => {
          const idx = tiposPersistidos.findIndex((item) => item.id === id);
          tiposPersistidos[idx] = { ...tiposPersistidos[idx], ...payload };
          return tiposPersistidos[idx];
        },
      },
    },
  };

  const primeira = await garantirCatalogoFixoMedalhaTempo(base44Mock);
  const segunda = await garantirCatalogoFixoMedalhaTempo(base44Mock);

  assert.equal(primeira.created, 4);
  assert.equal(primeira.updated, 1);
  assert.equal(segunda.created, 0);
  assert.equal(segunda.updated <= 1, true);
  assert.equal(tiposPersistidos.length, 5);
  assert.equal(tiposPersistidos.find((item) => item.id === 'legado20').codigo, 'TEMPO_20');
});

test('resolverOuGarantirTipoMedalha resolve código legado textual e garante criação automática', async () => {
  const tiposPersistidos = [];
  const base44Mock = {
    entities: {
      TipoMedalha: {
        list: async () => tiposPersistidos,
        create: async (payload) => {
          const criado = { id: `tipo-${payload.codigo}`, ...payload };
          tiposPersistidos.push(criado);
          return criado;
        },
        update: async (id, payload) => {
          const idx = tiposPersistidos.findIndex((item) => item.id === id);
          tiposPersistidos[idx] = { ...tiposPersistidos[idx], ...payload };
          return tiposPersistidos[idx];
        },
      },
    },
  };

  const tipo = await resolverOuGarantirTipoMedalha(base44Mock, 'Medalha de Tempo de Serviço - 10 anos', []);

  assert.equal(tipo?.codigo, 'TEMPO_10');
  assert.equal(tipo?.id, 'tipo-TEMPO_10');
  assert.equal(tiposPersistidos.some((item) => item.codigo === 'TEMPO_10'), true);
});

test('indicarMedalhaPorCodigo resolve TEMPO_10 para tipo_medalha_id e cria medalha INDICADA', async () => {
  const tiposPersistidos = [];
  const medalhasCriadas = [];
  const base44Mock = {
    entities: {
      TipoMedalha: {
        list: async () => tiposPersistidos,
        create: async (payload) => {
          const criado = { id: `tipo-${payload.codigo}`, ...payload };
          tiposPersistidos.push(criado);
          return criado;
        },
        update: async (id, payload) => ({ id, ...payload }),
      },
      Medalha: {
        create: async (payload) => {
          medalhasCriadas.push(payload);
          return { id: 'med-1', ...payload };
        },
        update: async () => {
          throw new Error('Não deveria atualizar quando não há registro existente');
        },
      },
    },
  };

  const resultado = await indicarMedalhaPorCodigo(base44Mock, {
    militar: { id: 'm40', nome_completo: 'Militar Teste', posto_graduacao: 'CB', matricula: '123' },
    codigoMedalha: 'TEMPO_10',
    tiposMedalha: [],
    dataIndicacao: '2026-04-22',
  });

  assert.equal(resultado.status, 'INDICADA');
  assert.equal(resultado.tipo_medalha_id, 'tipo-TEMPO_10');
  assert.equal(resultado.tipo_medalha_codigo, 'TEMPO_10');
  assert.equal(medalhasCriadas.length, 1);
});

test('indicarMedalhaPorCodigo aceita nome legado e atualiza registro existente com tipo_medalha_id', async () => {
  const tiposPersistidos = [{ id: 'tipo-TEMPO_20', codigo: 'TEMPO_20', nome: 'Medalha de Tempo de Serviço - 20 anos' }];
  const atualizacoes = [];
  const base44Mock = {
    entities: {
      TipoMedalha: {
        list: async () => tiposPersistidos,
        create: async () => {
          throw new Error('Não deveria criar tipo quando já existe');
        },
        update: async () => {
          throw new Error('Não deveria reconciliar catálogo nesse cenário');
        },
      },
      Medalha: {
        create: async () => {
          throw new Error('Não deveria criar nova medalha quando já existe registro');
        },
        update: async (id, payload) => {
          atualizacoes.push({ id, payload });
          return { id, ...payload };
        },
      },
    },
  };

  const resultado = await indicarMedalhaPorCodigo(base44Mock, {
    militar: { id: 'm41', nome_completo: 'Militar Teste 2' },
    codigoMedalha: 'Medalha de Tempo de Serviço - 20 anos',
    tiposMedalha: tiposPersistidos,
    registroExistente: { id: 'medalha-existente', status: 'CANCELADA' },
    dataIndicacao: '2026-04-22',
  });

  assert.equal(resultado.status, 'INDICADA');
  assert.equal(resultado.tipo_medalha_id, 'tipo-TEMPO_20');
  assert.equal(atualizacoes.length, 1);
});
