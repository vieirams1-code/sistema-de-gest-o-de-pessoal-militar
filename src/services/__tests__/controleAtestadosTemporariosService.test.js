import test from 'node:test';
import assert from 'node:assert/strict';

import {
  avaliarRiscoAtestadosMilitar,
  filtrarAnalisesTemporarios,
  filtrarPorQuadroTemporario,
  calcularDiasUnicosNaJanela,
  calcularMaiorSequenciaContinua,
  isMilitarTemporarioParaControleAtestados,
  isQuadroTemporario,
  mesclarIntervalosContiguosOuSobrepostos,
  normalizarPeriodoAtestado,
  normalizarQuadroControleAtestados,
} from '../controleAtestadosTemporariosService.js';


function criarAnalise({ id, quadro, inicio = '2026-01-01', termino = '2026-01-05', lacunas = [] }) {
  const analise = avaliarRiscoAtestadosMilitar({
    militar: { id, nome: id, quadro },
    atestados: [{ data_inicio: inicio, data_termino: termino }],
    dataReferencia: '2026-12-31',
  });

  return { chave: id, ...analise, lacunas: [...analise.lacunas, ...lacunas] };
}


test('painel/serviço retorna somente temporários e preserva lacunas', () => {
  const analises = [
    criarAnalise({ id: 'qoe', quadro: 'QOETBM', lacunas: ['lacuna preservada'] }),
    criarAnalise({ id: 'efetivo', quadro: 'QOBM' }),
    criarAnalise({ id: 'sem-quadro', quadro: '' }),
  ];

  const resultado = filtrarAnalisesTemporarios(analises);

  assert.deepEqual(resultado.map((analise) => analise.chave), ['qoe']);
  assert.deepEqual(resultado[0].lacunas, ['lacuna preservada']);
});

test('filtro temporário inclui QOETBM, QOSTBM, QPTBM e QBMPT normalizado, excluindo não temporário', () => {
  const analises = [
    criarAnalise({ id: 'qoe', quadro: 'QOETBM' }),
    criarAnalise({ id: 'qos', quadro: 'QOSTBM' }),
    criarAnalise({ id: 'qpt', quadro: 'QPTBM' }),
    criarAnalise({ id: 'legado', quadro: 'QBMPT' }),
    criarAnalise({ id: 'efetivo', quadro: 'QOBM' }),
  ];

  const resultado = filtrarAnalisesTemporarios(analises);

  assert.deepEqual(resultado.map((analise) => analise.chave), ['qoe', 'qos', 'qpt', 'legado']);
  assert.deepEqual(resultado.map((analise) => analise.militar.quadro), ['QOETBM', 'QOSTBM', 'QPTBM', 'QPTBM']);
});

test('filtro por QOETBM retorna apenas QOETBM', () => {
  const analises = [
    criarAnalise({ id: 'qoe', quadro: 'QOETBM' }),
    criarAnalise({ id: 'qos', quadro: 'QOSTBM' }),
    criarAnalise({ id: 'qpt', quadro: 'QPTBM' }),
  ];

  assert.deepEqual(filtrarPorQuadroTemporario(analises, 'QOETBM').map((analise) => analise.militar.quadro), ['QOETBM']);
});

test('filtro por QOSTBM retorna apenas QOSTBM', () => {
  const analises = [
    criarAnalise({ id: 'qoe', quadro: 'QOETBM' }),
    criarAnalise({ id: 'qos', quadro: 'QOSTBM' }),
    criarAnalise({ id: 'qpt', quadro: 'QPTBM' }),
  ];

  assert.deepEqual(filtrarPorQuadroTemporario(analises, 'QOSTBM').map((analise) => analise.militar.quadro), ['QOSTBM']);
});

test('filtro por QPTBM inclui QBMPT legado normalizado', () => {
  const analises = [
    criarAnalise({ id: 'qoe', quadro: 'QOETBM' }),
    criarAnalise({ id: 'qpt', quadro: 'QPTBM' }),
    criarAnalise({ id: 'legado', quadro: 'QBMPT' }),
  ];

  assert.deepEqual(filtrarPorQuadroTemporario(analises, 'QPTBM').map((analise) => analise.chave), ['qpt', 'legado']);
  assert.deepEqual(filtrarPorQuadroTemporario(analises, 'QBMPT').map((analise) => analise.chave), ['qpt', 'legado']);
});
test('QOETBM é temporário para o controle de atestados', () => {
  assert.equal(isQuadroTemporario('QOETBM'), true);
  assert.equal(isMilitarTemporarioParaControleAtestados({ quadro: 'QOETBM' }), true);
});

