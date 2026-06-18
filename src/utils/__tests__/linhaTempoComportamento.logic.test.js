import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarLinhaTempoComportamento } from '../linhaTempoComportamento.js';

const HOJE = new Date('2024-05-20T12:00:00Z');

test('Caso 1: Militar sem punição (Bom -> Ótimo -> Excepcional)', () => {
  const dataInclusao = '2015-01-01';
  const resultado = gerarLinhaTempoComportamento({
    punicoes: [],
    postoGraduacao: 'Soldado',
    dataInclusaoMilitar: dataInclusao,
    hoje: HOJE
  });

  assert.strictEqual(resultado.comportamentoCalculadoHoje, 'Excepcional');

  // Segmentos esperados:
  // 2015-01-01 a 2019-01-01: Bom
  // 2019-01-02 a 2023-01-01: Ótimo (Inclusão + 4 anos + 1 dia)
  // 2023-01-02 a HOJE: Excepcional (Inclusão + 8 anos + 1 dia)

  const compSegmentos = resultado.segmentos.map(s => s.comportamento);
  assert.deepStrictEqual(compSegmentos, ['Bom', 'Ótimo', 'Excepcional']);

  assert.strictEqual(resultado.segmentos[0].inicio, '2015-01-01');
  assert.strictEqual(resultado.segmentos[1].inicio, '2019-01-02'); // Inclusão + 4 anos + 1 dia
  assert.strictEqual(resultado.segmentos[2].inicio, '2023-01-02'); // Inclusão + 8 anos + 1 dia
});

test('Caso 2: Militar com uma repreensão há 7 anos e 11 meses', () => {
  // HOJE: 2024-05-20
  // 7 anos e 11 meses atrás: 2016-06-20
  const dataPunicao = '2016-06-20';
  const punicoes = [{ tipo: 'REPREENSAO', data_punicao: dataPunicao, status: 'Ativa' }];

  const resultado = gerarLinhaTempoComportamento({
    punicoes,
    postoGraduacao: 'Soldado',
    dataInclusaoMilitar: '2010-01-01',
    hoje: HOJE
  });

  assert.strictEqual(resultado.comportamentoCalculadoHoje, 'Ótimo');
  assert.strictEqual(resultado.proximaMelhoria.comportamento_futuro, 'Excepcional');
  assert.strictEqual(resultado.proximaMelhoria.data, '2024-06-21'); // dataPunicao + 8 anos + 1 dia
});

test('Caso 3: Militar com repreensão recente (pode permanecer Ótimo)', () => {
  const dataPunicao = '2024-01-01';
  const punicoes = [{ tipo: 'REPREENSAO', data_punicao: dataPunicao, status: 'Ativa' }];

  const resultado = gerarLinhaTempoComportamento({
    punicoes,
    postoGraduacao: 'Soldado',
    dataInclusaoMilitar: '2010-01-01',
    hoje: HOJE
  });

  // 1 REPREENSAO = 0.5 DETENCAO equivalente.
  // Regra Ótimo: até 1 DETENCAO equivalente em 4 anos.
  // Então continua Ótimo.
  assert.strictEqual(resultado.comportamentoCalculadoHoje, 'Ótimo');

  const eventoPunicao = resultado.eventos.find(e => e.tipo === 'PUNICAO');
  assert.ok(eventoPunicao);
  assert.strictEqual(eventoPunicao.data, '2024-01-01');
});

test('Caso 4: Militar com duas detenções dentro de 4 anos (não deve estar em Ótimo)', () => {
  const punicoes = [
    { tipo: 'DETENCAO', data_punicao: '2023-01-01', status: 'Ativa' },
    { tipo: 'DETENCAO', data_punicao: '2023-06-01', status: 'Ativa' }
  ];

  const resultado = gerarLinhaTempoComportamento({
    punicoes,
    postoGraduacao: 'Soldado',
    dataInclusaoMilitar: '2010-01-01',
    hoje: HOJE
  });

  // 2 DETENCOES = 2 DETENCOES equivalentes. Ultrapassa limite de 1 para Ótimo.
  // Deve ser Bom.
  assert.strictEqual(resultado.comportamentoCalculadoHoje, 'Bom');
});

test('Caso 5: Militar com exatamente 2 prisões equivalentes em 1 ano (Insuficiente)', () => {
  const punicoes = [
    { tipo: 'PRISAO', data_punicao: '2024-01-01', status: 'Ativa' },
    { tipo: 'PRISAO', data_punicao: '2024-02-01', status: 'Ativa' }
  ];

  const resultado = gerarLinhaTempoComportamento({
    punicoes,
    postoGraduacao: 'Soldado',
    dataInclusaoMilitar: '2010-01-01',
    hoje: HOJE
  });

  assert.strictEqual(resultado.comportamentoCalculadoHoje, 'Insuficiente');

  const segInsuficiente = resultado.segmentos.find(s => s.comportamento === 'Insuficiente');
  assert.ok(segInsuficiente);
});

