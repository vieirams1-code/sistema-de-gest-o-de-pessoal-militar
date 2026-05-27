import test from 'node:test';
import assert from 'node:assert/strict';

import { isFeriasTagVinculoAtivo } from '../feriasTags.js';

// Replica a lógica de montagem de feriasTagsAtivasMap usada em pages/Ferias
// para garantir contrato com o bundle backend (feriasTags vindos hidratados).
function montarFeriasTagsAtivasMap(feriasTagsVinculos = []) {
  const mapa = new Map();
  feriasTagsVinculos.forEach((item) => {
    if (!isFeriasTagVinculoAtivo(item)) return;
    const feriasId = String(item?.ferias_id || '');
    const tagId = String(item?.tag_id || '');
    if (!feriasId || !tagId) return;
    if (!mapa.has(feriasId)) mapa.set(feriasId, new Map());
    mapa.get(feriasId).set(tagId, item);
  });
  return mapa;
}

// Replica o cálculo de tagsStatusById usado pelo modal "Gerenciar tags"
function montarTagsStatusById(selectedFerias, feriasTagsAtivasMap) {
  const status = {};
  if (selectedFerias.length === 0) return status;
  const total = selectedFerias.length;
  const contagem = new Map();
  selectedFerias.forEach((f) => {
    const feriasIdStr = String(f.id);
    const tagsDaFerias = feriasTagsAtivasMap.get(feriasIdStr);
    if (!tagsDaFerias) return;
    tagsDaFerias.forEach((_, tagId) => contagem.set(tagId, (contagem.get(tagId) || 0) + 1));
  });
  contagem.forEach((qtd, tagId) => {
    status[tagId] = qtd === total ? 'all' : 'some';
  });
  return status;
}

test('bundle.feriasTags com tag ativa monta mapa de ativos corretamente', () => {
  const feriasTagsBundle = [
    { id: 'ft1', ferias_id: 'f1', tag_id: 'tagAutorizada', status: 'ativa' },
    { id: 'ft2', ferias_id: 'f1', tag_id: 'tagOutra', status: 'removida', data_remocao: '2026-01-01' },
  ];

  const mapa = montarFeriasTagsAtivasMap(feriasTagsBundle);
  assert.equal(mapa.size, 1);
  assert.equal(mapa.get('f1').has('tagAutorizada'), true);
  assert.equal(mapa.get('f1').has('tagOutra'), false);
});

test('modal "Gerenciar tags" inicia com tag ativa marcada como all', () => {
  const feriasTagsBundle = [
    { id: 'ft1', ferias_id: 'f1', tag_id: 'tagAutorizada', status: 'ativa' },
  ];
  const mapa = montarFeriasTagsAtivasMap(feriasTagsBundle);
  const status = montarTagsStatusById([{ id: 'f1' }], mapa);
  assert.equal(status.tagAutorizada, 'all');
});

test('aplicação em bulk não reaplica tag já ativa', () => {
  const feriasTagsBundle = [
    { id: 'ft1', ferias_id: 'f1', tag_id: 'tagAutorizada', status: 'ativa' },
  ];
  const mapa = montarFeriasTagsAtivasMap(feriasTagsBundle);
  const selectedFerias = [{ id: 'f1' }];
  const targetIds = new Set(['tagAutorizada']);

  let aplicadas = 0;
  let semAlteracao = 0;
  const operacoes = [];

  selectedFerias.forEach((f) => {
    const ativos = mapa.get(String(f.id)) || new Map();
    targetIds.forEach((tagId) => {
      if (ativos.has(tagId)) {
        semAlteracao += 1;
        return;
      }
      aplicadas += 1;
      operacoes.push({ acao: 'aplicar', ferias_id: f.id, tag_id: tagId });
    });
  });

  assert.equal(aplicadas, 0);
  assert.equal(semAlteracao, 1);
  assert.equal(operacoes.length, 0);
});

test('bundle vazio (sem feriasTags) ainda permite operação consistente', () => {
  const mapa = montarFeriasTagsAtivasMap([]);
  const status = montarTagsStatusById([{ id: 'f1' }], mapa);
  assert.deepEqual(status, {});
});