test('QOSTBM é temporário para o controle de atestados', () => {
  assert.equal(isQuadroTemporario('QOSTBM'), true);
  assert.equal(isMilitarTemporarioParaControleAtestados({ quadro: 'QOSTBM' }), true);
});

test('QPTBM é temporário para o controle de atestados', () => {
  assert.equal(isQuadroTemporario('QPTBM'), true);
  assert.equal(isMilitarTemporarioParaControleAtestados({ quadro: 'QPTBM' }), true);
});

test('QBMPT legado normaliza para QPTBM e é temporário', () => {
  assert.equal(normalizarQuadroControleAtestados('qbmpt'), 'QPTBM');
  assert.equal(isQuadroTemporario('QBMPT'), true);
});

test('quadro comum não recebe alerta legal de temporário', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    militar: { nome: 'Militar Efetivo', quadro: 'QOBM' },
    atestados: [{ data_inicio: '2026-01-01', data_termino: '2026-01-30' }],
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.temporarioClassificacao, 'nao');
  assert.equal(resultado.ehTemporario, false);
  assert.equal(resultado.alertaLegalTemporario, false);
  assert.equal(resultado.statusRisco, 'normal');
});

test('militar não temporário com 60 dias aparece com estatística, mas sem alerta legal de temporário', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    militar: { nome: 'Militar Efetivo', quadro: 'QPBM' },
    atestados: [
      { data_inicio: '2026-01-01', data_termino: '2026-01-20' },
      { data_inicio: '2026-03-01', data_termino: '2026-03-20' },
      { data_inicio: '2026-05-01', data_termino: '2026-05-20' },
    ],
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.diasJanela365, 60);
  assert.equal(resultado.temporarioClassificacao, 'nao');
  assert.equal(resultado.alertaLegalTemporario, false);
  assert.equal(resultado.statusRisco, 'normal');
});

test('militar temporário com 30 dias contínuos recebe crítico contínuo', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    militar: { nome: 'Militar Temporário', quadro: 'QOETBM' },
    atestados: [{ data_inicio: '2026-01-01', data_termino: '2026-01-30' }],
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.maiorSequenciaContinua, 30);
  assert.equal(resultado.ehTemporario, true);
  assert.equal(resultado.alertaLegalTemporario, true);
  assert.equal(resultado.statusRisco, 'critico_continuo');
});

test('militar temporário com 60 dias intercalados recebe crítico intercalado', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    militar: { nome: 'Militar Temporário', quadro: 'QOSTBM' },
    atestados: [
      { data_inicio: '2026-01-01', data_termino: '2026-01-20' },
      { data_inicio: '2026-03-01', data_termino: '2026-03-20' },
      { data_inicio: '2026-05-01', data_termino: '2026-05-20' },
    ],
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.maiorSequenciaContinua, 20);
  assert.equal(resultado.diasJanela365, 60);
  assert.equal(resultado.ehTemporario, true);
  assert.equal(resultado.alertaLegalTemporario, true);
  assert.equal(resultado.statusRisco, 'critico_intercalado');
});

test('quadro desconhecido gera temporário não classificado', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    militar: { nome: 'Militar quadro desconhecido', quadro: 'XYZ' },
    atestados: [{ data_inicio: '2026-06-01', dias: 5 }],
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.militar.quadro, 'XYZ');
  assert.equal(resultado.temporarioClassificacao, 'nao_classificado');
  assert.equal(resultado.ehTemporario, false);
  assert.equal(resultado.alertaLegalTemporario, false);
});

test('quadro ausente gera temporário não classificado', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    militar: { nome: 'Militar sem quadro' },
    atestados: [{ data_inicio: '2026-06-01', dias: 5 }],
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.militar.quadro, '-');
  assert.equal(resultado.temporarioClassificacao, 'nao_classificado');
  assert.equal(resultado.ehTemporario, false);
  assert.equal(resultado.alertaLegalTemporario, false);
});