test('Caso 6: Militar com mais de 2 prisões equivalentes em 1 ano (Mau)', () => {
  const punicoes = [
    { tipo: 'PRISAO', data_punicao: '2024-01-01', status: 'Ativa' },
    { tipo: 'PRISAO', data_punicao: '2024-02-01', status: 'Ativa' },
    { tipo: 'PRISAO', data_punicao: '2024-03-01', status: 'Ativa' }
  ];

  const resultado = gerarLinhaTempoComportamento({
    punicoes,
    postoGraduacao: 'Soldado',
    dataInclusaoMilitar: '2010-01-01',
    hoje: HOJE
  });

  assert.strictEqual(resultado.comportamentoCalculadoHoje, 'Mau');
});

test('Caso 7: Soldado com prisão em separado superior a 20 dias (Art. 53 - Mau)', () => {
  const punicoes = [
    {
      tipo: 'PRISAO EM SEPARADO',
      data_punicao: '2015-01-01',
      status: 'Ativa',
      dias: 21,
      em_separado: true
    }
  ];

  const resultado = gerarLinhaTempoComportamento({
    punicoes,
    postoGraduacao: 'Soldado',
    dataInclusaoMilitar: '2010-01-01',
    hoje: HOJE
  });

  assert.strictEqual(resultado.comportamentoCalculadoHoje, 'Mau');
  assert.match(resultado.segmentoAtual.fundamento, /Art. 53/);
});

test('Caso 8: Punição anulada (sem efeito)', () => {
  const punicoes = [
    { tipo: 'PRISAO', data_punicao: '2024-01-01', status: 'ANULADA' }
  ];

  const resultado = gerarLinhaTempoComportamento({
    punicoes,
    postoGraduacao: 'Soldado',
    dataInclusaoMilitar: '2010-01-01',
    hoje: HOJE
  });

  assert.strictEqual(resultado.comportamentoCalculadoHoje, 'Excepcional');
});

test('Caso 9: Punição reabilitada (respeitar config)', () => {
  const punicoes = [
    { tipo: 'PRISAO', data_punicao: '2024-01-01', status: 'REABILITADA' }
  ];

  // Sem incluir reabilitadas (padrão)
  const resPadrao = gerarLinhaTempoComportamento({
    punicoes,
    postoGraduacao: 'Soldado',
    dataInclusaoMilitar: '2010-01-01',
    hoje: HOJE
  });
  assert.strictEqual(resPadrao.comportamentoCalculadoHoje, 'Excepcional');

  // Incluindo reabilitadas
  const resComReab = gerarLinhaTempoComportamento({
    punicoes,
    postoGraduacao: 'Soldado',
    dataInclusaoMilitar: '2010-01-01',
    hoje: HOJE,
    config: { incluirReabilitadas: true }
  });
  // 1 PRISAO em 1 ano e serviço > 2 anos -> Bom
  assert.strictEqual(resComReab.comportamentoCalculadoHoje, 'Bom');
});

test('C5.1: Advertência aparece na linha do tempo como evento informativo e fora das janelas legais', () => {
  const resultado = gerarLinhaTempoComportamento({
    punicoes: [{ id: 'adv-1', tipo: 'ADVERTENCIA', data_punicao: '2024-01-01', status: 'Ativa' }],
    postoGraduacao: 'Soldado',
    dataInclusaoMilitar: '2010-01-01',
    hoje: HOJE
  });

  assert.strictEqual(resultado.comportamentoCalculadoHoje, 'Excepcional');

  const eventoAdvertencia = resultado.eventos.find(e => e.tipo === 'ADVERTENCIA_INFORMATIVA');
  assert.ok(eventoAdvertencia);
  assert.strictEqual(eventoAdvertencia.impacto_comportamento, false);
  assert.strictEqual(eventoAdvertencia.prisao_equivalente, 0);
  assert.strictEqual(eventoAdvertencia.detencao_equivalente, 0);
  assert.match(eventoAdvertencia.descricao, /Sem impacto no comportamento/);

  assert.strictEqual(resultado.segmentoAtual.janelas.j8.quantidade, 0);
  assert.deepStrictEqual(resultado.segmentoAtual.punicoesConsideradas, []);
  assert.strictEqual(resultado.segmentoAtual.advertenciasInformativas.length, 1);
});
