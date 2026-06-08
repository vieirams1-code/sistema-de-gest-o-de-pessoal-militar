import test from 'node:test';
import assert from 'node:assert/strict';
import { listarMedalhasEscopo, listarImpedimentosEscopo, bulkUpdateMedalhas } from '../medalhasAcessoService.js';

test('listarMedalhasEscopo uses bulk filtering', async () => {
  let capturedFilter = null;
  const base44Client = {
    entities: {
      Medalha: {
        filter: async (f, order) => {
          capturedFilter = f;
          return [{ id: 'medalha-1', militar_id: 'm1' }];
        }
      }
    }
  };

  const militarIds = ['m1', 'm2'];
  const result = await listarMedalhasEscopo({ base44Client, isAdmin: false, militarIds });

  assert.deepEqual(capturedFilter, { militar_id: { $in: militarIds } });
  assert.equal(result.length, 1);
});

test('listarImpedimentosEscopo uses bulk filtering', async () => {
  let capturedFilter = null;
  const base44Client = {
    entities: {
      ImpedimentoMedalha: {
        filter: async (f, order) => {
          capturedFilter = f;
          return [{ id: 'impedimento-1', militar_id: 'm1' }];
        }
      }
    }
  };

  const militarIds = ['m1', 'm2'];
  const result = await listarImpedimentosEscopo({ base44Client, isAdmin: false, militarIds });

  assert.deepEqual(capturedFilter, { militar_id: { $in: militarIds } });
  assert.equal(result.length, 1);
});

test('bulkUpdateMedalhas uses bulkUpdate when available', async () => {
  let capturedPayloads = null;
  const base44Client = {
    entities: {
      Medalha: {
        bulkUpdate: async (p) => {
          capturedPayloads = p;
          return p.length;
        }
      }
    }
  };

  const payloads = [{ id: '1', status: 'CANCELADA' }];
  await bulkUpdateMedalhas(base44Client, payloads);
  assert.deepEqual(capturedPayloads, payloads);
});

test('bulkUpdateMedalhas falls back to individual updates', async () => {
  const updatedIds = [];
  const base44Client = {
    entities: {
      Medalha: {
        update: async (id, data) => {
          updatedIds.push(id);
          return { id, ...data };
        }
      }
    }
  };

  const payloads = [{ id: '1', status: 'CANCELADA' }, { id: '2', status: 'CANCELADA' }];
  await bulkUpdateMedalhas(base44Client, payloads);
  assert.equal(updatedIds.length, 2);
  assert.ok(updatedIds.includes('1'));
  assert.ok(updatedIds.includes('2'));
});