test('enriquece dados do militar por militar_id usando militar escopado', () => {
  const militaresPorId = new Map([
    ['militar-1', {
      id: 'militar-1',
      nome: 'Militar Escopado',
      posto_graduacao: '2º Ten BM',
      quadro: 'QOETBM',
      matricula: '123456',
      lotacao: '1º BBM',
      estrutura: 'Comando Operacional',
    }],
  ]);

  const resultado = avaliarRiscoAtestadosMilitar({
    atestados: [{
      militar_id: 'militar-1',
      militar_nome: 'Nome do Atestado',
      militar_posto: 'Sd BM',
      militar_quadro: 'QOBM',
      militar_matricula: '999999',
      militar_lotacao: 'Lotação do Atestado',
      data_inicio: '2026-01-01',
      data_termino: '2026-01-05',
    }],
    militaresPorId,
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.militar.nome, 'Militar Escopado');
  assert.equal(resultado.militar.postoGraduacao, '2º Ten BM');
  assert.equal(resultado.militar.quadro, 'QOETBM');
  assert.equal(resultado.militar.matricula, '123456');
  assert.equal(resultado.militar.lotacao, '1º BBM');
  assert.equal(resultado.militar.estrutura, 'Comando Operacional');
  assert.equal(resultado.militar.dadosEscopadosEncontrados, true);
});

test('mantém fallback para dados do atestado quando militar escopado não existe', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    atestados: [{
      militar_id: 'militar-fora-do-mapa',
      militar_nome: 'Militar do Atestado',
      militar_posto: 'Cb BM',
      militar_quadro: 'QPTBM',
      militar_matricula: '654321',
      militar_lotacao: '2º BBM',
      data_inicio: '2026-01-01',
      data_termino: '2026-01-05',
    }],
    militaresPorId: new Map(),
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.militar.nome, 'Militar do Atestado');
  assert.equal(resultado.militar.postoGraduacao, 'Cb BM');
  assert.equal(resultado.militar.quadro, 'QPTBM');
  assert.equal(resultado.militar.matricula, '654321');
  assert.equal(resultado.militar.lotacao, '2º BBM');
  assert.equal(resultado.militar.dadosEscopadosEncontrados, false);
});

test('resolve aliases escopados de nome, posto, quadro, matrícula, lotação e estrutura', () => {
  const casos = [
    { campo: 'nome_completo', valor: 'Nome Completo Escopado', esperado: { nome: 'Nome Completo Escopado' } },
    { campo: 'nome_guerra', valor: 'Nome Guerra Escopado', esperado: { nome: 'Nome Guerra Escopado' } },
    { campo: 'posto_grad', valor: 'Sgt BM', esperado: { postoGraduacao: 'Sgt BM' } },
    { campo: 'pg', valor: 'Sd BM', esperado: { postoGraduacao: 'Sd BM' } },
    { campo: 'matricula_funcional', valor: 'MF-123', esperado: { matricula: 'MF-123' } },
    { campo: 'estrutura_nome', valor: 'Diretoria de Saúde', esperado: { lotacao: 'Diretoria de Saúde', estrutura: 'Diretoria de Saúde' } },
    { campo: 'subgrupamento_nome', valor: '1º SGBM', esperado: { lotacao: '1º SGBM' } },
    { campo: 'grupamento_nome', valor: '1º GBM', esperado: { lotacao: '1º GBM' } },
    { campo: 'unidade_nome', valor: 'Unidade Médica', esperado: { lotacao: 'Unidade Médica' } },
    { campo: 'quadro_atual', valor: 'QOBM', esperado: { quadro: 'QOBM' } },
  ];

  for (const { campo, valor, esperado } of casos) {
    const resultado = avaliarRiscoAtestadosMilitar({
      atestados: [{
        militar_id: `militar-${campo}`,
        militar_nome: 'Nome do Atestado',
        militar_quadro: 'QPBM',
        data_inicio: '2026-01-01',
        data_termino: '2026-01-05',
      }],
      militaresPorId: new Map([[`militar-${campo}`, { id: `militar-${campo}`, [campo]: valor }]]),
      dataReferencia: '2026-12-31',
    });

    for (const [chave, valorEsperado] of Object.entries(esperado)) {
      assert.equal(resultado.militar[chave], valorEsperado, `alias ${campo} deve preencher ${chave}`);
    }
    assert.deepEqual(resultado.lacunas, []);
  }
});

