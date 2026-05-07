import test from 'node:test';
import assert from 'node:assert/strict';

import {
  avaliarRiscoAtestadosMilitar,
  calcularDiasUnicosNaJanela,
  calcularMaiorSequenciaContinua,
  mesclarIntervalosContiguosOuSobrepostos,
  normalizarPeriodoAtestado,
} from '../controleAtestadosTemporariosService.js';

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

test('sequência contínua >= 30 gera crítico contínuo', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    atestados: [{ data_inicio: '2026-01-01', data_termino: '2026-01-30', militar_nome: 'Militar A' }],
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.maiorSequenciaContinua, 30);
  assert.equal(resultado.statusRisco, 'critico_continuo');
});

test('janela anual >= 60 gera crítico intercalado', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    atestados: [
      { data_inicio: '2026-01-01', data_termino: '2026-01-20', militar_nome: 'Militar B' },
      { data_inicio: '2026-03-01', data_termino: '2026-03-20', militar_nome: 'Militar B' },
      { data_inicio: '2026-05-01', data_termino: '2026-05-20', militar_nome: 'Militar B' },
    ],
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.maiorSequenciaContinua, 20);
  assert.equal(resultado.diasJanela365, 60);
  assert.equal(resultado.statusRisco, 'critico_intercalado');
});

test('registros sem data válida geram lacuna e não quebram a tela', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    atestados: [{ data_inicio: 'data inválida', dias: 10, militar_nome: 'Militar C' }],
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.quantidadeAtestadosConsiderados, 0);
  assert.equal(resultado.statusRisco, 'nao_classificado');
  assert.match(resultado.lacunas.join(' '), /data inicial válida/);
});

test('ausência de campo de temporário/relação gera não classificado', () => {
  const resultado = avaliarRiscoAtestadosMilitar({
    atestados: [{ data_inicio: '2026-06-01', dias: 5, militar_nome: 'Militar D' }],
    dataReferencia: '2026-12-31',
  });

  assert.equal(resultado.vinculo, 'não classificado');
  assert.equal(resultado.relacaoServico, 'não classificada');
  assert.match(resultado.lacunas.join(' '), /Vínculo temporário/);
  assert.match(resultado.lacunas.join(' '), /Relação com o serviço/);
});
