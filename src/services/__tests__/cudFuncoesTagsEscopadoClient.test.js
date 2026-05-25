import test from 'node:test';
import assert from 'node:assert/strict';

import { base44 } from '@/api/base44Client';
import { criarMilitarTagEscopado } from '../cudFuncoesTagsEscopadoClient.js';

const originalInvoke = base44.functions?.invoke;

test('preserva payload de conflito TAG_UNICA_CONFLITO', async () => {
  base44.functions.invoke = async () => {
    const error = new Error('Conflict');
    error.response = {
      status: 409,
      data: {
        code: 'TAG_UNICA_CONFLITO',
        militar_id: 'm1',
        militar_nome: 'Fulano',
        posto_grad: 'CAP',
        message: 'Esta tag já está atribuída a CAP Fulano.',
      },
    };
    throw error;
  };

  await assert.rejects(
    () => criarMilitarTagEscopado({ militar_id: 'm2', tag_id: 't1' }),
    (err) => {
      assert.equal(err.code, 'TAG_UNICA_CONFLITO');
      assert.equal(err.militar_id, 'm1');
      assert.equal(err.militar_nome, 'Fulano');
      assert.equal(err.posto_grad, 'CAP');
      assert.match(err.message, /já está atribuída/);
      return true;
    },
  );
});

test('normaliza sucesso da função CUD', async () => {
  base44.functions.invoke = async () => ({ data: { data: { id: 'ok-1' } } });

  const result = await criarMilitarTagEscopado({ militar_id: 'm2', tag_id: 't1' });
  assert.deepEqual(result, { id: 'ok-1' });
});

test.after(() => {
  base44.functions.invoke = originalInvoke;
});
