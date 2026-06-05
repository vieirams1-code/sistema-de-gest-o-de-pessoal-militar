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

test('Utility functions: normalizarTexto', () => {
  assert.strictEqual(normalizarTexto('  TESTE  '), 'teste');
  assert.strictEqual(normalizarTexto(null), '');
  assert.strictEqual(normalizarTexto(undefined), '');
  assert.strictEqual(normalizarTexto(''), '');
});

test('Utility functions: formatarDataSegura', () => {
  assert.strictEqual(formatarDataSegura('2023-10-01'), '01/10/2023');
  assert.strictEqual(formatarDataSegura('2023-10-01T10:00:00'), '01/10/2023');
  assert.strictEqual(formatarDataSegura(''), '—');
  assert.strictEqual(formatarDataSegura(null), '—');
  assert.strictEqual(formatarDataSegura('invalid-date'), '—');
});

test('Utility functions: normalizarTipoCategoria', () => {
  assert.strictEqual(normalizarTipoCategoria('Publicação'), 'publicacoes');
  assert.strictEqual(normalizarTipoCategoria('atestado médico'), 'atestados');
  assert.strictEqual(normalizarTipoCategoria('Férias'), 'ferias');
  assert.strictEqual(normalizarTipoCategoria('Comportamento'), 'comportamento');
  assert.strictEqual(normalizarTipoCategoria('Legado'), 'legado');
  assert.strictEqual(normalizarTipoCategoria('Outro'), 'outros');
});

test('Utility functions: montarDescricaoCurta', () => {
  assert.strictEqual(
    montarDescricaoCurta({ situacao: 'Pendente', detalhe: 'Falta assinar', dataReferencia: '2023-10-01' }),
    'Pendente • Falta assinar • Ref.: 01/10/2023'
  );
  assert.strictEqual(
    montarDescricaoCurta({ situacao: 'Pendente', detalhe: 'Falta assinar' }),
    'Pendente • Falta assinar'
  );
  assert.strictEqual(
    montarDescricaoCurta({ situacao: 'Pendente' }),
    'Pendente'
  );
});

test('Logic functions: diferencaDias', () => {
  const base = new Date('2023-10-01T12:00:00');
  assert.strictEqual(diferencaDias('2023-10-05', base), 4);
  assert.strictEqual(diferencaDias('2023-09-30', base), -1);
  assert.strictEqual(diferencaDias('2023-10-01', base), 0);
  assert.strictEqual(diferencaDias(null, base), null);
  assert.strictEqual(diferencaDias('invalid', base), null);
});

test('Logic functions: calcularPrioridadePorPrazo', () => {
  assert.strictEqual(calcularPrioridadePorPrazo({ vencido: true }), 'critica');
  assert.strictEqual(calcularPrioridadePorPrazo({ status: 'Vencido' }), 'critica');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 3 }), 'critica');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 10 }), 'alta');
  assert.strictEqual(calcularPrioridadePorPrazo({ status: 'Aguardando' }), 'alta');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 25 }), 'media');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 40 }), 'media');
});

test('Logic functions: ordenarPendencias', () => {
  const lista = [
    { id: 1, prioridade: 'baixa', dataReferencia: '2023-10-01' },
    { id: 2, prioridade: 'critica', dataReferencia: '2023-10-05' },
    { id: 3, prioridade: 'alta', dataReferencia: '2023-10-03' },
  ];

  const porDataDesc = ordenarPendencias(lista, 'data_desc');
  assert.strictEqual(porDataDesc[0].id, 2);
  assert.strictEqual(porDataDesc[2].id, 1);

  const porDataAsc = ordenarPendencias(lista, 'data_asc');
  assert.strictEqual(porDataAsc[0].id, 1);
  assert.strictEqual(porDataAsc[2].id, 2);

  const porPrioridade = ordenarPendencias(lista, 'prioridade_desc');
  assert.strictEqual(porPrioridade[0].prioridade, 'critica');
  assert.strictEqual(porPrioridade[1].prioridade, 'alta');
  assert.strictEqual(porPrioridade[2].prioridade, 'baixa');
});

test('Logic functions: filtrarPendencias', () => {
  const lista = [
    { id: 1, categoriaSlug: 'ferias', prioridade: 'alta', situacao: 'Vencido', titulo: 'Ferias Joao', militar: 'Joao', setor: 'RH' },
    { id: 2, categoriaSlug: 'atestados', prioridade: 'baixa', situacao: 'Pendente', titulo: 'Atestado Maria', militar: 'Maria', setor: 'TI' },
    { id: 3, categoriaSlug: 'ferias', prioridade: 'critica', situacao: 'Em analise', titulo: 'Ferias Jose', militar: 'Jose', setor: 'RH' },
  ];

  // Filtro categoria
  assert.strictEqual(filtrarPendencias(lista, { categoria: 'ferias' }).length, 2);
  assert.strictEqual(filtrarPendencias(lista, { categoria: 'todas' }).length, 3);

  // Filtro prioridade
  assert.strictEqual(filtrarPendencias(lista, { prioridade: 'baixa' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { prioridade: 'todas' }).length, 3);

  // Filtro situacao (parcial)
  assert.strictEqual(filtrarPendencias(lista, { situacao: 'venc' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { situacao: 'analise' }).length, 1);

  // Filtro texto (múltiplos campos)
  assert.strictEqual(filtrarPendencias(lista, { texto: 'maria' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { texto: 'rh' }).length, 2);
  assert.strictEqual(filtrarPendencias(lista, { texto: 'jose' }).length, 1);

  // Combinação
  assert.strictEqual(filtrarPendencias(lista, { categoria: 'ferias', texto: 'joao' }).length, 1);

  // Lista vazia
  assert.strictEqual(filtrarPendencias([], { texto: 'qualquer' }).length, 0);
  assert.strictEqual(filtrarPendencias(null, { texto: 'qualquer' }).length, 0);
});
