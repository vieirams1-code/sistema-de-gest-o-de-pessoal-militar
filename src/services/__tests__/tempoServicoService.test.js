import test from 'node:test';
import assert from 'node:assert/strict';

import { calcularTempoServico, normalizarDataParaCampoCanonico, parseDateSafe, resolverDataBaseTempoServico } from '../tempoServicoService.js';

test('calcula tempo de serviço em dias e anos com data válida', () => {
  const resultado = calcularTempoServico(
    { id: 'm1', data_inclusao: '2014-04-21' },
    new Date('2026-04-21T00:00:00Z'),
  );

  assert.equal(resultado.valido, true);
  assert.equal(resultado.anos_completos, 12);
  assert.equal(resultado.dias_servico, 4383);
  assert.equal(resultado.campo_data_base, 'data_inclusao');
});

test('parseDateSafe aceita formatos suportados e bloqueia parsing frouxo', () => {
  assert.ok(parseDateSafe('2015-01-01'));
  assert.ok(parseDateSafe('21/04/2015'));
  assert.ok(parseDateSafe('2015-01-01T03:00:00Z'));
  assert.ok(parseDateSafe(1451606400000));
  assert.ok(parseDateSafe('1451606400000'));
  assert.ok(parseDateSafe({ seconds: 1451606400 }));
  assert.equal(parseDateSafe('data invalida'), null);
});

test('normalizarDataParaCampoCanonico converte entrada legada para yyyy-mm-dd', () => {
  assert.equal(normalizarDataParaCampoCanonico('21/04/2015'), '2015-04-21');
  assert.equal(normalizarDataParaCampoCanonico('2015-04-21'), '2015-04-21');
  assert.equal(normalizarDataParaCampoCanonico('31/02/2015'), '');
});

test('resolverDataBaseTempoServico usa fonte canônica com fallback controlado', () => {
  const resultado = resolverDataBaseTempoServico({
    data_inclusao: '',
    data_ingresso: '2010-01-01',
    data_praca: '2009-01-01',
  });

  assert.equal(resultado.campo, 'data_ingresso');
  assert.ok(resultado.data);
});

test('retorna cálculo inválido de forma segura sem NaN', () => {
  const resultado = calcularTempoServico({ id: 'm2', data_inclusao: '31/02/2018' });

  assert.equal(resultado.valido, false);
  assert.equal(resultado.anos_completos, null);
  assert.equal(resultado.dias_servico, null);
});