test('QBMPT vindo de alias quadro_atual normaliza para QPTBM e mantém alerta 30/60 de temporário', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    atestados: [{
      militar_id: 'militar-qbmpt-alias',
      data_inicio: '2026-01-01',
      data_termino: '2026-01-30',
    }],
    militaresPorId: new Map([[
      'militar-qbmpt-alias',
      { id: 'militar-qbmpt-alias', nome_completo: 'Temporário Alias', quadro_atual: 'QBMPT' },
    ]]),
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.militar.quadro, 'QPTBM');
  assert.equal(resultado.temporarioClassificacao, 'sim');
  assert.equal(resultado.ehTemporario, true);
  assert.equal(resultado.alertaLegalTemporario, true);
  assert.equal(resultado.statusRisco, 'critico_continuo');
});

test('não temporário enriquecido apenas por aliases permanece sem alerta legal', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    atestados: [{
      militar_id: 'militar-nao-temporario-alias',
      militar_quadro: 'QOETBM',
      data_inicio: '2026-02-01',
      data_termino: '2026-03-02',
    }],
    militaresPorId: new Map([[
      'militar-nao-temporario-alias',
      {
        id: 'militar-nao-temporario-alias',
        nome_completo: 'Militar Efetivo Alias',
        posto_grad: 'Maj BM',
        quadro_atual: 'QOBM',
        matricula_funcional: 'MF-999',
        unidade_nome: 'Unidade Efetiva',
      },
    ]]),
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.militar.nome, 'Militar Efetivo Alias');
  assert.equal(resultado.militar.postoGraduacao, 'Maj BM');
  assert.equal(resultado.militar.quadro, 'QOBM');
  assert.equal(resultado.militar.matricula, 'MF-999');
  assert.equal(resultado.militar.lotacao, 'Unidade Efetiva');
  assert.equal(resultado.temporarioClassificacao, 'nao');
  assert.equal(resultado.ehTemporario, false);
  assert.equal(resultado.alertaLegalTemporario, false);
  assert.equal(resultado.statusRisco, 'normal');
});

test('ausência de aliases opcionais no militar escopado não gera lacuna indevida', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    atestados: [{
      militar_id: 'militar-minimo',
      data_inicio: '2026-07-01',
      data_termino: '2026-07-03',
    }],
    militaresPorId: new Map([['militar-minimo', { id: 'militar-minimo', quadro: 'QPBM' }]]),
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.militar.nome, '-');
  assert.equal(resultado.militar.postoGraduacao, '-');
  assert.equal(resultado.militar.matricula, '-');
  assert.equal(resultado.militar.lotacao, '-');
  assert.deepEqual(resultado.lacunas, []);
});

test('quadro vindo do militar escopado classifica temporário corretamente', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    atestados: [{
      militar_id: 'militar-2',
      militar_nome: 'Militar Temporário',
      militar_quadro: 'QOBM',
      data_inicio: '2026-02-01',
      data_termino: '2026-02-10',
    }],
    militaresPorId: new Map([['militar-2', { id: 'militar-2', nome: 'Militar Temporário Escopado', quadro: 'QOSTBM' }]]),
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.militar.quadro, 'QOSTBM');
  assert.equal(resultado.temporarioClassificacao, 'sim');
  assert.equal(resultado.ehTemporario, true);
});

test('quadro ausente no atestado mas presente no militar escopado permite alerta 30/60', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    atestados: [{
      militar_id: 'militar-3',
      militar_nome: 'Militar sem quadro no atestado',
      data_inicio: '2026-03-01',
      data_termino: '2026-03-30',
    }],
    militaresEscopados: [{ id: 'militar-3', nome: 'Militar Enriquecido', quadro: 'QOETBM' }],
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.militar.quadro, 'QOETBM');
  assert.equal(resultado.temporarioClassificacao, 'sim');
  assert.equal(resultado.alertaLegalTemporario, true);
  assert.equal(resultado.statusRisco, 'critico_continuo');
});

