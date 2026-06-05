import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarTexto,
  formatarDataSegura,
  diferencaDias,
  calcularPrioridadePorPrazo,
  normalizarTipoCategoria,
  montarDescricaoCurta,
  ordenarPendencias,
  filtrarPendencias,
} from '../centralPendencias.helpers.js';

test('normalizarTexto deve retornar string minuscula e sem espaços', () => {
  assert.strictEqual(normalizarTexto('  TEXTO  '), 'texto');
  assert.strictEqual(normalizarTexto(null), '');
  assert.strictEqual(normalizarTexto(undefined), '');
});

test('formatarDataSegura deve formatar data corretamente', () => {
  assert.strictEqual(formatarDataSegura('2023-10-27'), '27/10/2023');
  assert.strictEqual(formatarDataSegura(null), '—');
  assert.strictEqual(formatarDataSegura('data-invalida'), '—');
});

test('diferencaDias deve calcular a diferença correta em dias', () => {
  const base = new Date('2023-10-27T12:00:00');
  assert.strictEqual(diferencaDias('2023-10-30', base), 3);
  assert.strictEqual(diferencaDias('2023-10-24', base), -3);
  assert.strictEqual(diferencaDias('2023-10-27', base), 0);
  assert.strictEqual(diferencaDias(null), null);
  assert.strictEqual(diferencaDias('invalida'), null);
});

test('calcularPrioridadePorPrazo deve determinar a prioridade correta', () => {
  assert.strictEqual(calcularPrioridadePorPrazo({ vencido: true }), 'critica');
  assert.strictEqual(calcularPrioridadePorPrazo({ status: 'VENCIDO' }), 'critica');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 2 }), 'critica');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 10 }), 'alta');
  assert.strictEqual(calcularPrioridadePorPrazo({ status: 'aguardando' }), 'alta');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 20 }), 'media');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 40 }), 'media');
});

test('normalizarTipoCategoria deve mapear categorias corretamente', () => {
  assert.strictEqual(normalizarTipoCategoria('Publicação'), 'publicacoes');
  assert.strictEqual(normalizarTipoCategoria('Atestado Médico'), 'atestados');
  assert.strictEqual(normalizarTipoCategoria('Férias'), 'ferias');
  assert.strictEqual(normalizarTipoCategoria('Comportamento'), 'comportamento');
  assert.strictEqual(normalizarTipoCategoria('Duplicidade'), 'legado');
  assert.strictEqual(normalizarTipoCategoria('Qualquer outra coisa'), 'outros');
});

test('montarDescricaoCurta deve montar a string corretamente', () => {
  const data = {
    situacao: 'Pendente',
    detalhe: 'Aguardando assinatura',
    dataReferencia: '2023-10-27'
  };
  assert.strictEqual(montarDescricaoCurta(data), 'Pendente • Aguardando assinatura • Ref.: 27/10/2023');
  assert.strictEqual(montarDescricaoCurta({ situacao: 'Ok' }), 'Ok');
});

test('ordenarPendencias: data_desc', () => {
  const lista = [
    { id: 1, dataReferencia: '2023-10-01' },
    { id: 2, dataReferencia: '2023-10-20' },
    { id: 3, dataReferencia: '2023-09-15' },
  ];
  const ordenado = ordenarPendencias(lista, 'data_desc');
  assert.strictEqual(ordenado[0].id, 2);
  assert.strictEqual(ordenado[1].id, 1);
  assert.strictEqual(ordenado[2].id, 3);
});

test('ordenarPendencias: data_asc', () => {
  const lista = [
    { id: 1, dataReferencia: '2023-10-01' },
    { id: 2, dataReferencia: '2023-10-20' },
    { id: 3, dataReferencia: '2023-09-15' },
  ];
  const ordenado = ordenarPendencias(lista, 'data_asc');
  assert.strictEqual(ordenado[0].id, 3);
  assert.strictEqual(ordenado[1].id, 1);
  assert.strictEqual(ordenado[2].id, 2);
});

test('ordenarPendencias: prioridade_desc (default) com desempate por data_desc', () => {
  const lista = [
    { id: 1, prioridade: 'baixa', dataReferencia: '2023-10-01' },
    { id: 2, prioridade: 'critica', dataReferencia: '2023-10-01' },
    { id: 3, prioridade: 'alta', dataReferencia: '2023-10-01' },
    { id: 4, prioridade: 'critica', dataReferencia: '2023-10-20' },
  ];
  const ordenado = ordenarPendencias(lista); // default is prioridade_desc
  assert.strictEqual(ordenado[0].id, 4); // critica, mais recente
  assert.strictEqual(ordenado[1].id, 2); // critica, mais antiga
  assert.strictEqual(ordenado[2].id, 3); // alta
  assert.strictEqual(ordenado[3].id, 1); // baixa
});

test('filtrarPendencias deve filtrar por texto e categorias', () => {
  const lista = [
    { id: 1, titulo: 'Pendência A', categoriaSlug: 'ferias', prioridade: 'alta', situacao: 'Aguardando' },
    { id: 2, titulo: 'Pendência B', categoriaSlug: 'atestados', prioridade: 'baixa', situacao: 'Vencido' },
  ];

  assert.strictEqual(filtrarPendencias(lista, { texto: 'Pendência A' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { categoria: 'ferias' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { prioridade: 'baixa' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { situacao: 'vencid' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { texto: 'Inexistente' }).length, 0);
});
