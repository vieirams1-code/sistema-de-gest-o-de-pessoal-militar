import test from 'node:test';
import assert from 'node:assert/strict';

import { calcularTempoServico, parseDateSafe, resolverDataBaseTempoServico } from '../tempoServicoService.js';

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
  assert.ok(parseDateSafe('2015-01-01T03:00:00Z'));
  assert.ok(parseDateSafe('07/03/1998'));
  assert.ok(parseDateSafe(1451606400000));
  assert.ok(parseDateSafe('1451606400000'));
  assert.ok(parseDateSafe({ seconds: 1451606400 }));
  assert.equal(parseDateSafe('31/02/2015'), null);
  assert.equal(parseDateSafe('data invalida'), null);
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


test('calcula tempo de serviço com data em formato brasileiro usada no Perfil', () => {
  const resultado = calcularTempoServico(
    { id: 'm3', data_inclusao: '07/03/1998' },
    new Date('2026-04-21T00:00:00Z'),
  );

  assert.equal(resultado.valido, true);
  assert.equal(resultado.anos_completos, 28);
  assert.ok(typeof resultado.dias_servico === 'number');
});

test('retorna cálculo inválido de forma segura sem NaN', () => {
  const resultado = calcularTempoServico({ id: 'm2', data_inclusao: '31/02/2018' });

  assert.equal(resultado.valido, false);
  assert.equal(resultado.anos_completos, null);
  assert.equal(resultado.dias_servico, null);
});