test('militar_id sem correspondência no mapa não quebra cálculo e gera lacuna discreta', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    atestados: [{
      militar_id: 'militar-nao-carregado',
      militar_nome: 'Militar com fallback',
      militar_quadro: 'QPTBM',
      data_inicio: '2026-04-01',
      data_termino: '2026-04-05',
    }],
    militaresPorId: new Map([['outro-id', { id: 'outro-id', nome: 'Outro Militar', quadro: 'QOETBM' }]]),
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.quantidadeAtestadosConsiderados, 1);
  assert.equal(resultado.militar.nome, 'Militar com fallback');
  assert.match(resultado.lacunas.join(' '), /Dados completos do militar não encontrados no escopo carregado/);
});

test('não temporário enriquecido continua sem alerta legal', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    atestados: [{
      militar_id: 'militar-4',
      militar_nome: 'Militar com atestado temporário legado',
      militar_quadro: 'QOETBM',
      data_inicio: '2026-05-01',
      data_termino: '2026-05-30',
    }],
    militaresPorId: new Map([['militar-4', { id: 'militar-4', nome: 'Militar Efetivo Escopado', quadro: 'QOBM' }]]),
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.militar.quadro, 'QOBM');
  assert.equal(resultado.temporarioClassificacao, 'nao');
  assert.equal(resultado.ehTemporario, false);
  assert.equal(resultado.alertaLegalTemporario, false);
  assert.equal(resultado.statusRisco, 'normal');
});

test('atestados sobrepostos não duplicam dias', () => {
  const intervalos = [
    normalizarPeriodoAtestado({ data_inicio: '2026-01-01', data_termino: '2026-01-10' }),
    normalizarPeriodoAtestado({ data_inicio: '2026-01-05', data_termino: '2026-01-15' }),
  ];

  assert.equal(calcularDiasUnicosNaJanela(intervalos, '2026-12-31'), 15);
});

test('atestados contíguos viram uma sequência contínua', () => {
  const intervalos = [
    normalizarPeriodoAtestado({ data_inicio: '2026-02-01', data_termino: '2026-02-10' }),
    normalizarPeriodoAtestado({ data_inicio: '2026-02-11', data_termino: '2026-02-20' }),
  ];

  const mesclados = mesclarIntervalosContiguosOuSobrepostos(intervalos);
  assert.equal(mesclados.length, 1);
  assert.equal(calcularMaiorSequenciaContinua(intervalos), 20);
});

test('intervalos separados contam como intercalados', () => {
  const intervalos = [
    normalizarPeriodoAtestado({ data_inicio: '2026-03-01', data_termino: '2026-03-10' }),
    normalizarPeriodoAtestado({ data_inicio: '2026-04-01', data_termino: '2026-04-10' }),
  ];

  assert.equal(calcularMaiorSequenciaContinua(intervalos), 10);
  assert.equal(calcularDiasUnicosNaJanela(intervalos, '2026-12-31'), 20);
});

test('data de término ausente usa fallback por quantidade de dias', () => {
  const resultado = normalizarPeriodoAtestado({ data_inicio: '2026-06-01', dias: 5 });

  assert.equal(resultado.valido, true);
  assert.equal(resultado.dias, 5);
  assert.equal(resultado.fim.toISOString().slice(0, 10), '2026-06-05');
});

test('registros sem data válida geram lacuna e não quebram a tela', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    militar: { quadro: 'QOETBM' },
    atestados: [{ data_inicio: 'data inválida', dias: 10, militar_nome: 'Militar C' }],
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.quantidadeAtestadosConsiderados, 0);
  assert.equal(resultado.statusRisco, 'nao_classificado');
  assert.match(resultado.lacunas.join(' '), /data inicial válida/);
});

test('não há mais tratamento, lacuna ou classificação de relação com serviço no serviço puro', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    militar: { quadro: 'QOETBM' },
    atestados: [{ data_inicio: '2026-06-01', dias: 5 }],
    dataReferencia: '2026-12-31',
  });

  assert.equal('relacaoServico' in resultado, false);
  assert.doesNotMatch(JSON.stringify(resultado), /relação com o serviço|relacaoServico|relacao_servico/i);
});
