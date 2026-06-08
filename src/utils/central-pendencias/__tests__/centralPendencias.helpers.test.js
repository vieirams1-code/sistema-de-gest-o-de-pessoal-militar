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
  filtrarPendencias
} from '../centralPendencias.helpers.js';

test('normalizarTexto', () => {
  assert.strictEqual(normalizarTexto('  Teste  '), 'teste');
  assert.strictEqual(normalizarTexto(null), '');
  assert.strictEqual(normalizarTexto(undefined), '');
  assert.strictEqual(normalizarTexto('TEXTO'), 'texto');
});

test('formatarDataSegura', () => {
  assert.strictEqual(formatarDataSegura('2023-12-31'), '31/12/2023');
  assert.strictEqual(formatarDataSegura('2023-12-31T15:30:00Z'), '31/12/2023');
  assert.strictEqual(formatarDataSegura(null), '—');
  assert.strictEqual(formatarDataSegura('data-invalida'), '—');
});

test('diferencaDias', () => {
  const base = new Date('2023-12-01T12:00:00');

  // Mesma data
  assert.strictEqual(diferencaDias('2023-12-01', base), 0);

  // Data futura
  assert.strictEqual(diferencaDias('2023-12-05', base), 4);

  // Data passada
  assert.strictEqual(diferencaDias('2023-11-30', base), -1);

  // Com horário na base (deve ignorar horário pois zera horas)
  const baseComHora = new Date('2023-12-01T23:59:59');
  assert.strictEqual(diferencaDias('2023-12-02', baseComHora), 1);

  // Com string ISO completa
  assert.strictEqual(diferencaDias('2023-12-05T15:00:00Z', base), 4);

  // Base como string
  assert.strictEqual(diferencaDias('2023-12-05', '2023-12-01T00:00:00'), 4);

  // Diferença grande (negativa)
  assert.strictEqual(diferencaDias('2022-12-01', base), -365);

  // Entrada nula
  assert.strictEqual(diferencaDias(null, base), null);

  // Entrada inválida
  assert.strictEqual(diferencaDias('data-errada', base), null);

  // Base inválida (não deve quebrar, mas pode retornar NaN se o JS permitir)
  // De acordo com o código: hoje = new Date(base); hoje.setHours(0,0,0,0);
  // Se base for inválida, hoje.getTime() será NaN.
  const diffInvalida = diferencaDias('2023-12-01', 'data-invalida');
  assert.ok(Number.isNaN(diffInvalida));

  // Usando default value para base (agora)
  const agora = new Date();
  const hojeStr = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  assert.strictEqual(diferencaDias(hojeStr), 0);
});

test('calcularPrioridadePorPrazo', () => {
  assert.strictEqual(calcularPrioridadePorPrazo({ vencido: true }), 'critica');
  assert.strictEqual(calcularPrioridadePorPrazo({ status: 'Vencido' }), 'critica');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 2 }), 'critica');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 10 }), 'alta');
  assert.strictEqual(calcularPrioridadePorPrazo({ status: 'Aguardando' }), 'alta');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 25 }), 'media');
  assert.strictEqual(calcularPrioridadePorPrazo({ diasParaVencer: 40 }), 'media');
});

test('normalizarTipoCategoria', () => {
  assert.strictEqual(normalizarTipoCategoria('Publicação'), 'publicacoes');
  assert.strictEqual(normalizarTipoCategoria('Atestado Médico'), 'atestados');
  assert.strictEqual(normalizarTipoCategoria('Férias'), 'ferias');
  assert.strictEqual(normalizarTipoCategoria('Comportamento'), 'comportamento');
  assert.strictEqual(normalizarTipoCategoria('Legado'), 'legado');
  assert.strictEqual(normalizarTipoCategoria('Qualquer'), 'outros');
});

test('montarDescricaoCurta', () => {
  assert.strictEqual(
    montarDescricaoCurta({ situacao: 'Pendente', detalhe: 'Falta documento', dataReferencia: '2023-12-01' }),
    'Pendente • Falta documento • Ref.: 01/12/2023'
  );
  assert.strictEqual(
    montarDescricaoCurta({ situacao: 'Pendente' }),
    'Pendente'
  );
});

test('ordenarPendencias', () => {
  const lista = [
    { prioridade: 'baixa', dataReferencia: '2023-12-01' },
    { prioridade: 'critica', dataReferencia: '2023-12-02' },
    { prioridade: 'alta', dataReferencia: '2023-12-03' }
  ];

  const ordenada = ordenarPendencias(lista, 'prioridade_desc');
  assert.strictEqual(ordenada[0].prioridade, 'critica');
  assert.strictEqual(ordenada[1].prioridade, 'alta');
  assert.strictEqual(ordenada[2].prioridade, 'baixa');

  const porData = ordenarPendencias(lista, 'data_desc');
  assert.strictEqual(porData[0].dataReferencia, '2023-12-03');

  const porDataAsc = ordenarPendencias(lista, 'data_asc');
  assert.strictEqual(porDataAsc[0].dataReferencia, '2023-12-01');

  // Default case
  const defaultOrdenada = ordenarPendencias(lista);
  assert.strictEqual(defaultOrdenada[0].prioridade, 'critica');
});

test('filtrarPendencias', () => {
  const lista = [
    { titulo: 'Pendencia A', categoriaSlug: 'ferias', prioridade: 'alta', situacao: 'Em Aberto' },
    { titulo: 'Pendencia B', categoriaSlug: 'atestados', prioridade: 'critica', situacao: 'Vencido' },
    { titulo: 'Pendencia C', categoriaSlug: 'publicacoes', prioridade: 'media', situacao: 'Aguardando' }
  ];

  // Filtro categoria
  assert.strictEqual(filtrarPendencias(lista, { categoria: 'ferias' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { categoria: 'todas' }).length, 3);

  // Filtro prioridade
  assert.strictEqual(filtrarPendencias(lista, { prioridade: 'critica' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { prioridade: 'todas' }).length, 3);

  // Filtro situacao
  assert.strictEqual(filtrarPendencias(lista, { situacao: 'Vencido' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { situacao: 'todas' }).length, 3);

  // Filtro texto
  assert.strictEqual(filtrarPendencias(lista, { texto: 'Pendencia B' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { texto: 'INEXISTENTE' }).length, 0);

  // Sem filtros
  assert.strictEqual(filtrarPendencias(lista).length, 3);
  assert.strictEqual(filtrarPendencias(null).length, 0);
});
