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

test('normalizarTexto deve retornar texto em minusculo e sem espaços', () => {
  assert.strictEqual(normalizarTexto('  Teste  '), 'teste');
  assert.strictEqual(normalizarTexto('TESTE'), 'teste');
  assert.strictEqual(normalizarTexto(null), '');
  assert.strictEqual(normalizarTexto(undefined), '');
});

test('formatarDataSegura deve formatar datas corretamente', () => {
  assert.strictEqual(formatarDataSegura('2023-12-31'), '31/12/2023');
  assert.strictEqual(formatarDataSegura('2023-12-31T12:00:00Z'), '31/12/2023');
  assert.strictEqual(formatarDataSegura(''), '—');
  assert.strictEqual(formatarDataSegura(null), '—');
  assert.strictEqual(formatarDataSegura('data-invalida'), '—');
});

test('diferencaDias deve calcular a diferença de dias corretamente', () => {
  const base = new Date('2023-01-10T10:00:00');
  assert.strictEqual(diferencaDias('2023-01-15', base), 5);
  assert.strictEqual(diferencaDias('2023-01-05', base), -5);
  assert.strictEqual(diferencaDias('2023-01-10', base), 0);
  assert.strictEqual(diferencaDias(null, base), null);
  assert.strictEqual(diferencaDias('invalida', base), null);
});

test('calcularPrioridadePorPrazo deve retornar a prioridade correta', () => {
  assert.strictEqual(calcularPrioridadePorPrazo({ vencido: true }), 'critica');
  assert.strictEqual(calcularPrioridadePorPrazo({ status: 'Vencido' }), 'critica');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 2 }), 'critica');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 10 }), 'alta');
  assert.strictEqual(calcularPrioridadePorPrazo({ status: 'Aguardando' }), 'alta');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 25 }), 'media');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 40 }), 'media');
});

test('normalizarTipoCategoria deve mapear categorias corretamente', () => {
  assert.strictEqual(normalizarTipoCategoria('Publicação'), 'publicacoes');
  assert.strictEqual(normalizarTipoCategoria('Atestado Médico'), 'atestados');
  assert.strictEqual(normalizarTipoCategoria('Férias'), 'ferias');
  assert.strictEqual(normalizarTipoCategoria('Comportamento'), 'comportamento');
  assert.strictEqual(normalizarTipoCategoria('Legado'), 'legado');
  assert.strictEqual(normalizarTipoCategoria('Duplicidade'), 'legado');
  assert.strictEqual(normalizarTipoCategoria('Desconhecido'), 'outros');
});

test('montarDescricaoCurta deve montar a string corretamente', () => {
  assert.strictEqual(
    montarDescricaoCurta({ situacao: 'Pendente', detalhe: 'Faltam documentos', dataReferencia: '2023-05-20' }),
    'Pendente • Faltam documentos • Ref.: 20/05/2023'
  );
  assert.strictEqual(
    montarDescricaoCurta({ situacao: 'Pendente', detalhe: 'Faltam documentos' }),
    'Pendente • Faltam documentos'
  );
  assert.strictEqual(
    montarDescricaoCurta({ situacao: 'Pendente', dataReferencia: '2023-05-20' }),
    'Pendente • Ref.: 20/05/2023'
  );
  assert.strictEqual(
    montarDescricaoCurta({ detalhe: 'Faltam documentos', dataReferencia: '2023-05-20' }),
    'Faltam documentos • Ref.: 20/05/2023'
  );
  assert.strictEqual(
    montarDescricaoCurta({ situacao: 'Pendente' }),
    'Pendente'
  );
  assert.strictEqual(
    montarDescricaoCurta({}),
    ''
  );
});

test('ordenarPendencias deve ordenar corretamente', () => {
  const lista = [
    { prioridade: 'baixa', dataReferencia: '2023-01-01' },
    { prioridade: 'critica', dataReferencia: '2023-01-02' },
    { prioridade: 'media', dataReferencia: '2023-01-03' },
  ];

  const ordenada = ordenarPendencias(lista, 'prioridade_desc');
  assert.strictEqual(ordenada[0].prioridade, 'critica');
  assert.strictEqual(ordenada[1].prioridade, 'media');
  assert.strictEqual(ordenada[2].prioridade, 'baixa');

  const porDataAsc = ordenarPendencias(lista, 'data_asc');
  assert.strictEqual(porDataAsc[0].dataReferencia, '2023-01-01');
  assert.strictEqual(porDataAsc[2].dataReferencia, '2023-01-03');
});

test('filtrarPendencias deve filtrar corretamente', () => {
  const lista = [
    { titulo: 'Pendencia 1', categoriaSlug: 'ferias', prioridade: 'alta' },
    { titulo: 'Outra coisa', categoriaSlug: 'atestados', prioridade: 'media' },
  ];

  assert.strictEqual(filtrarPendencias(lista, { texto: 'Pendencia' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { categoria: 'ferias' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { prioridade: 'media' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { texto: 'Inexistente' }).length, 0);
});
