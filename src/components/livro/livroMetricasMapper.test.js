import assert from 'node:assert/strict';
import test from 'node:test';

import { mapLivroRegistrosMetricasRP } from './livroMetricasMapper.js';

test('mapLivroRegistrosMetricasRP preserva os status usados pelas métricas do RP', () => {
  const contrato = mapLivroRegistrosMetricasRP({
    registros: [
      { id: 'sem-nota' },
      { id: 'com-nota', nota_para_bg: 'Nota 1' },
      { id: 'publicado-por-bg', nota_para_bg: 'Nota 2', numero_bg: '12', data_bg: '2026-05-14' },
      { id: 'publicado-explicito', status: 'Publicado' },
      { id: 'inconsistente', status: 'Inconsistente', motivo_inconsistencia: 'Vínculo ausente' },
    ],
  });

  assert.deepEqual(
    contrato.registros_livro_metricas.map((registro) => [registro.id, registro.status_codigo]),
    [
      ['sem-nota', 'ativo'],
      ['com-nota', 'aguardando_publicacao'],
      ['publicado-por-bg', 'gerada'],
      ['publicado-explicito', 'gerada'],
      ['inconsistente', 'inconsistente'],
    ]
  );
});

test('mapLivroRegistrosMetricasRP não inclui cargas operacionais pesadas de Publicações', () => {
  const [registro] = mapLivroRegistrosMetricasRP({
    registros: [{
      id: 'registro-1',
      militar_id: 'militar-1',
      texto_publicacao: 'Texto renderizado pesado',
      cadeia_eventos: [{ id: 'evento-1' }],
      ferias: { id: 'ferias-1' },
      periodo: { id: 'periodo-1' },
      vinculos: { ferias: { id: 'ferias-1' } },
      documento_texto: 'Documento operacional detalhado',
      nota_para_bg: 'Nota 3',
    }],
  }).registros_livro_metricas;

  assert.equal(registro.status_codigo, 'aguardando_publicacao');
  assert.equal(registro.militar_id, 'militar-1');
  assert.equal(Object.hasOwn(registro, 'texto_publicacao'), false);
  assert.equal(Object.hasOwn(registro, 'cadeia_eventos'), false);
  assert.equal(Object.hasOwn(registro, 'ferias'), false);
  assert.equal(Object.hasOwn(registro, 'periodo'), false);
  assert.equal(Object.hasOwn(registro, 'vinculos'), false);
  assert.equal(Object.hasOwn(registro, 'documento_texto'), false);
});
