import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __setMilitarExclusaoClientForTests,
  excluirMilitarComDependencias,
} from '../militarExclusaoService.js';

function createEntity(initial = []) {
  const rows = [...initial];
  return {
    async list() {
      return [...rows];
    },
    async filter(criteria = {}) {
      return rows.filter((row) => Object.entries(criteria).every(([k, v]) => row[k] === v));
    },
    async update(id, payload) {
      const idx = rows.findIndex((row) => row.id === id);
      rows[idx] = { ...rows[idx], ...payload };
      return rows[idx];
    },
    async delete(id) {
      const idx = rows.findIndex((row) => row.id === id);
      if (idx >= 0) rows.splice(idx, 1);
      return { id };
    },
    _rows: rows,
  };
}

test('exclusão do militar encerra pendências de comportamento ativas', async () => {
  const entities = {
    Militar: createEntity([{ id: 'm1', nome_completo: 'Militar 1' }]),
    PendenciaComportamento: createEntity([
      { id: 'p1', militar_id: 'm1', status_pendencia: 'Pendente', detalhes_calculo: '' },
      { id: 'p2', militar_id: 'm1', status_pendencia: 'Em análise', detalhes_calculo: '' },
      { id: 'p3', militar_id: 'm1', status_pendencia: 'Aplicada', detalhes_calculo: '' },
      { id: 'p4', militar_id: 'm1', status_pendencia: 'Cancelada', detalhes_calculo: '' },
    ]),
  };

  __setMilitarExclusaoClientForTests({ entities });
  const resultado = await excluirMilitarComDependencias('m1', { executadoPor: 'admin@sgp' });

  assert.equal(resultado.pendencias.totalTratadas, 2);

  const [p1] = await entities.PendenciaComportamento.filter({ id: 'p1' });
  assert.equal(p1.status_pendencia, 'Descartada');
  assert.equal(p1.confirmado_por, 'admin@sgp');
  assert.match(p1.detalhes_calculo, /exclusão do militar/i);

  const [p2] = await entities.PendenciaComportamento.filter({ id: 'p2' });
  assert.equal(p2.status_pendencia, 'Descartada');

  const [p3] = await entities.PendenciaComportamento.filter({ id: 'p3' });
  assert.equal(p3.status_pendencia, 'Aplicada');

  const [p4] = await entities.PendenciaComportamento.filter({ id: 'p4' });
  assert.equal(p4.status_pendencia, 'Cancelada');

  const militaresRestantes = await entities.Militar.list();
  assert.equal(militaresRestantes.length, 0);
});
