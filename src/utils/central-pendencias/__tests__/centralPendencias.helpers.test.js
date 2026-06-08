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
  assert.notStrictEqual(diferencaDias('2099-01-01'), null);
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
    { id: 1, prioridade: 'baixa', dataReferencia: '2023-12-01' },
    { id: 2, prioridade: 'critica', dataReferencia: '2023-12-02' },
    { id: 3, prioridade: 'alta', dataReferencia: '2023-12-03' },
    { id: 4, prioridade: 'critica', dataReferencia: '2023-12-01' }
  ];

  // Ordenação padrão (prioridade_desc): Critica > Alta > Media > Baixa.
  // Empate na prioridade: dataReferencia decrescente.
  const ordenada = ordenarPendencias(lista, 'prioridade_desc');
  assert.strictEqual(ordenada[0].id, 2); // Critica, 2023-12-02
  assert.strictEqual(ordenada[1].id, 4); // Critica, 2023-12-01
  assert.strictEqual(ordenada[2].id, 3); // Alta
  assert.strictEqual(ordenada[3].id, 1); // Baixa

  const porDataDesc = ordenarPendencias(lista, 'data_desc');
  assert.strictEqual(porDataDesc[0].dataReferencia, '2023-12-03');
  assert.strictEqual(porDataDesc[3].dataReferencia, '2023-12-01');

  const porDataAsc = ordenarPendencias(lista, 'data_asc');
  assert.strictEqual(porDataAsc[0].dataReferencia, '2023-12-01');
  assert.strictEqual(porDataAsc[3].dataReferencia, '2023-12-03');
});

test('filtrarPendencias', () => {
  const lista = [
    { titulo: 'Pendencia A', categoriaSlug: 'ferias', prioridade: 'alta', situacao: 'Aguardando' },
    { titulo: 'Pendencia B', categoriaSlug: 'atestados', prioridade: 'critica', situacao: 'Vencido', militar: 'João' },
    { titulo: 'Outra coisa', descricao: 'Detalhe importante', setor: 'RH', origem: 'Sistema' }
  ];

  // Filtro Categoria
  assert.strictEqual(filtrarPendencias(lista, { categoria: 'ferias' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { categoria: 'todas' }).length, 3);

  // Filtro Prioridade
  assert.strictEqual(filtrarPendencias(lista, { prioridade: 'critica' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { prioridade: 'todas' }).length, 3);

  // Filtro Situação (parcial e case-insensitive)
  assert.strictEqual(filtrarPendencias(lista, { situacao: 'aguarda' }).length, 1);
  assert.strictEqual(filtrarPendencias(lista, { situacao: 'VENCIDO' }).length, 1);

  // Busca por texto (vários campos)
  assert.strictEqual(filtrarPendencias(lista, { texto: 'João' }).length, 1); // militar
  assert.strictEqual(filtrarPendencias(lista, { texto: 'detalhe' }).length, 1); // descricao
  assert.strictEqual(filtrarPendencias(lista, { texto: 'RH' }).length, 1); // setor
  assert.strictEqual(filtrarPendencias(lista, { texto: 'SISTEMA' }).length, 1); // origem
  assert.strictEqual(filtrarPendencias(lista, { texto: 'Pendencia' }).length, 2); // titulo

  // Combinação de filtros
  const filtrada = filtrarPendencias(lista, { categoria: 'ferias', prioridade: 'alta', texto: 'Pendencia A' });
  assert.strictEqual(filtrada.length, 1);
  assert.strictEqual(filtrada[0].titulo, 'Pendencia A');
});
