import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverReferenciaApostila } from './apostilaUtils';

test('resolverReferenciaApostila normaliza origem com trim/lowercase e aliases', () => {
  const casos = [
    [' Livro ', 'livro'],
    ['ExOfficio', 'ex-officio'],
    ['exofficio', 'ex-officio'],
    ['ex-officio', 'ex-officio'],
    ['Atestado', 'atestado'],
  ];

  for (const [entrada, esperado] of casos) {
    const resultado = resolverReferenciaApostila({ publicacao_referencia_origem_tipo: entrada }, {});
    assert.equal(resultado.origemTipo, esperado);
  }
});
